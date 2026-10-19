import { getBusinessDate } from '@sanfefer/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = ReturnType<typeof request.agent>;

/** Vendedor con una mesa y una cuenta con 2 cervezas (Q 20 c/u) + 1 michelada (Q 35) = Q 75. */
async function setup({ openCash = true } = {}) {
  await prisma.user.create({
    data: {
      name: 'Fernanda',
      username: 'admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('x12345678', 4),
      pinHash: await bcrypt.hash('9999', 4),
    },
  });
  await createUser({ username: 'luis', pin: '1234' });
  const seller = request.agent(app);
  await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);

  const category = await prisma.category.create({ data: { name: 'Bebidas' } });
  const beer = await prisma.product.create({
    data: { name: 'Gallo', price: 20, categoryId: category.id },
  });
  const michelada = await prisma.product.create({
    data: { name: 'Michelada', price: 35, categoryId: category.id },
  });
  const table = await prisma.diningTable.create({ data: { name: 'Mesa 1' } });

  if (openCash) await seller.post('/api/cash/open').send({ openingAmount: 200 }).expect(201);
  const tab = (await seller.post('/api/pos/tabs').send({ tableId: table.id }).expect(201)).body.tab;
  await seller
    .post(`/api/pos/tabs/${tab.id}/orders`)
    .send({
      items: [
        { productId: beer.id, quantity: 2 },
        { productId: michelada.id, quantity: 1 },
      ],
    })
    .expect(201);
  return { seller, tabId: tab.id as number, table, beer, michelada };
}

const getTab = async (agent: Agent, id: number) =>
  (await agent.get(`/api/pos/tabs/${id}`).expect(200)).body.tab;

describe('descuento y servicio', () => {
  it('aplica servicio y calcula el total', async () => {
    const { seller, tabId } = await setup();
    const res = await seller
      .patch(`/api/pos/tabs/${tabId}/charges`)
      .send({ serviceChargeRate: 10 })
      .expect(200);
    expect(res.body.tab.billing).toMatchObject({
      subtotal: 75,
      serviceCharge: 7.5,
      total: 82.5,
      remaining: 82.5,
    });
  });

  it('un vendedor necesita el PIN de un admin para descontar', async () => {
    const { seller, tabId } = await setup();
    const discount = { type: 'PERCENT', value: 20, reason: 'Cliente frecuente' };
    const denied = await seller
      .patch(`/api/pos/tabs/${tabId}/charges`)
      .send({ discount })
      .expect(403);
    expect(denied.body.error.code).toBe('AUTHORIZATION_REQUIRED');
    const ok = await seller
      .patch(`/api/pos/tabs/${tabId}/charges`)
      .send({ discount, authorizationPin: '9999' })
      .expect(200);
    expect(ok.body.tab.billing).toMatchObject({ discountTotal: 15, total: 60 });
    expect(ok.body.tab.billing.discount.reason).toBe('Cliente frecuente (autorizó Fernanda)');
    // Quitar el descuento no necesita autorización.
    const removed = await seller
      .patch(`/api/pos/tabs/${tabId}/charges`)
      .send({ discount: null })
      .expect(200);
    expect(removed.body.tab.billing.total).toBe(75);
  });

  it('el servicio por defecto se toma de Ajustes al abrir la cuenta', async () => {
    const { seller, table } = await setup();
    await prisma.setting.upsert({
      where: { id: 1 },
      create: { id: 1, serviceChargeByDefault: true },
      update: { serviceChargeByDefault: true },
    });
    const tab = (await seller.post('/api/pos/tabs').send({ tableId: table.id }).expect(201)).body
      .tab;
    expect(tab.billing.serviceChargeRate).toBe(10);
  });
});

describe('cobro', () => {
  it('sin caja abierta no se puede cobrar', async () => {
    const { seller, tabId } = await setup({ openCash: false });
    const res = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 75 })
      .expect(409);
    expect(res.body.error).toMatchObject({
      code: 'CASH_CLOSED',
      message: 'No hay una caja abierta. Abre la caja antes de cobrar.',
    });
  });

  it('efectivo con vuelto cierra la cuenta y congela totales con la fecha de negocio', async () => {
    const { seller, tabId } = await setup();
    const res = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 75, tendered: 100 })
      .expect(201);
    expect(res.body).toMatchObject({ closed: true, change: 25 });
    expect(res.body.tab).toMatchObject({ status: 'PAID' });
    expect(res.body.tab.billing).toMatchObject({ total: 75, paid: 75, remaining: 0 });

    const saved = await prisma.tab.findUniqueOrThrow({ where: { id: tabId } });
    expect(Number(saved.total)).toBe(75);
    expect(saved.businessDate?.toISOString().slice(0, 10)).toBe(getBusinessDate());

    const floor = await seller.get('/api/pos/floor').expect(200);
    expect(floor.body.tables[0].tabs).toHaveLength(0);
  });

  it('pago mixto y en partes: la cuenta sigue abierta hasta completar el total', async () => {
    const { seller, tabId } = await setup();
    const first = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CARD', amount: 37.5, reference: '0042' })
      .expect(201);
    expect(first.body.closed).toBe(false);
    expect(first.body.tab.billing).toMatchObject({ paid: 37.5, remaining: 37.5 });

    const tooMuch = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 40 })
      .expect(400);
    expect(tooMuch.body.error.message).toBe(
      'El monto es mayor a lo que falta por pagar (Q 37.50).',
    );

    const last = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 37.5, tendered: 50 })
      .expect(201);
    expect(last.body).toMatchObject({ closed: true, change: 12.5 });
    expect(last.body.tab.billing.payments.map((p: { method: string }) => p.method)).toEqual([
      'CARD',
      'CASH',
    ]);
  });

  it('efectivo insuficiente se rechaza en español', async () => {
    const { seller, tabId } = await setup();
    const res = await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 75, tendered: 50 })
      .expect(400);
    expect(res.body.error.fields.tendered).toBe('El efectivo recibido no alcanza para el monto');
  });

  it('con pagos parciales no se puede bajar el total por debajo de lo pagado', async () => {
    const { seller, tabId } = await setup();
    await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CARD', amount: 70 })
      .expect(201);
    const tab = await getTab(seller, tabId);
    const michelada = tab.orders[0].items.find(
      (i: { productName: string }) => i.productName === 'Michelada',
    );
    const res = await seller
      .post(`/api/pos/items/${michelada.id}/cancel`)
      .send({ reason: 'Cambió de opinión' })
      .expect(409);
    expect(res.body.error.message).toMatch(/Quita el pago/);
    // Quitar el pago lo permite de nuevo.
    await seller.delete(`/api/pos/payments/${tab.billing.payments[0].id}`).expect(200);
    await seller
      .post(`/api/pos/items/${michelada.id}/cancel`)
      .send({ reason: 'Cambió de opinión' })
      .expect(200);
  });

  it('una cuenta con descuento del 100 % se cierra sin cobro', async () => {
    const { seller, tabId } = await setup();
    await seller
      .patch(`/api/pos/tabs/${tabId}/charges`)
      .send({
        discount: { type: 'PERCENT', value: 100, reason: 'Cortesía' },
        authorizationPin: '9999',
      })
      .expect(200);
    const res = await seller.post(`/api/pos/tabs/${tabId}/close`).expect(200);
    expect(res.body.tab).toMatchObject({ status: 'PAID' });
  });
});

describe('mover y dividir', () => {
  it('divide por productos: mueve una de dos cervezas a una cuenta nueva de la mesa', async () => {
    const { seller, tabId, table } = await setup();
    const tab = await getTab(seller, tabId);
    const beer = tab.orders[0].items.find(
      (i: { productName: string }) => i.productName === 'Gallo',
    );
    const res = await seller
      .post('/api/pos/items/move')
      .send({ items: [{ id: beer.id, quantity: 1 }], newTab: { tableId: table.id } })
      .expect(200);
    expect(res.body.source.billing.subtotal).toBe(55);
    expect(res.body.target).toMatchObject({ customerName: 'Cliente 2', subtotal: 20 });
    expect(res.body.target.orders[0].items[0]).toMatchObject({ productName: 'Gallo', quantity: 1 });
  });

  it('mueve productos a otra cuenta abierta', async () => {
    const { seller, tabId } = await setup();
    const other = (await seller.post('/api/pos/tabs').send({ customerName: 'Karla' }).expect(201))
      .body.tab;
    const tab = await getTab(seller, tabId);
    const michelada = tab.orders[0].items.find(
      (i: { productName: string }) => i.productName === 'Michelada',
    );
    const res = await seller
      .post('/api/pos/items/move')
      .send({ items: [{ id: michelada.id, quantity: 1 }], targetTabId: other.id })
      .expect(200);
    expect(res.body.target.subtotal).toBe(35);
    expect(res.body.source.subtotal).toBe(40);
  });
});

describe('ticket', () => {
  it('pre-cuenta antes de cobrar y comprobante después', async () => {
    const { seller, tabId } = await setup();
    const pre = await seller.get(`/api/pos/tabs/${tabId}/ticket`).expect(200);
    expect(pre.body.document.kind).toBe('PRECUENTA');
    expect(pre.body.document.totals.at(-1)).toMatchObject({ label: 'TOTAL', amount: 75 });

    await seller
      .post(`/api/pos/tabs/${tabId}/payments`)
      .send({ method: 'CASH', amount: 75, tendered: 100 })
      .expect(201);
    const post = await seller.get(`/api/pos/tabs/${tabId}/ticket`).expect(200);
    expect(post.body.document.kind).toBe('COMPROBANTE');
    expect(post.body.document.payments).toEqual([
      { label: 'Efectivo recibido', amount: 100 },
      { label: 'Vuelto', amount: 25 },
    ]);
  });
});
