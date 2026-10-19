import { getBusinessDate } from '@sanfefer/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = Awaited<ReturnType<typeof adminAgent>>;
const today = getBusinessDate();

async function setup(admin: Agent) {
  const supplier = await admin
    .post('/api/purchases/suppliers')
    .send({ name: 'Cervecería Centro Americana', phone: '2289-1234', email: 'VENTAS@cca.gt' })
    .expect(201);
  const item = async (body: Record<string, unknown>) =>
    (
      await admin
        .post('/api/inventory/items')
        .send({ kind: 'RESALE', unit: 'UNIT', minStock: 0, ...body })
        .expect(201)
    ).body.item.id as number;
  return {
    supplierId: supplier.body.supplier.id as number,
    gallo: await item({ name: 'Gallo', initialStock: 10, initialCost: 7 }),
    corona: await item({ name: 'Corona', initialStock: 0, initialCost: 0 }),
  };
}

const getItem = (admin: Agent, id: number) =>
  admin
    .get(`/api/inventory/items/${id}`)
    .then((r) => r.body.item as { stock: number; averageCost: number });

describe('proveedores', () => {
  it('crea, normaliza el correo y no elimina si tiene compras', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    const list = await admin.get('/api/purchases/suppliers').expect(200);
    expect(list.body.suppliers[0]).toMatchObject({
      email: 'ventas@cca.gt',
      purchaseCount: 0,
      totalPurchased: 0,
    });

    await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        items: [{ inventoryItemId: gallo, quantity: 24, lineTotal: 180 }],
      })
      .expect(201);
    const del = await admin.delete(`/api/purchases/suppliers/${supplierId}`).expect(409);
    expect(del.body.error.message).toBe(
      'Tiene 1 compra registrada. Desactívalo en lugar de eliminarlo.',
    );

    const after = await admin.get('/api/purchases/suppliers').expect(200);
    expect(after.body.suppliers[0]).toMatchObject({
      purchaseCount: 1,
      totalPurchased: 180,
      lastPurchaseAt: today,
    });
  });

  it('no permite comprarle a un proveedor desactivado', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    await admin.patch(`/api/purchases/suppliers/${supplierId}`).send({ active: false }).expect(200);
    const res = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        items: [{ inventoryItemId: gallo, quantity: 1, lineTotal: 7 }],
      })
      .expect(400);
    expect(res.body.error.fields.supplierId).toBe('Proveedor desactivado');
  });
});

describe('compras', () => {
  it('sube el stock, recalcula el costo promedio y deja el movimiento', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo, corona } = await setup(admin);
    const res = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        invoiceNumber: 'A-1023',
        items: [
          { inventoryItemId: gallo, quantity: 24, lineTotal: 180 },
          { inventoryItemId: corona, quantity: 12, lineTotal: 138 },
        ],
      })
      .expect(201);
    const p = res.body.purchase;
    expect(p).toMatchObject({
      total: 318,
      status: 'RECEIVED',
      itemCount: 2,
      invoiceNumber: 'A-1023',
    });
    expect(p.items[0]).toMatchObject({ name: 'Gallo', quantity: 24, unitCost: 7.5, subtotal: 180 });

    // Gallo: (10 × 7 + 24 × 7.5) / 34 = 7.3529
    expect(await getItem(admin, gallo)).toMatchObject({ stock: 34, averageCost: 7.3529 });
    expect(await getItem(admin, corona)).toMatchObject({ stock: 12, averageCost: 11.5 });

    const moves = await admin
      .get(`/api/inventory/movements?itemId=${gallo}&type=PURCHASE`)
      .expect(200);
    expect(moves.body.items[0]).toMatchObject({ quantity: 24, unitCost: 7.5, stockAfter: 34 });
    expect(moves.body.items[0].reason).toBe(
      `Compra #${p.id} · Cervecería Centro Americana · factura A-1023`,
    );
  });

  it('si una línea es inválida no guarda nada (transacción)', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    const res = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        items: [
          { inventoryItemId: gallo, quantity: 24, lineTotal: 180 },
          { inventoryItemId: 9999, quantity: 1, lineTotal: 1 },
        ],
      })
      .expect(400);
    expect(res.body.error.fields['items.1.inventoryItemId']).toBe('Este artículo ya no existe');
    expect(await getItem(admin, gallo)).toMatchObject({ stock: 10 });
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('valida líneas y fecha con mensajes en español', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    const res = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: '2099-01-01',
        items: [{ inventoryItemId: gallo, quantity: 0, lineTotal: 10.555 }],
      })
      .expect(400);
    expect(res.body.error.fields).toMatchObject({
      purchasedAt: 'La fecha de la compra no puede ser futura',
      'items.0.quantity': 'La cantidad debe ser mayor que 0',
      'items.0.lineTotal': 'El total de la línea admite máximo 2 decimales',
    });
  });

  it('anular devuelve el stock y el costo promedio', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    const created = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        items: [{ inventoryItemId: gallo, quantity: 24, lineTotal: 180 }],
      })
      .expect(201);
    const id = created.body.purchase.id;

    await admin.post(`/api/purchases/${id}/void`).send({ reason: '' }).expect(400);
    const voided = await admin
      .post(`/api/purchases/${id}/void`)
      .send({ reason: 'Factura duplicada' })
      .expect(200);
    expect(voided.body.purchase).toMatchObject({
      status: 'VOIDED',
      voidReason: 'Factura duplicada',
      voidedBy: { name: 'Admin' },
    });
    const gall = await getItem(admin, gallo);
    expect(gall.stock).toBe(10);
    expect(gall.averageCost).toBeCloseTo(7, 3);

    const again = await admin
      .post(`/api/purchases/${id}/void`)
      .send({ reason: 'Otra vez' })
      .expect(409);
    expect(again.body.error.message).toBe('Esta compra ya estaba anulada.');

    const list = await admin.get('/api/purchases').expect(200);
    expect(list.body.totalReceived).toBe(0);
  });

  it('no anula si lo comprado ya se usó', async () => {
    const admin = await adminAgent();
    const { supplierId, corona } = await setup(admin);
    const created = await admin
      .post('/api/purchases')
      .send({
        supplierId,
        purchasedAt: today,
        items: [{ inventoryItemId: corona, quantity: 12, lineTotal: 138 }],
      })
      .expect(201);
    await admin
      .post(`/api/inventory/items/${corona}/movements`)
      .send({ type: 'WASTE', quantity: 2, reason: 'Se quebraron' })
      .expect(201);
    const res = await admin
      .post(`/api/purchases/${created.body.purchase.id}/void`)
      .send({ reason: 'Error' })
      .expect(409);
    expect(res.body.error.message).toMatch(/Corona \(hay 10 u, la compra trajo 12\)/);
    expect(await getItem(admin, corona)).toMatchObject({ stock: 10 });
  });

  it('lista con filtros, total recibido y paginación', async () => {
    const admin = await adminAgent();
    const { supplierId, gallo } = await setup(admin);
    for (const [date, total] of [
      ['2026-10-01', 70],
      ['2026-10-05', 140],
      ['2026-10-10', 210],
    ] as const) {
      await admin
        .post('/api/purchases')
        .send({
          supplierId,
          purchasedAt: date,
          items: [{ inventoryItemId: gallo, quantity: 10, lineTotal: total }],
        })
        .expect(201);
    }
    const filtered = await admin.get('/api/purchases?from=2026-10-05&to=2026-10-10').expect(200);
    expect(filtered.body.items).toHaveLength(2);
    expect(filtered.body.totalReceived).toBe(350);

    const page1 = await admin.get('/api/purchases?limit=2').expect(200);
    expect(page1.body.items).toHaveLength(2);
    const page2 = await admin
      .get(`/api/purchases?limit=2&cursor=${page1.body.nextCursor}`)
      .expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();
  });
});
