import { addDays, getBusinessDate } from '@sanfefer/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const today = getBusinessDate();
const yesterday = addDays(today, -1);

/**
 * Dos cuentas de hoy:
 * - Luis: 3 Gallo (Q60) en efectivo; además pidió 1 más que se canceló antes de prepararse.
 * - Admin: 2 Gallo (Q40) − 10 % + servicio 10 % = Q39.60 con tarjeta.
 * Cada Gallo cuesta Q8 (1 unidad del inventario). Además se registra una merma de 2 unidades.
 */
async function scenario() {
  const admin = await adminAgent();
  await createUser({ username: 'luis', pin: '1234' });
  await createUser({ username: 'ana', pin: '2345' });
  const luis = request.agent(app);
  await luis.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);

  const category = await prisma.category.create({ data: { name: 'Cervezas' } });
  const stock = await prisma.inventoryItem.create({
    data: {
      name: 'Gallo 350 ml',
      kind: 'RESALE',
      unit: 'UNIT',
      stock: 100,
      minStock: 24,
      averageCost: 8,
    },
  });
  const gallo = await prisma.product.create({
    data: {
      name: 'Gallo',
      price: 20,
      categoryId: category.id,
      recipe: { create: { inventoryItemId: stock.id, quantity: 1 } },
    },
  });
  await prisma.product.create({ data: { name: 'Corona', price: 25, categoryId: category.id } });
  await prisma.product.create({
    data: { name: 'Modelo', price: 25, categoryId: category.id, active: false },
  });

  await luis.post('/api/cash/open').send({ openingAmount: 100 }).expect(201);

  const tab1 = (await luis.post('/api/pos/tabs').send({ customerName: 'Juan' }).expect(201)).body
    .tab;
  await luis
    .post(`/api/pos/tabs/${tab1.id}/orders`)
    .send({ items: [{ productId: gallo.id, quantity: 3 }] })
    .expect(201);
  const extra = await luis
    .post(`/api/pos/tabs/${tab1.id}/orders`)
    .send({ items: [{ productId: gallo.id, quantity: 1 }] })
    .expect(201);
  const extraItemId = extra.body.tab.orders[1].items[0].id;
  await luis
    .post(`/api/pos/items/${extraItemId}/cancel`)
    .send({ reason: 'Se equivocó de pedido' })
    .expect(200);
  await luis
    .post(`/api/pos/tabs/${tab1.id}/payments`)
    .send({ method: 'CASH', amount: 60, tendered: 100 })
    .expect(201);

  const tab2 = (await admin.post('/api/pos/tabs').send({ customerName: 'Mesa VIP' }).expect(201))
    .body.tab;
  await admin
    .post(`/api/pos/tabs/${tab2.id}/orders`)
    .send({ items: [{ productId: gallo.id, quantity: 2 }] })
    .expect(201);
  await admin
    .patch(`/api/pos/tabs/${tab2.id}/charges`)
    .send({
      discount: { type: 'PERCENT', value: 10, reason: 'Cliente frecuente' },
      serviceChargeRate: 10,
    })
    .expect(200);
  await admin
    .post(`/api/pos/tabs/${tab2.id}/payments`)
    .send({ method: 'CARD', amount: 39.6, reference: '1234' })
    .expect(201);

  await admin
    .post(`/api/inventory/items/${stock.id}/movements`)
    .send({ type: 'WASTE', quantity: 2, reason: 'Se quebraron' })
    .expect(201);

  return { admin, luis, tab2, stock };
}

describe('reportes', () => {
  it('solo el administrador los ve', async () => {
    const { luis } = await scenario();
    await luis.get(`/api/reports/sales?from=${today}&to=${today}`).expect(403);
  });

  it('valida el rango con mensajes en español', async () => {
    const admin = await adminAgent();
    const res = await admin.get(`/api/reports/sales?from=${today}&to=${yesterday}`).expect(400);
    expect(JSON.stringify(res.body)).toContain('La fecha final no puede ser anterior a la inicial');
    await admin.get('/api/reports/products?from=hoy&to=mañana').expect(400);
  });

  it('ventas: totales, utilidad, mermas, cancelaciones y formas de pago', async () => {
    const { admin } = await scenario();
    const { report } = (await admin.get(`/api/reports/sales?from=${today}&to=${today}`).expect(200))
      .body;
    expect(report.totals).toEqual({
      tabs: 2,
      units: 5,
      subtotal: 100,
      discounts: 4,
      serviceCharges: 3.6,
      total: 99.6,
      netSales: 96,
      cost: 40,
      grossProfit: 56,
      margin: 0.5833,
      averageTicket: 49.8,
      cash: 60,
      card: 39.6,
      wasteCost: 16,
      profitAfterWaste: 40,
      cancelled: { units: 1, amount: 20 },
    });
    expect(report.series).toEqual([
      { period: today, tabs: 2, total: 99.6, netSales: 96, cost: 40, grossProfit: 56 },
    ]);
    expect(report.byHour).toHaveLength(24);
    expect(report.byHour.reduce((s: number, h: { total: number }) => s + h.total, 0)).toBeCloseTo(
      99.6,
    );
    expect(report.byWeekday).toHaveLength(7);
    expect(report.previous).toMatchObject({ from: yesterday, to: yesterday, tabs: 0, total: 0 });
  });

  it('agrupa por fecha de cobro y compara con el periodo anterior', async () => {
    const { admin, tab2 } = await scenario();
    // La cuenta del admin se cobró "ayer".
    await prisma.tab.update({
      where: { id: tab2.id },
      data: { businessDate: new Date(`${yesterday}T00:00:00Z`) },
    });
    await prisma.payment.updateMany({
      where: { tabId: tab2.id },
      data: { businessDate: new Date(`${yesterday}T00:00:00Z`) },
    });

    const day = (await admin.get(`/api/reports/sales?from=${today}&to=${today}`).expect(200)).body
      .report;
    expect(day.totals).toMatchObject({ tabs: 1, total: 60, card: 0 });
    expect(day.previous).toMatchObject({ tabs: 1, total: 39.6, grossProfit: 20 });

    const two = (
      await admin.get(`/api/reports/sales?from=${yesterday}&to=${today}&groupBy=day`).expect(200)
    ).body.report;
    expect(two.series.map((p: { period: string; total: number }) => [p.period, p.total])).toEqual([
      [yesterday, 39.6],
      [today, 60],
    ]);

    const month = (
      await admin.get(`/api/reports/sales?from=${yesterday}&to=${today}&groupBy=month`).expect(200)
    ).body.report;
    expect(month.series.reduce((s: number, p: { total: number }) => s + p.total, 0)).toBeCloseTo(
      99.6,
    );
  });

  it('productos: más y menos vendidos con costo y margen', async () => {
    const { admin } = await scenario();
    const { report } = (
      await admin.get(`/api/reports/products?from=${today}&to=${today}`).expect(200)
    ).body;
    expect(report.products).toEqual([
      expect.objectContaining({ name: 'Corona', units: 0, sales: 0, margin: null }),
      expect.objectContaining({
        name: 'Gallo',
        units: 5,
        sales: 100,
        cost: 40,
        profit: 60,
        margin: 0.6,
      }),
    ]);
    // Un producto inactivo sin ventas no aparece.
    expect(report.products.some((p: { name: string }) => p.name === 'Modelo')).toBe(false);
    expect(report.categories).toEqual([
      { name: 'Cervezas', units: 5, sales: 100, cost: 40, profit: 60 },
    ]);
  });

  it('vendedores: cuentas, ticket promedio, descuentos y cancelaciones', async () => {
    const { admin } = await scenario();
    const { report } = (
      await admin.get(`/api/reports/sellers?from=${today}&to=${today}`).expect(200)
    ).body;
    expect(report.sellers).toEqual([
      expect.objectContaining({
        name: 'Luis',
        tabs: 1,
        units: 3,
        total: 60,
        averageTicket: 60,
        discounts: 0,
        cancelled: { units: 1, amount: 20 },
      }),
      expect.objectContaining({ name: 'Admin', tabs: 1, units: 2, total: 39.6, discounts: 4 }),
      // Vendedora activa sin ventas: aparece en cero.
      expect.objectContaining({ name: 'Ana', tabs: 0, total: 0, averageTicket: 0 }),
    ]);
  });

  it('inventario: valor, alertas y movimientos del rango', async () => {
    const { admin } = await scenario();
    const { report } = (
      await admin.get(`/api/reports/inventory?from=${today}&to=${today}`).expect(200)
    ).body;
    expect(report.items).toEqual([
      expect.objectContaining({
        name: 'Gallo 350 ml',
        stock: 93,
        value: 744,
        status: 'OK',
        sold: 5,
        wasted: 2,
        wasteCost: 16,
        purchased: 0,
      }),
    ]);
    expect(report).toMatchObject({ totalValue: 744, lowCount: 0, outCount: 0, wasteCost: 16 });
  });

  it('detalle de cuentas cobradas para exportar', async () => {
    const { admin } = await scenario();
    const { tabs } = (await admin.get(`/api/reports/tabs?from=${today}&to=${today}`).expect(200))
      .body;
    expect(tabs).toEqual([
      expect.objectContaining({
        customerName: 'Juan',
        seller: 'Luis',
        units: 3,
        total: 60,
        cash: 60,
        card: 0,
      }),
      expect.objectContaining({
        customerName: 'Mesa VIP',
        seller: 'Admin',
        units: 2,
        subtotal: 40,
        discount: 4,
        serviceCharge: 3.6,
        total: 39.6,
        cash: 0,
        card: 39.6,
      }),
    ]);
    expect(tabs[0].businessDate).toBe(today);
  });
});
