import { Prisma, type MovementType } from '@prisma/client';

type Tx = Prisma.TransactionClient;
const Decimal = Prisma.Decimal;

/** Bloquea las filas (SELECT … FOR UPDATE) para que dos operaciones no pisen el mismo stock. */
export async function lockInventoryItems(tx: Tx, ids: number[]) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort((a, b) => a - b); // mismo orden siempre: evita interbloqueos
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

/** Entradas cuyo costo se mezcla en el costo promedio ponderado. */
const COST_AFFECTING: MovementType[] = ['INITIAL', 'PURCHASE', 'MANUAL_IN'];

export interface StockChange {
  itemId: number;
  /** Positivo = entra, negativo = sale. En la unidad base del artículo. */
  delta: Prisma.Decimal;
  type: MovementType;
  userId: number;
  /** Costo por unidad de la entrada; si falta se registra el costo promedio actual. */
  unitCost?: Prisma.Decimal | null;
  reason?: string | null;
  purchaseItemId?: number;
  orderItemId?: number;
}

/**
 * Único punto que modifica el stock: actualiza el artículo y deja el movimiento en el historial.
 * Debe llamarse dentro de una transacción.
 */
export async function applyStockChange(tx: Tx, change: StockChange) {
  await lockInventoryItems(tx, [change.itemId]);
  const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: change.itemId } });

  const stockAfter = item.stock.plus(change.delta);
  let averageCost = item.averageCost;
  if (change.delta.gt(0) && change.unitCost != null && COST_AFFECTING.includes(change.type)) {
    // El stock negativo (ventas sin existencia) no debe arrastrar el promedio.
    const previous = Decimal.max(item.stock, 0);
    const total = previous.plus(change.delta);
    averageCost = previous
      .times(item.averageCost)
      .plus(change.delta.times(change.unitCost))
      .div(total)
      .toDecimalPlaces(4);
  }

  const updated = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { stock: stockAfter, averageCost },
  });
  const movement = await tx.inventoryMovement.create({
    data: {
      inventoryItemId: item.id,
      type: change.type,
      quantity: change.delta,
      unitCost: change.unitCost ?? item.averageCost,
      stockAfter,
      reason: change.reason ?? null,
      userId: change.userId,
      purchaseItemId: change.purchaseItemId,
      orderItemId: change.orderItemId,
    },
  });
  return { item: updated, movement };
}
