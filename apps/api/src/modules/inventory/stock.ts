import { Prisma, type MovementType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Bloquea las filas (SELECT … FOR UPDATE) para que dos operaciones no pisen el mismo stock. */
export async function lockInventoryItems(tx: Tx, ids: number[]) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort((a, b) => a - b); // mismo orden siempre: evita interbloqueos
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

/** Entradas que promedian el costo de compra del artículo (las que traen costo por unidad). */
const COST_SETTING: MovementType[] = ['INITIAL', 'PURCHASE', 'MANUAL_IN'];

/**
 * Costo promedio ponderado por cantidad: (existencia × costo + entrada × costo de la entrada)
 * ÷ existencia nueva. Si no había existencia (o era negativa), el costo es el de la entrada.
 */
export function averageCostIn(
  stockBefore: Prisma.Decimal,
  costBefore: Prisma.Decimal,
  qty: Prisma.Decimal,
  unitCost: Prisma.Decimal,
) {
  if (stockBefore.lte(0)) return unitCost.toDecimalPlaces(4);
  return stockBefore
    .times(costBefore)
    .plus(qty.times(unitCost))
    .div(stockBefore.plus(qty))
    .toDecimalPlaces(4);
}

/**
 * Deshace una entrada del promedio (anular una compra): saca su cantidad y su costo.
 * Si ya no queda existencia, el costo se conserva.
 */
export function averageCostOut(
  stockBefore: Prisma.Decimal,
  costBefore: Prisma.Decimal,
  qty: Prisma.Decimal,
  unitCost: Prisma.Decimal,
) {
  const remaining = stockBefore.minus(qty);
  if (remaining.lte(0)) return costBefore;
  const cost = stockBefore.times(costBefore).minus(qty.times(unitCost)).div(remaining);
  return cost.lt(0) ? new Prisma.Decimal(0) : cost.toDecimalPlaces(4);
}

export interface StockChange {
  itemId: number;
  /** Positivo = entra, negativo = sale. En la unidad base del artículo. */
  delta: Prisma.Decimal;
  type: MovementType;
  userId: number;
  /** Costo por unidad de la entrada; si falta se registra el costo de compra actual. */
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
  let purchaseCost = item.purchaseCost;
  if (change.type === 'PURCHASE_VOID' && change.unitCost != null) {
    // Anular una compra la saca del promedio, como si no hubiera entrado.
    purchaseCost = averageCostOut(
      item.stock,
      item.purchaseCost,
      change.delta.neg(),
      change.unitCost,
    );
  } else if (change.delta.gt(0) && change.unitCost != null && COST_SETTING.includes(change.type)) {
    // Costo de compra = promedio ponderado de lo que hay y lo que entra.
    purchaseCost = averageCostIn(item.stock, item.purchaseCost, change.delta, change.unitCost);
  }

  const updated = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { stock: stockAfter, purchaseCost },
  });
  const movement = await tx.inventoryMovement.create({
    data: {
      inventoryItemId: item.id,
      type: change.type,
      quantity: change.delta,
      unitCost: change.unitCost ?? item.purchaseCost,
      stockAfter,
      reason: change.reason ?? null,
      userId: change.userId,
      purchaseItemId: change.purchaseItemId,
      orderItemId: change.orderItemId,
    },
  });
  return { item: updated, movement };
}
