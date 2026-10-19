import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = Awaited<ReturnType<typeof adminAgent>>;

async function createItem(admin: Agent, body: Record<string, unknown>) {
  const res = await admin
    .post('/api/inventory/items')
    .send({ kind: 'SUPPLY', unit: 'ML', minStock: 0, ...body })
    .expect(201);
  return res.body.item as { id: number; stock: number; averageCost: number; status: string };
}

describe('artículos de inventario', () => {
  it('solo el admin accede al inventario', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const seller = request.agent(app);
    await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    await seller.get('/api/inventory/items').expect(403);
  });

  it('crea con stock inicial y deja el movimiento en el historial', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, {
      name: 'Clamato',
      minStock: 4000,
      initialStock: 1800,
      initialCost: 0.0238,
    });
    expect(item).toMatchObject({ stock: 1800, averageCost: 0.0238, status: 'LOW' });

    const moves = await admin.get(`/api/inventory/movements?itemId=${item.id}`).expect(200);
    expect(moves.body.items).toHaveLength(1);
    expect(moves.body.items[0]).toMatchObject({
      type: 'INITIAL',
      quantity: 1800,
      stockAfter: 1800,
    });
  });

  it('rechaza nombres repetidos y datos inválidos en español', async () => {
    const admin = await adminAgent();
    await createItem(admin, { name: 'Limón', unit: 'UNIT' });
    const dup = await admin
      .post('/api/inventory/items')
      .send({ name: 'Limón', kind: 'SUPPLY', unit: 'UNIT', minStock: 0 })
      .expect(409);
    expect(dup.body.error.fields.name).toBe('Ya existe un registro con ese nombre.');

    const bad = await admin
      .post('/api/inventory/items')
      .send({ name: 'Sal', kind: 'SUPPLY', unit: 'KG', minStock: -1 })
      .expect(400);
    expect(bad.body.error.fields).toMatchObject({
      unit: 'Elige la unidad',
      minStock: 'El stock mínimo no puede ser menor que 0',
    });
  });

  it('filtra los que están en alerta (stock <= mínimo)', async () => {
    const admin = await adminAgent();
    await createItem(admin, { name: 'Tajín', unit: 'G', minStock: 250, initialStock: 220 });
    await createItem(admin, { name: 'Sal', unit: 'G', minStock: 500, initialStock: 2000 });
    await createItem(admin, { name: 'Camarón', unit: 'G', minStock: 500 });
    const res = await admin.get('/api/inventory/items?alert=true').expect(200);
    expect(res.body.items.map((i: { name: string }) => i.name).sort()).toEqual([
      'Camarón',
      'Tajín',
    ]);

    const summary = await admin.get('/api/inventory/summary').expect(200);
    expect(summary.body.summary).toMatchObject({ totalItems: 3, lowCount: 1, outCount: 1 });
  });

  it('no permite cambiar la unidad si ya tiene movimientos', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, { name: 'Chamoy', initialStock: 100, initialCost: 0.05 });
    const res = await admin
      .patch(`/api/inventory/items/${item.id}`)
      .send({ unit: 'G' })
      .expect(409);
    expect(res.body.error.message).toMatch(/No puedes cambiar la unidad/);
  });

  it('no elimina artículos con historial; sí los que no tienen', async () => {
    const admin = await adminAgent();
    const used = await createItem(admin, { name: 'Clamato', initialStock: 100 });
    const fresh = await createItem(admin, { name: 'Pulpa de piña' });
    await admin.delete(`/api/inventory/items/${used.id}`).expect(409);
    await admin.delete(`/api/inventory/items/${fresh.id}`).expect(204);
  });
});

describe('movimientos', () => {
  it('entrada manual con costo recalcula el costo promedio ponderado', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, {
      name: 'Corona',
      unit: 'UNIT',
      initialStock: 10,
      initialCost: 10,
    });
    const res = await admin
      .post(`/api/inventory/items/${item.id}/movements`)
      .send({ type: 'MANUAL_IN', quantity: 30, unitCost: 12 })
      .expect(201);
    // (10 × 10 + 30 × 12) / 40 = 11.5
    expect(res.body.item).toMatchObject({ stock: 40, averageCost: 11.5 });
    expect(res.body.movement).toMatchObject({
      type: 'MANUAL_IN',
      quantity: 30,
      unitCost: 12,
      stockAfter: 40,
    });
  });

  it('entrada sin costo no cambia el promedio', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, {
      name: 'Gallo',
      unit: 'UNIT',
      initialStock: 10,
      initialCost: 7.5,
    });
    const res = await admin
      .post(`/api/inventory/items/${item.id}/movements`)
      .send({ type: 'MANUAL_IN', quantity: 5 })
      .expect(201);
    expect(res.body.item).toMatchObject({ stock: 15, averageCost: 7.5 });
  });

  it('la merma descuenta, exige motivo y no deja el stock negativo', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, {
      name: 'Gallo',
      unit: 'UNIT',
      initialStock: 10,
      initialCost: 7.5,
    });
    const url = `/api/inventory/items/${item.id}/movements`;

    await admin.post(url).send({ type: 'WASTE', quantity: 2 }).expect(400);
    const tooMuch = await admin
      .post(url)
      .send({ type: 'WASTE', quantity: 11, reason: 'Se quebraron' })
      .expect(400);
    expect(tooMuch.body.error.message).toBe('No hay suficiente stock: hay 10 u.');

    const ok = await admin
      .post(url)
      .send({ type: 'WASTE', quantity: 2, reason: 'Se quebraron' })
      .expect(201);
    expect(ok.body.movement).toMatchObject({ quantity: -2, stockAfter: 8, reason: 'Se quebraron' });
  });

  it('el ajuste por conteo registra la diferencia', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, { name: 'Limón', unit: 'UNIT', initialStock: 140 });
    const url = `/api/inventory/items/${item.id}/movements`;
    const res = await admin.post(url).send({ type: 'ADJUSTMENT', countedStock: 132 }).expect(201);
    expect(res.body.movement).toMatchObject({ type: 'ADJUSTMENT', quantity: -8, stockAfter: 132 });
    expect(res.body.movement.reason).toBe('Conteo físico: 132 u');

    const same = await admin.post(url).send({ type: 'ADJUSTMENT', countedStock: 132 }).expect(400);
    expect(same.body.error.message).toMatch(/coincide con el stock actual/);
  });

  it('movimientos simultáneos no pierden cantidades', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, { name: 'Maní', unit: 'G', initialStock: 0 });
    const url = `/api/inventory/items/${item.id}/movements`;
    await Promise.all(
      Array.from({ length: 10 }, () =>
        admin.post(url).send({ type: 'MANUAL_IN', quantity: 10 }).expect(201),
      ),
    );
    const res = await admin.get(`/api/inventory/items/${item.id}`).expect(200);
    expect(res.body.item.stock).toBe(100);
  });

  it('pagina el historial con cursor', async () => {
    const admin = await adminAgent();
    const item = await createItem(admin, { name: 'Sal', unit: 'G', initialStock: 100 });
    for (let i = 0; i < 4; i++) {
      await admin
        .post(`/api/inventory/items/${item.id}/movements`)
        .send({ type: 'MANUAL_IN', quantity: 1 });
    }
    const first = await admin.get('/api/inventory/movements?limit=3').expect(200);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).toBe(first.body.items[2].id);
    const second = await admin
      .get(`/api/inventory/movements?limit=3&cursor=${first.body.nextCursor}`)
      .expect(200);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.nextCursor).toBeNull();

    const bad = await admin.get('/api/inventory/movements?from=18-10-2026').expect(400);
    expect(bad.body.error.message).toBe('La fecha debe tener el formato AAAA-MM-DD');
  });
});
