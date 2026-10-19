import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = Awaited<ReturnType<typeof adminAgent>>;

async function setup(admin: Agent) {
  const cat = await admin
    .post('/api/catalog/categories')
    .send({ name: 'Micheladas', color: 'primary' })
    .expect(201);
  const item = (body: Record<string, unknown>) =>
    admin
      .post('/api/inventory/items')
      .send({ kind: 'SUPPLY', minStock: 0, ...body })
      .expect(201)
      .then((r) => r.body.item.id as number);
  const clamato = await item({
    name: 'Clamato',
    unit: 'ML',
    initialStock: 1000,
    initialCost: 0.025,
    minStock: 500,
  });
  const limon = await item({
    name: 'Limón',
    unit: 'UNIT',
    initialStock: 9,
    initialCost: 0.5,
    minStock: 20,
  });
  const gallo = await item({
    name: 'Gallo',
    kind: 'RESALE',
    unit: 'UNIT',
    initialStock: 24,
    initialCost: 7.5,
  });
  return { categoryId: cat.body.category.id as number, clamato, limon, gallo };
}

describe('categorías', () => {
  it('crea, ordena y no elimina si tiene productos', async () => {
    const admin = await adminAgent();
    const a = await admin
      .post('/api/catalog/categories')
      .send({ name: 'Cervezas', color: 'warning' })
      .expect(201);
    const b = await admin
      .post('/api/catalog/categories')
      .send({ name: 'Boquitas', color: 'danger' })
      .expect(201);
    expect([a.body.category.sortOrder, b.body.category.sortOrder]).toEqual([0, 1]);

    const reordered = await admin
      .post('/api/catalog/categories/reorder')
      .send({ ids: [b.body.category.id, a.body.category.id] })
      .expect(200);
    expect(reordered.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Boquitas',
      'Cervezas',
    ]);

    await admin
      .post('/api/catalog/products')
      .send({ name: 'Gallo', categoryId: a.body.category.id, price: 20 })
      .expect(201);
    const del = await admin.delete(`/api/catalog/categories/${a.body.category.id}`).expect(409);
    expect(del.body.error.message).toBe(
      'La categoría tiene 1 producto. Muévelos a otra categoría o desactívala.',
    );
    await admin.delete(`/api/catalog/categories/${b.body.category.id}`).expect(204);
  });

  it('valida el color con mensaje en español', async () => {
    const admin = await adminAgent();
    const res = await admin
      .post('/api/catalog/categories')
      .send({ name: 'Otros', color: 'rojo' })
      .expect(400);
    expect(res.body.error.fields.color).toBe('Elige un color');
  });
});

describe('productos', () => {
  it('calcula costo, margen y porciones disponibles desde la receta', async () => {
    const admin = await adminAgent();
    const { categoryId, clamato, limon } = await setup(admin);
    const res = await admin
      .post('/api/catalog/products')
      .send({
        name: 'Michelada Clamato',
        categoryId,
        price: 38,
        description: '',
        recipe: [
          { inventoryItemId: clamato, quantity: 240 },
          { inventoryItemId: limon, quantity: 2 },
        ],
      })
      .expect(201);
    const p = res.body.product;
    // 240 × 0.025 + 2 × 0.5 = 7.00
    expect(p).toMatchObject({
      cost: 7,
      description: null,
      categoryName: 'Micheladas',
      active: true,
    });
    expect(p.margin).toBeCloseTo((38 - 7) / 38, 4);
    // Clamato alcanza para 4 (1000/240), limón para 4 (9/2): 4 porciones; el limón está bajo el mínimo.
    expect(p).toMatchObject({ available: 4, stockStatus: 'LOW' });
  });

  it('incluye la cerveza obligatoria más barata en el costo y suma las cervezas en la disponibilidad', async () => {
    const admin = await adminAgent();
    const { categoryId, limon, gallo } = await setup(admin);
    const corona = (
      await admin
        .post('/api/inventory/items')
        .send({
          name: 'Corona',
          kind: 'RESALE',
          unit: 'UNIT',
          minStock: 0,
          initialStock: 6,
          initialCost: 11,
        })
        .expect(201)
    ).body.item.id;
    const beer = await admin
      .post('/api/catalog/modifier-groups')
      .send({
        name: 'Cerveza',
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: 'Corona', priceDelta: 5, components: [{ inventoryItemId: corona, quantity: 1 }] },
          { name: 'Gallo', priceDelta: 0, components: [{ inventoryItemId: gallo, quantity: 1 }] },
        ],
      })
      .expect(201);
    const res = await admin
      .post('/api/catalog/products')
      .send({
        name: 'Chelada',
        categoryId,
        price: 30,
        recipe: [{ inventoryItemId: limon, quantity: 0.25 }],
        modifierGroupIds: [beer.body.group.id],
      })
      .expect(201);
    // Receta 0.25 × 0.5 = 0.125; + Gallo (recargo 0, costo 7.5) = 7.63
    expect(res.body.product).toMatchObject({ recipeCost: 0.13, cost: 7.63, basePrice: 30 });
    // Limón alcanza para 36 (9 / 0.25); cervezas: 24 Gallo + 6 Corona = 30.
    expect(res.body.product.available).toBe(30);
  });

  it('reemplaza la receta y los extras al editar', async () => {
    const admin = await adminAgent();
    const { categoryId, clamato, limon } = await setup(admin);
    const group = await admin
      .post('/api/catalog/modifier-groups')
      .send({
        name: 'Escarchado',
        minSelect: 0,
        maxSelect: 1,
        options: [{ name: 'Sal', priceDelta: 0 }],
      })
      .expect(201);
    const created = await admin
      .post('/api/catalog/products')
      .send({
        name: 'Chelada',
        categoryId,
        price: 30,
        recipe: [{ inventoryItemId: limon, quantity: 3 }],
      })
      .expect(201);
    const id = created.body.product.id;

    const updated = await admin
      .patch(`/api/catalog/products/${id}`)
      .send({
        recipe: [{ inventoryItemId: clamato, quantity: 100 }],
        modifierGroupIds: [group.body.group.id],
      })
      .expect(200);
    expect(updated.body.product.recipe.map((l: { name: string }) => l.name)).toEqual(['Clamato']);
    expect(updated.body.product.modifierGroupIds).toEqual([group.body.group.id]);

    // Desactivar no toca la receta.
    const off = await admin
      .patch(`/api/catalog/products/${id}`)
      .send({ active: false })
      .expect(200);
    expect(off.body.product).toMatchObject({ active: false });
    expect(off.body.product.recipe).toHaveLength(1);
  });

  it('señala el insumo inexistente en la línea de la receta', async () => {
    const admin = await adminAgent();
    const { categoryId } = await setup(admin);
    const res = await admin
      .post('/api/catalog/products')
      .send({ name: 'X', categoryId, price: 1, recipe: [{ inventoryItemId: 999, quantity: 1 }] })
      .expect(400);
    expect(res.body.error.message).toBe('El nombre debe tener al menos 2 caracteres');

    const res2 = await admin
      .post('/api/catalog/products')
      .send({ name: 'Raro', categoryId, price: 1, recipe: [{ inventoryItemId: 999, quantity: 1 }] })
      .expect(400);
    expect(res2.body.error.fields['recipe.0.inventoryItemId']).toBe('Este artículo ya no existe');
  });

  it('no permite dos productos con el mismo nombre en la categoría', async () => {
    const admin = await adminAgent();
    const { categoryId } = await setup(admin);
    await admin
      .post('/api/catalog/products')
      .send({ name: 'Gallo', categoryId, price: 20 })
      .expect(201);
    const dup = await admin
      .post('/api/catalog/products')
      .send({ name: 'Gallo', categoryId, price: 20 })
      .expect(409);
    expect(dup.body.error.message).toBe('Ya existe un registro con ese nombre en la categoría.');
  });

  it('un vendedor puede ver el menú pero no modificarlo', async () => {
    const admin = await adminAgent();
    const { categoryId } = await setup(admin);
    await createUser({ username: 'luis', pin: '1234' });
    const seller = request.agent(app);
    await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    await seller.get('/api/catalog/products').expect(200);
    await seller
      .post('/api/catalog/products')
      .send({ name: 'Gallo', categoryId, price: 20 })
      .expect(403);
  });
});

describe('grupos de extras', () => {
  it('actualiza opciones: conserva, crea y borra', async () => {
    const admin = await adminAgent();
    const { gallo, limon } = await setup(admin);
    const created = await admin
      .post('/api/catalog/modifier-groups')
      .send({
        name: 'Cerveza para michelada',
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: 'Gallo', priceDelta: 0, components: [{ inventoryItemId: gallo, quantity: 1 }] },
          { name: 'Corona', priceDelta: 5 },
        ],
      })
      .expect(201);
    const g = created.body.group;
    expect(g.options[0]).toMatchObject({ name: 'Gallo', cost: 7.5 });

    const galloOption = g.options[0];
    const updated = await admin
      .put(`/api/catalog/modifier-groups/${g.id}`)
      .send({
        name: 'Cerveza',
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: galloOption.id,
            name: 'Gallo',
            priceDelta: 0,
            components: [{ inventoryItemId: gallo, quantity: 1 }],
          },
          {
            name: 'Limonada',
            priceDelta: 2,
            components: [{ inventoryItemId: limon, quantity: 2 }],
          },
        ],
      })
      .expect(200);
    const opts = updated.body.group.options;
    expect(opts.map((o: { name: string }) => o.name)).toEqual(['Gallo', 'Limonada']);
    expect(opts[0].id).toBe(galloOption.id);
  });

  it('rechaza una opción de otro grupo y no borra grupos en uso', async () => {
    const admin = await adminAgent();
    const { categoryId } = await setup(admin);
    const g1 = await admin
      .post('/api/catalog/modifier-groups')
      .send({ name: 'Uno', minSelect: 0, maxSelect: 1, options: [{ name: 'A', priceDelta: 0 }] })
      .expect(201);
    const g2 = await admin
      .post('/api/catalog/modifier-groups')
      .send({ name: 'Dos', minSelect: 0, maxSelect: 1, options: [{ name: 'B', priceDelta: 0 }] })
      .expect(201);
    await admin
      .put(`/api/catalog/modifier-groups/${g2.body.group.id}`)
      .send({
        name: 'Dos',
        minSelect: 0,
        maxSelect: 1,
        options: [{ id: g1.body.group.options[0].id, name: 'A', priceDelta: 0 }],
      })
      .expect(400);

    await admin
      .post('/api/catalog/products')
      .send({ name: 'Chelada', categoryId, price: 30, modifierGroupIds: [g1.body.group.id] })
      .expect(201);
    const del = await admin.delete(`/api/catalog/modifier-groups/${g1.body.group.id}`).expect(409);
    expect(del.body.error.message).toBe(
      'Lo usa 1 producto. Quítalo de esos productos o desactívalo.',
    );
  });
});
