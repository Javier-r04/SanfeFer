import { getBusinessDate } from '@sanfefer/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function seller() {
  await createUser({ username: 'luis', pin: '1234' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
  return agent;
}

describe('caja', () => {
  it('solo una caja abierta a la vez', async () => {
    const s = await seller();
    await s.post('/api/cash/open').send({ openingAmount: 300 }).expect(201);
    const again = await s.post('/api/cash/open').send({ openingAmount: 100 }).expect(409);
    expect(again.body.error.message).toMatch(/^Ya hay una caja abierta \(la abrió Luis a las/);
  });

  it('las aperturas simultáneas no crean dos cajas', async () => {
    const s = await seller();
    await Promise.all([1, 2, 3].map(() => s.post('/api/cash/open').send({ openingAmount: 100 })));
    expect(await prisma.cashSession.count({ where: { status: 'OPEN' } })).toBe(1);
  });

  it('arqueo: fondo + efectivo cobrado + entradas − salidas, y la diferencia al cerrar', async () => {
    const s = await seller();
    await s.post('/api/cash/open').send({ openingAmount: 200 }).expect(201);

    const category = await prisma.category.create({ data: { name: 'Bebidas' } });
    const beer = await prisma.product.create({
      data: { name: 'Gallo', price: 20, categoryId: category.id },
    });
    const pay = async (method: 'CASH' | 'CARD', qty: number) => {
      const tab = (await s.post('/api/pos/tabs').send({ customerName: 'X' }).expect(201)).body.tab;
      await s
        .post(`/api/pos/tabs/${tab.id}/orders`)
        .send({ items: [{ productId: beer.id, quantity: qty }] })
        .expect(201);
      await s
        .post(`/api/pos/tabs/${tab.id}/payments`)
        .send({ method, amount: qty * 20, tendered: method === 'CASH' ? 100 : undefined })
        .expect(201);
    };
    await pay('CASH', 3); // 60 en efectivo (recibe 100, da 40 de vuelto)
    await pay('CARD', 2); // 40 con tarjeta

    await s
      .post('/api/cash/movements')
      .send({ type: 'OUT', amount: 50, reason: 'Pago a proveedor de limones' })
      .expect(201);
    const tooMuch = await s
      .post('/api/cash/movements')
      .send({ type: 'OUT', amount: 999, reason: 'Retiro' })
      .expect(400);
    expect(tooMuch.body.error.message).toBe(
      'No hay tanto efectivo en caja: deberían haber Q 210.00.',
    );

    const current = (await s.get('/api/cash/current').expect(200)).body.session;
    expect(current).toMatchObject({
      cashSales: 60,
      cardSales: 40,
      movementsOut: 50,
      expectedCash: 210,
      paymentsCount: 2,
    });

    const closed = (await s.post('/api/cash/close').send({ countedCash: 205 }).expect(200)).body
      .session;
    expect(closed).toMatchObject({
      status: 'CLOSED',
      expectedCash: 210,
      countedCash: 205,
      difference: -5,
    });
    expect((await s.get('/api/cash/current').expect(200)).body.session).toBeNull();
    await s.post('/api/cash/close').send({ countedCash: 0 }).expect(409);
  });

  it('el cierre del día suma lo cobrado en la fecha y es solo para admin', async () => {
    const s = await seller();
    await s.get('/api/cash/daily').expect(403);
    await s.post('/api/cash/open').send({ openingAmount: 0 }).expect(201);
    const category = await prisma.category.create({ data: { name: 'Bebidas' } });
    const beer = await prisma.product.create({
      data: { name: 'Gallo', price: 20, categoryId: category.id },
    });
    const tab = (await s.post('/api/pos/tabs').send({ customerName: 'Karla' }).expect(201)).body
      .tab;
    await s
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({ items: [{ productId: beer.id, quantity: 3 }] })
      .expect(201);
    await s.patch(`/api/pos/tabs/${tab.id}/charges`).send({ serviceChargeRate: 10 }).expect(200);
    await s
      .post(`/api/pos/tabs/${tab.id}/payments`)
      .send({ method: 'CASH', amount: 66 })
      .expect(201);

    const admin = await adminAgent();
    const daily = (await admin.get('/api/cash/daily').expect(200)).body.daily;
    expect(daily).toMatchObject({
      date: getBusinessDate(),
      tabsPaid: 1,
      subtotal: 60,
      serviceCharges: 6,
      total: 66,
      cash: 66,
      card: 0,
      unitsSold: 3,
    });
    expect(daily.bySeller[0]).toMatchObject({ name: 'Luis', tabs: 1, total: 66 });
    expect(daily.topProducts[0]).toMatchObject({ name: 'Gallo', quantity: 3, total: 60 });
    expect(daily.sessions).toHaveLength(1);

    const other = (await admin.get('/api/cash/daily?date=2020-01-01').expect(200)).body.daily;
    expect(other).toMatchObject({ tabsPaid: 0, total: 0 });
  });
});

describe('ajustes', () => {
  it('cualquiera lee; solo el admin cambia, y se valida', async () => {
    const s = await seller();
    const read = (await s.get('/api/settings').expect(200)).body.settings;
    expect(read).toMatchObject({ businessName: 'SanfeFer', serviceChargeRate: 10, paperWidth: 80 });
    await s.patch('/api/settings').send({ businessName: 'Otro' }).expect(403);

    const admin = await adminAgent();
    const bad = await admin
      .patch('/api/settings')
      .send({ serviceChargeRate: 50, paperWidth: 70 })
      .expect(400);
    expect(bad.body.error.fields).toMatchObject({
      serviceChargeRate: 'El cargo por servicio no puede ser mayor que 30',
      paperWidth: 'Elige 58 u 80 mm',
    });
    const ok = (
      await admin
        .patch('/api/settings')
        .send({ address: 'Zona 1, Guatemala', paperWidth: 58 })
        .expect(200)
    ).body.settings;
    expect(ok).toMatchObject({
      address: 'Zona 1, Guatemala',
      paperWidth: 58,
      businessName: 'SanfeFer',
    });
  });
});
