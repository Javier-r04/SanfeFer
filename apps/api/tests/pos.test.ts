import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = ReturnType<typeof request.agent>;

/** Menú mínimo: michelada (limón 2) + cerveza obligatoria (Gallo o Corona) + escarchado opcional (tajín). */
async function setup() {
  const admin = await prisma.user.create({
    data: {
      name: 'Fernanda',
      username: 'admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('Sanfefer2026', 4),
      pinHash: await bcrypt.hash('9999', 4),
    },
  });
  await createUser({ username: 'luis', pin: '1234' });
  const seller = request.agent(app);
  await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);

  const item = (name: string, unit: 'UNIT' | 'G', stock: number, cost: number) =>
    prisma.inventoryItem.create({
      data: { name, kind: 'SUPPLY', unit, stock, averageCost: cost, minStock: 0 },
    });
  const limon = await item('Limón', 'UNIT', 10, 0.5);
  const gallo = await item('Gallo', 'UNIT', 24, 7.5);
  const corona = await item('Corona', 'UNIT', 1, 11);
  const tajin = await item('Tajín', 'G', 100, 0.1);

  const category = await prisma.category.create({ data: { name: 'Micheladas', color: 'primary' } });
  const beer = await prisma.modifierGroup.create({
    data: {
      name: 'Cerveza',
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          {
            name: 'Gallo',
            priceDelta: 0,
            sortOrder: 0,
            components: { create: [{ inventoryItemId: gallo.id, quantity: 1 }] },
          },
          {
            name: 'Corona',
            priceDelta: 5,
            sortOrder: 1,
            components: { create: [{ inventoryItemId: corona.id, quantity: 1 }] },
          },
        ],
      },
    },
    include: { options: true },
  });
  const rim = await prisma.modifierGroup.create({
    data: {
      name: 'Escarchado',
      minSelect: 0,
      maxSelect: 1,
      options: {
        create: [
          {
            name: 'Tajín',
            priceDelta: 3,
            components: { create: [{ inventoryItemId: tajin.id, quantity: 10 }] },
          },
        ],
      },
    },
    include: { options: true },
  });
  const michelada = await prisma.product.create({
    data: {
      name: 'Michelada',
      price: 35,
      categoryId: category.id,
      recipe: { create: [{ inventoryItemId: limon.id, quantity: 2 }] },
      modifierGroups: {
        create: [
          { groupId: beer.id, sortOrder: 0 },
          { groupId: rim.id, sortOrder: 1 },
        ],
      },
    },
  });
  const table = await prisma.diningTable.create({ data: { name: 'Mesa 4', zone: 'Salón' } });
  const opt = (g: typeof beer, name: string) => g.options.find((o) => o.name === name)!.id;
  return {
    admin,
    seller,
    table,
    michelada,
    ids: { limon: limon.id, gallo: gallo.id, corona: corona.id, tajin: tajin.id },
    options: { gallo: opt(beer, 'Gallo'), corona: opt(beer, 'Corona'), tajin: opt(rim, 'Tajín') },
  };
}

const stock = async (id: number) =>
  Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).stock);

async function openTab(seller: Agent, body: Record<string, unknown>) {
  return (await seller.post('/api/pos/tabs').send(body).expect(201)).body.tab as {
    id: number;
    customerName: string;
  };
}

describe('cuentas y mesas', () => {
  it('una mesa puede tener varias cuentas con nombres automáticos', async () => {
    const { seller, table } = await setup();
    const a = await openTab(seller, { tableId: table.id });
    const b = await openTab(seller, { tableId: table.id });
    const c = await openTab(seller, { tableId: table.id, customerName: 'Andrea' });
    expect([a.customerName, b.customerName, c.customerName]).toEqual([
      'Cliente 1',
      'Cliente 2',
      'Andrea',
    ]);

    const floor = await seller.get('/api/pos/floor').expect(200);
    expect(floor.body.tables[0].tabs).toHaveLength(3);
    const detail = await seller.get(`/api/pos/tabs/${a.id}`).expect(200);
    expect(detail.body.tab.siblings.map((s: { customerName: string }) => s.customerName)).toEqual([
      'Cliente 1',
      'Cliente 2',
      'Andrea',
    ]);
  });

  it('un cliente sin mesa necesita nombre y aparece aparte', async () => {
    const { seller } = await setup();
    const res = await seller.post('/api/pos/tabs').send({}).expect(400);
    expect(res.body.error.fields.customerName).toBe('Escribe el nombre del cliente');
    await openTab(seller, { customerName: 'Don Beto' });
    const floor = await seller.get('/api/pos/floor').expect(200);
    expect(floor.body.walkIns[0]).toMatchObject({
      customerName: 'Don Beto',
      tableId: null,
      subtotal: 0,
    });
  });

  it('una cuenta vacía se puede cancelar y libera la mesa', async () => {
    const { seller, table } = await setup();
    const tab = await openTab(seller, { tableId: table.id });
    await seller.post(`/api/pos/tabs/${tab.id}/cancel`).send({}).expect(204);
    const floor = await seller.get('/api/pos/floor').expect(200);
    expect(floor.body.tables[0].tabs).toHaveLength(0);
  });

  it('mueve una cuenta a otra mesa o la deja sin mesa', async () => {
    const { seller, table } = await setup();
    const other = await prisma.diningTable.create({ data: { name: 'Terraza 1' } });
    const tab = await openTab(seller, { tableId: table.id, customerName: 'Andrea' });
    const moved = await seller
      .patch(`/api/pos/tabs/${tab.id}`)
      .send({ tableId: other.id })
      .expect(200);
    expect(moved.body.tab.table).toMatchObject({ name: 'Terraza 1' });
    const walk = await seller.patch(`/api/pos/tabs/${tab.id}`).send({ tableId: null }).expect(200);
    expect(walk.body.tab.table).toBeNull();
  });
});

describe('enviar a barra', () => {
  it('calcula el precio con extras y descuenta receta y extras del inventario', async () => {
    const { seller, table, michelada, ids, options } = await setup();
    const tab = await openTab(seller, { tableId: table.id, customerName: 'Andrea' });
    const res = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [
          {
            productId: michelada.id,
            quantity: 2,
            note: 'Poco hielo',
            modifierOptionIds: [options.gallo, options.tajin],
          },
        ],
      })
      .expect(201);

    const line = res.body.tab.orders[0].items[0];
    // 35 + 0 (Gallo) + 3 (tajín) = 38
    expect(line).toMatchObject({
      quantity: 2,
      unitPrice: 38,
      lineTotal: 76,
      note: 'Poco hielo',
      status: 'PENDING',
    });
    expect(line.modifiers.map((m: { optionName: string }) => m.optionName)).toEqual([
      'Gallo',
      'Tajín',
    ]);
    expect(res.body.tab).toMatchObject({ subtotal: 76, itemCount: 2, counts: { pending: 2 } });
    expect(res.body.stockWarnings).toEqual([]);

    expect(await stock(ids.limon)).toBe(6);
    expect(await stock(ids.gallo)).toBe(22);
    expect(await stock(ids.tajin)).toBe(80);

    // Costo: 2 × 0.5 + 7.5 + 10 × 0.1 = 9.5 por unidad
    const saved = await prisma.orderItem.findFirstOrThrow();
    expect(Number(saved.unitCost)).toBe(9.5);
    const moves = await prisma.inventoryMovement.findMany({ where: { orderItemId: saved.id } });
    expect(moves.every((m) => m.type === 'SALE')).toBe(true);
    expect(moves[0]!.reason).toMatch(/^Comanda #\d+ · Mesa 4 · Andrea$/);
  });

  it('valida los extras obligatorios', async () => {
    const { seller, table, michelada } = await setup();
    const tab = await openTab(seller, { tableId: table.id });
    const res = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({ items: [{ productId: michelada.id, quantity: 1 }] })
      .expect(400);
    expect(res.body.error.message).toBe('Michelada: Elige una opción de Cerveza');
  });

  it('avisa cuando se vende sin existencia (si está permitido)', async () => {
    const { seller, table, michelada, options } = await setup();
    const tab = await openTab(seller, { tableId: table.id });
    const res = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [{ productId: michelada.id, quantity: 2, modifierOptionIds: [options.corona] }],
      })
      .expect(201);
    expect(res.body.stockWarnings).toEqual(['Corona quedó en -1 u']);
  });

  it('bloquea la venta sin existencia si la configuración no lo permite', async () => {
    const { seller, table, michelada, ids, options } = await setup();
    await prisma.setting.create({ data: { id: 1, allowNegativeStock: false } });
    const tab = await openTab(seller, { tableId: table.id });
    const res = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [{ productId: michelada.id, quantity: 2, modifierOptionIds: [options.corona] }],
      })
      .expect(409);
    expect(res.body.error.message).toBe('No hay suficiente inventario: Corona (hay 1 u).');
    expect(await stock(ids.limon)).toBe(10);
    expect(await prisma.order.count()).toBe(0);
  });

  it('no deja enviar a una cuenta cancelada ni productos inactivos', async () => {
    const { seller, table, michelada, options } = await setup();
    const tab = await openTab(seller, { tableId: table.id });
    await prisma.product.update({ where: { id: michelada.id }, data: { active: false } });
    const res = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [{ productId: michelada.id, quantity: 1, modifierOptionIds: [options.gallo] }],
      })
      .expect(400);
    expect(res.body.error.fields['items.0.productId']).toBe('Producto no disponible');

    await seller.post(`/api/pos/tabs/${tab.id}/cancel`).send({}).expect(204);
    await prisma.product.update({ where: { id: michelada.id }, data: { active: true } });
    const closed = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [{ productId: michelada.id, quantity: 1, modifierOptionIds: [options.gallo] }],
      })
      .expect(409);
    expect(closed.body.error.message).toBe('Esta cuenta fue cancelada.');
  });
});

describe('barra', () => {
  it('muestra las comandas y avanza sus estados', async () => {
    const { seller, table, michelada, options } = await setup();
    const tab = await openTab(seller, { tableId: table.id, customerName: 'Andrea' });
    const sent = await seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [{ productId: michelada.id, quantity: 1, modifierOptionIds: [options.gallo] }],
      })
      .expect(201);

    const bar = await seller.get('/api/pos/bar').expect(200);
    expect(bar.body.activeCount).toBe(1);
    expect(bar.body.orders[0].tab).toMatchObject({ customerName: 'Andrea', tableName: 'Mesa 4' });

    await seller
      .post(`/api/pos/orders/${sent.body.orderId}/advance`)
      .send({ to: 'PREPARING' })
      .expect(200);
    await seller
      .post(`/api/pos/orders/${sent.body.orderId}/advance`)
      .send({ to: 'DELIVERED' })
      .expect(200);
    const after = await seller.get('/api/pos/bar').expect(200);
    expect(after.body.activeCount).toBe(0);
    // Entregado recientemente: sigue visible en la columna "Entregado".
    expect(after.body.orders[0].items[0].status).toBe('DELIVERED');

    const detail = await seller.get(`/api/pos/tabs/${tab.id}`).expect(200);
    expect(detail.body.tab.counts).toEqual({ pending: 0, preparing: 0, delivered: 1 });
  });
});

describe('cancelar productos', () => {
  async function sendTwo() {
    const ctx = await setup();
    const tab = await openTab(ctx.seller, { tableId: ctx.table.id });
    const res = await ctx.seller
      .post(`/api/pos/tabs/${tab.id}/orders`)
      .send({
        items: [
          { productId: ctx.michelada.id, quantity: 2, modifierOptionIds: [ctx.options.gallo] },
        ],
      })
      .expect(201);
    return {
      ...ctx,
      tab,
      itemId: res.body.tab.orders[0].items[0].id as number,
      orderId: res.body.orderId as number,
    };
  }

  it('cancelar uno de dos pendientes divide la línea y devuelve su inventario', async () => {
    const { seller, ids, itemId } = await sendTwo();
    expect(await stock(ids.gallo)).toBe(22);
    const res = await seller
      .post(`/api/pos/items/${itemId}/cancel`)
      .send({ reason: 'Cambió de opinión', quantity: 1 })
      .expect(200);
    const items = res.body.tab.orders[0].items;
    expect(items.map((i: { quantity: number; status: string }) => [i.quantity, i.status])).toEqual([
      [1, 'PENDING'],
      [1, 'CANCELLED'],
    ]);
    expect(res.body.tab.subtotal).toBe(35);
    expect(await stock(ids.gallo)).toBe(23);
    expect(await stock(ids.limon)).toBe(8);
  });

  it('un vendedor necesita el PIN de un admin para cancelar algo ya preparado', async () => {
    const { seller, ids, itemId, orderId } = await sendTwo();
    await seller.post(`/api/pos/orders/${orderId}/advance`).send({ to: 'PREPARING' }).expect(200);

    const noPin = await seller
      .post(`/api/pos/items/${itemId}/cancel`)
      .send({ reason: 'Se derramó' })
      .expect(403);
    expect(noPin.body.error.code).toBe('AUTHORIZATION_REQUIRED');
    const wrong = await seller
      .post(`/api/pos/items/${itemId}/cancel`)
      .send({ reason: 'Se derramó', authorizationPin: '0000' })
      .expect(403);
    expect(wrong.body.error.message).toBe('PIN de administrador incorrecto.');

    await seller
      .post(`/api/pos/items/${itemId}/cancel`)
      .send({ reason: 'Se derramó', authorizationPin: '9999' })
      .expect(200);
    const item = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { cancelAuthorizedBy: true },
    });
    expect(item).toMatchObject({ status: 'CANCELLED', cancelReason: 'Se derramó' });
    expect(item.cancelAuthorizedBy?.name).toBe('Fernanda');
    // Ya preparado: el inventario no vuelve, queda como merma.
    expect(await stock(ids.gallo)).toBe(22);
    const waste = await prisma.inventoryMovement.count({
      where: { orderItemId: itemId, type: 'WASTE' },
    });
    expect(waste).toBe(2);
  });

  it('no cancela dos veces ni más de lo que hay', async () => {
    const { seller, itemId } = await sendTwo();
    const tooMany = await seller
      .post(`/api/pos/items/${itemId}/cancel`)
      .send({ reason: 'Error', quantity: 3 })
      .expect(400);
    expect(tooMany.body.error.message).toBe('Solo hay 2 en esta línea.');
    await seller.post(`/api/pos/items/${itemId}/cancel`).send({ reason: 'Error' }).expect(200);
    await seller.post(`/api/pos/items/${itemId}/cancel`).send({ reason: 'Error' }).expect(409);
  });
});

describe('menú del POS', () => {
  it('incluye solo lo activo, con extras y disponibilidad', async () => {
    const { seller } = await setup();
    const res = await seller.get('/api/pos/menu').expect(200);
    const [category] = res.body.categories;
    expect(category.name).toBe('Micheladas');
    const [product] = category.products;
    // Limón alcanza para 5; cervezas 24 + 1 = 25 → 5.
    expect(product).toMatchObject({ name: 'Michelada', price: 35, available: 5 });
    expect(product.modifierGroups.map((g: { name: string }) => g.name)).toEqual([
      'Cerveza',
      'Escarchado',
    ]);
  });
});
