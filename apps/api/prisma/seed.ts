/**
 * Datos de prueba de SanfeFer. Borra TODO y vuelve a cargar:
 * usuarios, mesas, proveedores, inventario con stock inicial, menú con recetas y extras.
 *
 *   npm run db:seed        (o npm run db:reset para recrear la base desde cero)
 */
import { MeasureUnit, Prisma, PrismaClient, type InventoryItemKind } from '@prisma/client';
import { getBusinessDate } from '@sanfefer/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);

if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
  console.error(
    'El seed borra todos los datos. En producción define SEED_FORCE=true si de verdad lo quieres.',
  );
  process.exit(1);
}

// ───────────── Inventario ─────────────
// [nombre, tipo, unidad, stock inicial, stock mínimo, costo por unidad base]
type ItemRow = [string, InventoryItemKind, MeasureUnit, number, number, number];

const { UNIT, ML, G } = MeasureUnit;

const inventoryRows: ItemRow[] = [
  // Cervezas (reventa)
  ['Cerveza Gallo 350 ml', 'RESALE', UNIT, 96, 48, 7.5],
  ['Cerveza Cabro 350 ml', 'RESALE', UNIT, 54, 24, 7.25],
  ['Cerveza Monte Carlo 350 ml', 'RESALE', UNIT, 36, 24, 8.0],
  ['Cerveza Dorada Draft 350 ml', 'RESALE', UNIT, 36, 24, 7.75],
  ['Cerveza Moza 350 ml', 'RESALE', UNIT, 24, 12, 8.5],
  ['Corona 355 ml', 'RESALE', UNIT, 12, 24, 11.0],
  ['Modelo Especial 355 ml', 'RESALE', UNIT, 30, 24, 11.5],
  // Bebidas sin alcohol y boquitas (reventa)
  ['Agua pura 600 ml', 'RESALE', UNIT, 48, 24, 2.5],
  ['Coca-Cola 355 ml', 'RESALE', UNIT, 48, 24, 4.0],
  ['Agua mineral Salutaris 355 ml', 'RESALE', UNIT, 24, 12, 4.25],
  ['Papalinas (bolsa)', 'RESALE', UNIT, 30, 10, 3.0],
  // Insumos
  ['Clamato', 'SUPPLY', ML, 1800, 4000, 0.0238],
  ['Limón', 'SUPPLY', UNIT, 140, 60, 0.5],
  ['Salsa inglesa', 'SUPPLY', ML, 900, 300, 0.06],
  ['Salsa picante', 'SUPPLY', ML, 700, 250, 0.04],
  ['Sal', 'SUPPLY', G, 2000, 500, 0.005],
  ['Tajín', 'SUPPLY', G, 220, 250, 0.09],
  ['Chamoy', 'SUPPLY', ML, 1500, 500, 0.05],
  ['Camarón cocido', 'SUPPLY', G, 0, 500, 0.12],
  ['Pulpa de mango', 'SUPPLY', ML, 2000, 1000, 0.04],
  ['Pulpa de tamarindo', 'SUPPLY', ML, 1500, 1000, 0.035],
  ['Ron Botrán Añejo', 'SUPPLY', ML, 1500, 750, 0.15],
  ['Ron Zacapa 23', 'SUPPLY', ML, 750, 375, 0.55],
  ['Azúcar', 'SUPPLY', G, 3000, 1000, 0.008],
  ['Totopos', 'SUPPLY', G, 2500, 1000, 0.05],
  ['Queso para nachos', 'SUPPLY', G, 1800, 1000, 0.08],
  ['Maní salado', 'SUPPLY', G, 2000, 800, 0.04],
];

// ───────────── Menú ─────────────
type Recipe = Record<string, number>; // artículo → cantidad en su unidad base

interface ProductRow {
  name: string;
  price: number;
  description?: string;
  recipe: Recipe;
  groups?: string[];
}

const BEER = 'Cerveza para michelada';
const RIM = 'Escarchado';
const EXTRAS = 'Extras';

const menu: { category: string; color: string; products: ProductRow[] }[] = [
  {
    category: 'Micheladas',
    color: 'primary',
    products: [
      {
        name: 'Michelada clásica',
        price: 35,
        description: 'Limón, salsa inglesa y salsa picante',
        recipe: { Limón: 2, 'Salsa inglesa': 15, 'Salsa picante': 5 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Michelada cubana',
        price: 35,
        description: 'Limón, salsa inglesa y sal',
        recipe: { Limón: 2, 'Salsa inglesa': 20, Sal: 3 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Michelada Clamato',
        price: 38,
        description: 'Clamato, limón y salsas',
        recipe: { Clamato: 240, Limón: 2, 'Salsa inglesa': 10, 'Salsa picante': 5 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Michelada de camarón',
        price: 55,
        description: 'Clamato, camarones y limón',
        recipe: { Clamato: 240, 'Camarón cocido': 80, Limón: 2, 'Salsa inglesa': 10 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Michelada de mango',
        price: 40,
        description: 'Pulpa de mango y chamoy',
        recipe: { 'Pulpa de mango': 120, Chamoy: 15, Limón: 1 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Michelada de tamarindo',
        price: 40,
        description: 'Pulpa de tamarindo y chamoy',
        recipe: { 'Pulpa de tamarindo': 120, Chamoy: 15, Limón: 1 },
        groups: [BEER, RIM, EXTRAS],
      },
      {
        name: 'Chelada',
        price: 30,
        description: 'Cerveza con limón y sal',
        recipe: { Limón: 3 },
        groups: [BEER, RIM],
      },
      {
        name: 'Michelada sin alcohol',
        price: 25,
        description: 'Clamato preparado, sin cerveza',
        recipe: { Clamato: 300, Limón: 2, 'Salsa inglesa': 10, 'Salsa picante': 5 },
        groups: [RIM, EXTRAS],
      },
    ],
  },
  {
    category: 'Cervezas',
    color: 'warning',
    products: [
      { name: 'Gallo', price: 20, recipe: { 'Cerveza Gallo 350 ml': 1 } },
      { name: 'Cabro', price: 20, recipe: { 'Cerveza Cabro 350 ml': 1 } },
      { name: 'Monte Carlo', price: 22, recipe: { 'Cerveza Monte Carlo 350 ml': 1 } },
      { name: 'Dorada Draft', price: 22, recipe: { 'Cerveza Dorada Draft 350 ml': 1 } },
      { name: 'Moza', price: 22, recipe: { 'Cerveza Moza 350 ml': 1 } },
      { name: 'Corona', price: 25, recipe: { 'Corona 355 ml': 1 } },
      { name: 'Modelo Especial', price: 25, recipe: { 'Modelo Especial 355 ml': 1 } },
    ],
  },
  {
    category: 'Cócteles',
    color: 'highlight',
    products: [
      {
        name: 'Cuba libre',
        price: 35,
        description: 'Ron Botrán Añejo, Coca-Cola y limón',
        recipe: { 'Ron Botrán Añejo': 60, 'Coca-Cola 355 ml': 1, Limón: 1 },
      },
      { name: 'Trago de Zacapa 23', price: 60, recipe: { 'Ron Zacapa 23': 60 } },
    ],
  },
  {
    category: 'Sin alcohol',
    color: 'secondary',
    products: [
      { name: 'Agua pura', price: 10, recipe: { 'Agua pura 600 ml': 1 } },
      { name: 'Coca-Cola', price: 12, recipe: { 'Coca-Cola 355 ml': 1 } },
      { name: 'Agua mineral', price: 12, recipe: { 'Agua mineral Salutaris 355 ml': 1 } },
      { name: 'Limonada natural', price: 15, recipe: { Limón: 3, Azúcar: 20 } },
    ],
  },
  {
    category: 'Boquitas',
    color: 'danger',
    products: [
      { name: 'Nachos con queso', price: 30, recipe: { Totopos: 120, 'Queso para nachos': 80 } },
      { name: 'Maní salado', price: 10, recipe: { 'Maní salado': 80 } },
      { name: 'Papalinas', price: 10, recipe: { 'Papalinas (bolsa)': 1 } },
    ],
  },
];

// Grupos de extras: [opción, recargo, consumo de inventario]
const modifierGroups: {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: [string, number, Recipe][];
}[] = [
  {
    name: BEER,
    minSelect: 1,
    maxSelect: 1,
    options: [
      ['Gallo', 0, { 'Cerveza Gallo 350 ml': 1 }],
      ['Cabro', 0, { 'Cerveza Cabro 350 ml': 1 }],
      ['Monte Carlo', 2, { 'Cerveza Monte Carlo 350 ml': 1 }],
      ['Corona', 5, { 'Corona 355 ml': 1 }],
      ['Modelo Especial', 5, { 'Modelo Especial 355 ml': 1 }],
    ],
  },
  {
    name: RIM,
    minSelect: 0,
    maxSelect: 1,
    options: [
      ['Sal y limón', 0, { Sal: 10 }],
      ['Tajín', 3, { Tajín: 10 }],
      ['Chamoy y tajín', 5, { Chamoy: 15, Tajín: 10 }],
      ['Sin escarchado', 0, {}],
    ],
  },
  {
    name: EXTRAS,
    minSelect: 0,
    maxSelect: 3,
    options: [
      ['Camarones', 15, { 'Camarón cocido': 60 }],
      ['Doble clamato', 8, { Clamato: 120 }],
      ['Extra picante', 0, { 'Salsa picante': 10 }],
    ],
  },
];

// Compras de ejemplo: [artículo, cantidad, total de la línea]. Su costo coincide con el de inventoryRows.
const seedPurchases: {
  supplier: string;
  daysAgo: number;
  invoice: string | null;
  lines: [string, number, number][];
}[] = [
  {
    supplier: 'Cervecería Centro Americana',
    daysAgo: 3,
    invoice: 'A-10234',
    lines: [
      ['Cerveza Gallo 350 ml', 48, 360],
      ['Cerveza Cabro 350 ml', 24, 174],
      ['Cerveza Monte Carlo 350 ml', 24, 192],
    ],
  },
  {
    supplier: 'Abarrotería La Terminal',
    daysAgo: 1,
    invoice: null,
    lines: [
      ['Limón', 100, 50],
      ['Clamato', 946, 22.5],
      ['Tajín', 200, 18],
    ],
  },
];

/** Instante a las 10:00 de Guatemala de hace N días, y su fecha de negocio. */
function daysAgo(n: number) {
  const date = getBusinessDate(new Date(Date.now() - n * 86400000));
  return { date, at: new Date(`${date}T16:00:00.000Z`) };
}

async function wipe() {
  // Orden inverso a las dependencias.
  await prisma.inventoryMovement.deleteMany();
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.tab.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.productModifierGroup.deleteMany();
  await prisma.modifierOptionComponent.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.productComponent.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  await wipe();

  await prisma.setting.create({ data: { id: 1, businessName: 'SanfeFer' } });

  // ── Usuarios ──
  const hash = (s: string) => bcrypt.hash(s, 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Fernanda Sandoval',
      username: 'admin',
      role: 'ADMIN',
      passwordHash: await hash('Sanfefer2026'),
      pinHash: await hash('9999'),
    },
  });
  const sellers = [
    ['Luis García', 'luis', '1234'],
    ['Ana Morales', 'ana', '2345'],
    ['Marta Cifuentes', 'marta', '3456'],
    ['Carlos Ramírez', 'carlos', '4567'],
  ] as const;
  for (const [name, username, pin] of sellers) {
    await prisma.user.create({
      data: { name, username, role: 'SELLER', pinHash: await hash(pin) },
    });
  }

  // ── Mesas ──
  const tables = [
    ...Array.from({ length: 6 }, (_, i) => ({ name: `Mesa ${i + 1}`, zone: 'Salón' })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Terraza ${i + 1}`, zone: 'Terraza' })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Barra ${i + 1}`, zone: 'Barra' })),
  ];
  await prisma.diningTable.createMany({ data: tables.map((t, i) => ({ ...t, sortOrder: i })) });

  // ── Proveedores ──
  await prisma.supplier.createMany({
    data: [
      { name: 'Cervecería Centro Americana', contactName: 'Ventas zona 1', phone: '2289-1234' },
      {
        name: 'Distribuidora de Licores del Centro',
        contactName: 'Jorge Pérez',
        phone: '5512-3344',
      },
      {
        name: 'Abarrotería La Terminal',
        contactName: 'Doña Rosa',
        phone: '4021-7788',
        notes: 'Limones, salsas y boquitas',
      },
      {
        name: 'Mariscos del Pacífico',
        phone: '5590-1122',
        notes: 'Camarón cocido, pedido mínimo 2 lb',
      },
    ],
  });

  // ── Inventario con stock inicial (deja su movimiento en el historial) ──
  // Parte del stock llega por las compras de ejemplo; el resto es el stock inicial de hace una semana.
  const purchased = new Map<string, number>();
  for (const p of seedPurchases)
    for (const [name, qty] of p.lines) purchased.set(name, (purchased.get(name) ?? 0) + qty);
  const itemIds = new Map<string, number>();
  const runningStock = new Map<string, number>();
  for (const [name, kind, unit, stock, minStock, cost] of inventoryRows) {
    const item = await prisma.inventoryItem.create({
      data: { name, kind, unit, stock: D(stock), minStock: D(minStock), averageCost: D(cost) },
    });
    itemIds.set(name, item.id);
    const initial = stock - (purchased.get(name) ?? 0);
    if (initial < 0) throw new Error(`El seed compra más ${name} de lo que hay en stock`);
    runningStock.set(name, initial);
    if (initial > 0) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: 'INITIAL',
          quantity: D(initial),
          unitCost: D(cost),
          stockAfter: D(initial),
          reason: 'Stock inicial',
          userId: admin.id,
          createdAt: daysAgo(7).at,
        },
      });
    }
  }
  const itemId = (name: string) => {
    const id = itemIds.get(name);
    if (!id) throw new Error(`Artículo de inventario desconocido en el seed: ${name}`);
    return id;
  };
  const components = (recipe: Recipe) =>
    Object.entries(recipe).map(([name, quantity]) => ({
      inventoryItemId: itemId(name),
      quantity: D(quantity),
    }));

  // ── Compras de ejemplo ──
  for (const p of seedPurchases) {
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { name: p.supplier } });
    const { date, at } = daysAgo(p.daysAgo);
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        purchasedAt: new Date(`${date}T00:00:00.000Z`),
        invoiceNumber: p.invoice,
        total: D(p.lines.reduce((sum, [, , total]) => sum + total, 0)),
        createdById: admin.id,
        createdAt: at,
      },
    });
    for (const [name, qty, total] of p.lines) {
      const unitCost = new Prisma.Decimal(total).div(qty).toDecimalPlaces(4);
      const line = await prisma.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          inventoryItemId: itemIds.get(name)!,
          quantity: D(qty),
          unitCost,
          subtotal: D(total),
        },
      });
      const after = runningStock.get(name)! + qty;
      runningStock.set(name, after);
      await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: itemIds.get(name)!,
          type: 'PURCHASE',
          quantity: D(qty),
          unitCost,
          stockAfter: D(after),
          reason: `Compra #${purchase.id} · ${p.supplier}${p.invoice ? ` · factura ${p.invoice}` : ''}`,
          userId: admin.id,
          purchaseItemId: line.id,
          createdAt: at,
        },
      });
    }
  }

  // ── Grupos de extras ──
  const groupIds = new Map<string, number>();
  for (const [gi, group] of modifierGroups.entries()) {
    const created = await prisma.modifierGroup.create({
      data: {
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: gi,
        options: {
          create: group.options.map(([name, delta, recipe], oi) => ({
            name,
            priceDelta: D(delta),
            sortOrder: oi,
            components: { create: components(recipe) },
          })),
        },
      },
    });
    groupIds.set(group.name, created.id);
  }

  // ── Categorías y productos ──
  for (const [ci, cat] of menu.entries()) {
    const category = await prisma.category.create({
      data: { name: cat.category, color: cat.color, sortOrder: ci },
    });
    for (const [pi, p] of cat.products.entries()) {
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: p.name,
          description: p.description,
          price: D(p.price),
          sortOrder: pi,
          recipe: { create: components(p.recipe) },
          modifierGroups: {
            create: (p.groups ?? []).map((g, sortOrder) => ({
              groupId: groupIds.get(g)!,
              sortOrder,
            })),
          },
        },
      });
    }
  }

  const productCount = menu.reduce((n, c) => n + c.products.length, 0);
  console.log('✅ Datos de prueba cargados');
  console.log(
    `   ${seedPurchases.length} compras · ${sellers.length + 1} usuarios · ${tables.length} mesas · ${inventoryRows.length} artículos · ${productCount} productos`,
  );
  console.log('   Admin:      usuario "admin", contraseña "Sanfefer2026" (PIN 9999)');
  console.log('   Vendedores: luis/1234 · ana/2345 · marta/3456 · carlos/4567');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
