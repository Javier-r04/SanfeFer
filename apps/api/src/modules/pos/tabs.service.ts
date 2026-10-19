import { Prisma } from '@prisma/client';
import {
  UNIT_LABELS,
  validateModifierSelection,
  type FloorDto,
  type OpenTabInput,
  type SendOrderInput,
  type UpdateTabInput,
  openTabSchema,
  sendOrderSchema,
} from '@sanfefer/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { productInclude } from '../catalog/catalog.mapper';
import { getSettingsRow } from '../settings/settings.service';
import { applyStockChange, lockInventoryItems } from '../inventory/stock';
import { tabDetailInclude, tabSummaryInclude, toTabDto, toTabSummary } from './pos.mapper';

const D = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

export async function getFloor(): Promise<FloorDto> {
  const [tables, tabs] = await Promise.all([
    prisma.diningTable.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.tab.findMany({
      where: { status: 'OPEN' },
      include: tabSummaryInclude,
      orderBy: { id: 'asc' },
    }),
  ]);
  const summaries = tabs.map(toTabSummary);
  return {
    tables: tables.map((t) => ({
      id: t.id,
      name: t.name,
      zone: t.zone,
      tabs: summaries.filter((s) => s.tableId === t.id),
    })),
    walkIns: summaries.filter((s) => s.tableId === null),
  };
}

export async function getTab(id: number) {
  const tab = await prisma.tab.findUnique({ where: { id }, include: tabDetailInclude });
  if (!tab) throw notFound('La cuenta no existe.');
  const siblings =
    tab.tableId !== null && tab.status === 'OPEN'
      ? await prisma.tab.findMany({
          where: { tableId: tab.tableId, status: 'OPEN' },
          include: tabSummaryInclude,
          orderBy: { id: 'asc' },
        })
      : [];
  return toTabDto(tab, siblings);
}

async function assertTable(tableId: number) {
  const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
  if (!table || !table.active)
    throw badRequest('La mesa no existe o está desactivada.', { tableId: 'Mesa no disponible' });
  return table;
}

/** "Cliente N" con el primer número libre entre las cuentas abiertas de la mesa. */
async function nextCustomerName(tableId: number) {
  const open = await prisma.tab.findMany({
    where: { tableId, status: 'OPEN' },
    select: { customerName: true },
  });
  const used = new Set(open.map((t) => t.customerName.toLowerCase()));
  let n = 1;
  while (used.has(`cliente ${n}`)) n++;
  return `Cliente ${n}`;
}

export async function openTab(raw: OpenTabInput, userId: number) {
  const input = openTabSchema.parse(raw);
  if (input.tableId !== null) await assertTable(input.tableId);
  const settings = await getSettingsRow();
  const tab = await prisma.tab.create({
    data: {
      tableId: input.tableId,
      customerName: input.customerName ?? (await nextCustomerName(input.tableId!)),
      openedById: userId,
      serviceChargeRate: settings.serviceChargeByDefault ? settings.serviceChargeRate : null,
    },
  });
  return getTab(tab.id);
}

async function getOpenTab(id: number) {
  const tab = await prisma.tab.findUnique({ where: { id } });
  if (!tab) throw notFound('La cuenta no existe.');
  if (tab.status !== 'OPEN') {
    throw conflict(
      tab.status === 'PAID' ? 'Esta cuenta ya se cobró.' : 'Esta cuenta fue cancelada.',
    );
  }
  return tab;
}

export async function updateTab(id: number, input: UpdateTabInput) {
  await getOpenTab(id);
  if (input.tableId) await assertTable(input.tableId);
  await prisma.tab.update({
    where: { id },
    data: { customerName: input.customerName, tableId: input.tableId },
  });
  return getTab(id);
}

/** Cancela una cuenta abierta por error (sin productos vigentes): libera la mesa. */
export async function cancelTab(id: number, reason: string | undefined, userId: number) {
  await getOpenTab(id);
  const live = await prisma.orderItem.count({ where: { tabId: id, status: { not: 'CANCELLED' } } });
  if (live > 0) throw conflict('La cuenta tiene productos. Cancélalos primero o cóbrala.');
  await prisma.tab.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelReason: reason || 'Cuenta abierta por error',
      closedAt: new Date(),
      closedById: userId,
    },
  });
}

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Precio, costo y consumo por unidad de una línea, validando sus extras. */
function priceLine(product: ProductRow, optionIds: number[], index: number) {
  const groups = product.modifierGroups
    .map(({ group }) => group)
    .filter((g) => g.active)
    .map((g) => ({ ...g, options: g.options.filter((o) => o.active) }));
  const { errors, unknown } = validateModifierSelection(groups, optionIds);
  if (unknown.length) {
    throw badRequest(`Un extra de ${product.name} ya no está disponible. Vuelve a elegirlo.`, {
      [`items.${index}.modifierOptionIds`]: 'Extra no disponible',
    });
  }
  const firstError = Object.values(errors)[0];
  if (firstError)
    throw badRequest(`${product.name}: ${firstError}`, {
      [`items.${index}.modifierOptionIds`]: firstError,
    });

  const chosen = groups.flatMap((g) =>
    g.options.filter((o) => optionIds.includes(o.id)).map((o) => ({ group: g, option: o })),
  );
  const consumption = new Map<number, Prisma.Decimal>();
  const add = (itemId: number, qty: Prisma.Decimal) =>
    consumption.set(itemId, (consumption.get(itemId) ?? D(0)).plus(qty));
  for (const c of product.recipe) add(c.inventoryItemId, c.quantity);
  for (const { option } of chosen)
    for (const c of option.components) add(c.inventoryItemId, c.quantity);

  return {
    unitPrice: chosen.reduce((sum, { option }) => sum.plus(option.priceDelta), D(product.price)),
    consumption,
    modifiers: chosen.map(({ group, option }) => ({
      optionId: option.id,
      groupName: group.name,
      optionName: option.name,
      priceDelta: option.priceDelta,
    })),
  };
}

/**
 * Envía una comanda a barra: crea los ítems y descuenta el inventario de cada uno
 * (receta + extras) en una sola transacción.
 */
export async function sendOrder(tabId: number, raw: SendOrderInput, userId: number) {
  const input = sendOrderSchema.parse(raw);
  const tab = await getOpenTab(tabId);

  const productIds = [...new Set(input.items.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: productInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = input.items.map((line, index) => {
    const product = byId.get(line.productId);
    if (!product || !product.active) {
      throw badRequest('Un producto de la orden ya no está disponible.', {
        [`items.${index}.productId`]: 'Producto no disponible',
      });
    }
    return { ...line, product, ...priceLine(product, line.modifierOptionIds, index) };
  });

  const allowNegative = (await getSettingsRow()).allowNegativeStock;
  const itemIds = [...new Set(lines.flatMap((l) => [...l.consumption.keys()]))];
  const table = tab.tableId
    ? await prisma.diningTable.findUnique({ where: { id: tab.tableId } })
    : null;
  const where = table ? `${table.name} · ${tab.customerName}` : tab.customerName;

  const result = await prisma.$transaction(async (tx) => {
    await lockInventoryItems(tx, itemIds);
    const stock = new Map(
      (await tx.inventoryItem.findMany({ where: { id: { in: itemIds } } })).map((i) => [i.id, i]),
    );

    if (!allowNegative) {
      const needed = new Map<number, Prisma.Decimal>();
      for (const l of lines) {
        for (const [itemId, qty] of l.consumption)
          needed.set(itemId, (needed.get(itemId) ?? D(0)).plus(qty.times(l.quantity)));
      }
      const short = [...needed].filter(([itemId, qty]) => stock.get(itemId)!.stock.lt(qty));
      if (short.length) {
        throw conflict(
          `No hay suficiente inventario: ${short
            .map(([itemId]) => {
              const i = stock.get(itemId)!;
              return `${i.name} (hay ${Number(i.stock)} ${UNIT_LABELS[i.unit]})`;
            })
            .join(', ')}.`,
        );
      }
    }

    const order = await tx.order.create({ data: { tabId, createdById: userId } });
    for (const l of lines) {
      const unitCost = [...l.consumption].reduce(
        (sum, [itemId, qty]) => sum.plus(qty.times(stock.get(itemId)!.averageCost)),
        D(0),
      );
      const item = await tx.orderItem.create({
        data: {
          tabId,
          orderId: order.id,
          productId: l.product.id,
          productName: l.product.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitCost: unitCost.toDecimalPlaces(4),
          note: l.note,
          consumption: [...l.consumption].map(([inventoryItemId, quantity]) => ({
            inventoryItemId,
            quantity: Number(quantity),
          })),
          modifiers: { create: l.modifiers },
        },
      });
      for (const [itemId, qty] of l.consumption) {
        await applyStockChange(tx, {
          itemId,
          delta: qty.times(l.quantity).neg(),
          type: 'SALE',
          reason: `Comanda #${order.id} · ${where}`,
          userId,
          orderItemId: item.id,
        });
      }
    }
    const after = await tx.inventoryItem.findMany({
      where: { id: { in: itemIds }, stock: { lt: 0 } },
    });
    return {
      orderId: order.id,
      stockWarnings: after.map(
        (i) => `${i.name} quedó en ${Number(i.stock)} ${UNIT_LABELS[i.unit]}`,
      ),
    };
  });

  return { tab: await getTab(tabId), ...result };
}
