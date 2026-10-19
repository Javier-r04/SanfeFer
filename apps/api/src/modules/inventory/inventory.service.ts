import { Prisma } from '@prisma/client';
import {
  businessDayRange,
  type InventoryItemCreateInput,
  type InventoryItemUpdateInput,
  type InventorySummary,
  type MovementInput,
  type MovementsQuery,
  type Page,
  type MovementDto,
  UNIT_LABELS,
} from '@sanfefer/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toInventoryItemDto, toMovementDto } from './inventory.mapper';
import { applyStockChange, lockInventoryItems } from './stock';

const D = (v: number) => new Prisma.Decimal(v);

const usageCount = {
  _count: { select: { productComponents: true, modifierComponents: true } },
} satisfies Prisma.InventoryItemInclude;

type ItemWithUsage = Prisma.InventoryItemGetPayload<{ include: typeof usageCount }>;
const toDto = (i: ItemWithUsage) =>
  toInventoryItemDto(i, i._count.productComponents + i._count.modifierComponents);

export async function listItems(filters: {
  kind?: 'SUPPLY' | 'RESALE';
  alert?: boolean;
  includeInactive?: boolean;
  q?: string;
}) {
  const items = await prisma.inventoryItem.findMany({
    where: {
      kind: filters.kind,
      active: filters.includeInactive ? undefined : true,
      name: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
      // Comparación entre columnas: stock <= stock mínimo.
      stock: filters.alert ? { lte: prisma.inventoryItem.fields.minStock } : undefined,
    },
    include: usageCount,
    orderBy: [{ kind: 'desc' }, { name: 'asc' }],
  });
  return items.map(toDto);
}

export async function getSummary(): Promise<InventorySummary> {
  const items = (
    await prisma.inventoryItem.findMany({ where: { active: true }, include: usageCount })
  ).map(toDto);
  return {
    totalItems: items.length,
    lowCount: items.filter((i) => i.status === 'LOW').length,
    outCount: items.filter((i) => i.status === 'OUT').length,
    stockValue: Number(items.reduce((sum, i) => sum + i.stockValue, 0).toFixed(2)),
  };
}

async function getItemOrThrow(id: number) {
  const item = await prisma.inventoryItem.findUnique({ where: { id }, include: usageCount });
  if (!item) throw notFound('El artículo de inventario no existe.');
  return item;
}

export async function getItem(id: number) {
  return toDto(await getItemOrThrow(id));
}

export async function createItem(input: InventoryItemCreateInput, userId: number) {
  const initialStock = input.initialStock ?? 0;
  const initialCost = input.initialCost ?? 0;
  const id = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        name: input.name,
        kind: input.kind,
        unit: input.unit,
        minStock: D(input.minStock),
        averageCost: D(initialCost),
      },
    });
    if (initialStock > 0) {
      await applyStockChange(tx, {
        itemId: item.id,
        delta: D(initialStock),
        type: 'INITIAL',
        unitCost: D(initialCost),
        reason: 'Stock inicial',
        userId,
      });
    }
    return item.id;
  });
  return getItem(id);
}

export async function updateItem(id: number, input: InventoryItemUpdateInput) {
  const item = await getItemOrThrow(id);
  if (input.unit && input.unit !== item.unit) {
    const movements = await prisma.inventoryMovement.count({ where: { inventoryItemId: id } });
    const used = item._count.productComponents + item._count.modifierComponents;
    if (movements > 0 || used > 0) {
      throw conflict(
        'No puedes cambiar la unidad: el artículo ya tiene movimientos o se usa en recetas. Crea un artículo nuevo con la unidad correcta.',
      );
    }
  }
  await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      unit: input.unit,
      minStock: input.minStock === undefined ? undefined : D(input.minStock),
      active: input.active,
    },
  });
  return getItem(id);
}

export async function deleteItem(id: number) {
  const item = await getItemOrThrow(id);
  const [movements, purchases] = await Promise.all([
    prisma.inventoryMovement.count({ where: { inventoryItemId: id } }),
    prisma.purchaseItem.count({ where: { inventoryItemId: id } }),
  ]);
  const used = item._count.productComponents + item._count.modifierComponents;
  if (used > 0) {
    throw conflict(
      `Se usa en ${used} receta${used === 1 ? '' : 's'}. Quítalo de esas recetas o desactívalo.`,
    );
  }
  if (movements > 0 || purchases > 0) {
    throw conflict('Tiene historial de movimientos. Desactívalo en lugar de eliminarlo.');
  }
  await prisma.inventoryItem.delete({ where: { id } });
}

const fmt = (n: Prisma.Decimal, unit: keyof typeof UNIT_LABELS) =>
  `${Number(n).toLocaleString('es-GT', { maximumFractionDigits: 3 })} ${UNIT_LABELS[unit]}`;

export async function createMovement(itemId: number, input: MovementInput, userId: number) {
  await getItemOrThrow(itemId);
  const movement = await prisma.$transaction(async (tx) => {
    // Se bloquea antes de leer para calcular con el stock real del momento.
    await lockInventoryItems(tx, [itemId]);
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    if (!item.active)
      throw conflict('El artículo está desactivado. Actívalo para registrar movimientos.');

    switch (input.type) {
      case 'MANUAL_IN':
        return applyStockChange(tx, {
          itemId,
          delta: D(input.quantity),
          type: 'MANUAL_IN',
          unitCost: input.unitCost === undefined ? null : D(input.unitCost),
          reason: input.reason || null,
          userId,
        });
      case 'WASTE': {
        const quantity = D(input.quantity);
        if (quantity.gt(item.stock)) {
          throw badRequest(`No hay suficiente stock: hay ${fmt(item.stock, item.unit)}.`, {
            quantity: `Máximo ${fmt(Prisma.Decimal.max(item.stock, 0), item.unit)}`,
          });
        }
        return applyStockChange(tx, {
          itemId,
          delta: quantity.neg(),
          type: 'WASTE',
          reason: input.reason,
          userId,
        });
      }
      case 'ADJUSTMENT': {
        const delta = D(input.countedStock).minus(item.stock);
        if (delta.isZero()) {
          throw badRequest('El conteo coincide con el stock actual; no hay nada que ajustar.', {
            countedStock: 'Coincide con el stock actual',
          });
        }
        return applyStockChange(tx, {
          itemId,
          delta,
          type: 'ADJUSTMENT',
          reason: input.reason || `Conteo físico: ${fmt(D(input.countedStock), item.unit)}`,
          userId,
        });
      }
    }
  });
  const full = await prisma.inventoryMovement.findUniqueOrThrow({
    where: { id: movement.movement.id },
    include: { inventoryItem: true, user: true },
  });
  return { movement: toMovementDto(full), item: await getItem(itemId) };
}

export async function listMovements(query: MovementsQuery): Promise<Page<MovementDto>> {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = businessDayRange(query.from).start;
  if (query.to) createdAt.lt = businessDayRange(query.to).end;

  const rows = await prisma.inventoryMovement.findMany({
    where: {
      inventoryItemId: query.itemId,
      type: query.type,
      createdAt: query.from || query.to ? createdAt : undefined,
      id: query.cursor ? { lt: query.cursor } : undefined,
    },
    include: {
      inventoryItem: { select: { id: true, name: true, unit: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { id: 'desc' },
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  return {
    items: items.map(toMovementDto),
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}
