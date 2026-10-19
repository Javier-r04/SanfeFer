import { Prisma } from '@prisma/client';
import {
  purchaseInputSchema,
  UNIT_LABELS,
  type PurchaseInput,
  type PurchasesPage,
  type PurchasesQuery,
} from '@sanfefer/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { applyStockChange, lockInventoryItems } from '../inventory/stock';
import {
  purchaseDetailInclude,
  purchaseSummaryInclude,
  toPurchaseDto,
  toPurchaseSummary,
} from './purchases.mapper';

const D = (v: number | string) => new Prisma.Decimal(v);
/** Fecha de negocio (AAAA-MM-DD) para columnas @db.Date. */
const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function listPurchases(query: PurchasesQuery): Promise<PurchasesPage> {
  const purchasedAt: Prisma.DateTimeFilter = {};
  if (query.from) purchasedAt.gte = asDate(query.from);
  if (query.to) purchasedAt.lte = asDate(query.to);
  const where: Prisma.PurchaseWhereInput = {
    supplierId: query.supplierId,
    status: query.status,
    purchasedAt: query.from || query.to ? purchasedAt : undefined,
  };

  const [rows, sum] = await Promise.all([
    prisma.purchase.findMany({
      where: { ...where, id: query.cursor ? { lt: query.cursor } : undefined },
      include: purchaseSummaryInclude,
      orderBy: [{ id: 'desc' }],
      take: query.limit + 1,
    }),
    prisma.purchase.aggregate({ where: { ...where, status: 'RECEIVED' }, _sum: { total: true } }),
  ]);
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  return {
    items: items.map(toPurchaseSummary),
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
    totalReceived: Number(sum._sum.total ?? 0),
  };
}

export async function getPurchase(id: number) {
  const p = await prisma.purchase.findUnique({ where: { id }, include: purchaseDetailInclude });
  if (!p) throw notFound('La compra no existe.');
  return toPurchaseDto(p);
}

/**
 * Registra la compra y sube el inventario en una sola transacción:
 * si algo falla, no queda ni la compra ni el stock a medias.
 */
export async function createPurchase(raw: PurchaseInput, userId: number) {
  const input = purchaseInputSchema.parse(raw);

  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier)
    throw badRequest('El proveedor no existe.', { supplierId: 'El proveedor no existe' });
  if (!supplier.active) {
    throw badRequest(`${supplier.name} está desactivado. Actívalo para registrarle compras.`, {
      supplierId: 'Proveedor desactivado',
    });
  }

  const ids = input.items.map((l) => l.inventoryItemId);
  const items = await prisma.inventoryItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(items.map((i) => [i.id, i]));
  input.items.forEach((line, i) => {
    const item = byId.get(line.inventoryItemId);
    if (!item) {
      throw badRequest('Un artículo de la compra no existe.', {
        [`items.${i}.inventoryItemId`]: 'Este artículo ya no existe',
      });
    }
    if (!item.active) {
      throw badRequest(`${item.name} está desactivado. Actívalo en Inventario para comprarlo.`, {
        [`items.${i}.inventoryItemId`]: 'Artículo desactivado',
      });
    }
  });

  const lines = input.items.map((l) => {
    const subtotal = D(l.lineTotal);
    return { ...l, subtotal, unitCost: subtotal.div(l.quantity).toDecimalPlaces(4) };
  });
  const total = lines.reduce((sum, l) => sum.plus(l.subtotal), D(0));

  const id = await prisma.$transaction(async (tx) => {
    await lockInventoryItems(tx, ids);
    const purchase = await tx.purchase.create({
      data: {
        supplierId: input.supplierId,
        purchasedAt: asDate(input.purchasedAt),
        invoiceNumber: input.invoiceNumber,
        notes: input.notes,
        total,
        createdById: userId,
      },
    });
    for (const l of lines) {
      const line = await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          inventoryItemId: l.inventoryItemId,
          quantity: D(l.quantity),
          unitCost: l.unitCost,
          subtotal: l.subtotal,
        },
      });
      await applyStockChange(tx, {
        itemId: l.inventoryItemId,
        delta: D(l.quantity),
        type: 'PURCHASE',
        unitCost: l.unitCost,
        reason: `Compra #${purchase.id} · ${supplier.name}${input.invoiceNumber ? ` · factura ${input.invoiceNumber}` : ''}`,
        userId,
        purchaseItemId: line.id,
      });
    }
    return purchase.id;
  });
  return getPurchase(id);
}

/** Anula la compra y descuenta del inventario lo que había entrado. */
export async function voidPurchase(id: number, reason: string, userId: number) {
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id },
      include: { items: { include: { inventoryItem: true } } },
    });
    if (!purchase) throw notFound('La compra no existe.');
    if (purchase.status === 'VOIDED') throw conflict('Esta compra ya estaba anulada.');

    await lockInventoryItems(
      tx,
      purchase.items.map((i) => i.inventoryItemId),
    );
    // Se relee el stock ya bloqueado: si lo comprado ya se usó, anular dejaría stock negativo.
    const current = await tx.inventoryItem.findMany({
      where: { id: { in: purchase.items.map((i) => i.inventoryItemId) } },
    });
    const stockById = new Map(current.map((c) => [c.id, c]));
    const short = purchase.items.filter((i) =>
      stockById.get(i.inventoryItemId)!.stock.lt(i.quantity),
    );
    if (short.length) {
      const detail = short
        .map((i) => {
          const item = stockById.get(i.inventoryItemId)!;
          return `${item.name} (hay ${Number(item.stock)} ${UNIT_LABELS[item.unit]}, la compra trajo ${Number(i.quantity)})`;
        })
        .join('; ');
      throw conflict(
        `No se puede anular: ya se usó parte de lo comprado. ${detail}. Registra un ajuste en Inventario si hace falta.`,
      );
    }

    await tx.purchase.update({
      where: { id },
      data: { status: 'VOIDED', voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
    for (const line of purchase.items) {
      await applyStockChange(tx, {
        itemId: line.inventoryItemId,
        delta: line.quantity.neg(),
        type: 'PURCHASE_VOID',
        unitCost: line.unitCost,
        reason: `Anulación de compra #${id}: ${reason}`,
        userId,
        purchaseItemId: line.id,
      });
    }
  });
  return getPurchase(id);
}
