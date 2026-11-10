import { Prisma, type MovementType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Bloquea las filas (SELECT … FOR UPDATE) para que dos operaciones no pisen el mismo stock. */
export async function lockInventoryItems(tx: Tx, ids: number[]) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort((a, b) => a - b); // mismo orden siempre: evita interbloqueos
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

/** Entradas que fijan el costo de compra del artículo (el de la más reciente). */
const COST_SETTING: MovementType[] = ['INITIAL', 'PURCHASE', 'MANUAL_IN'];

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
  if (change.type === 'PURCHASE_VOID') {
    // Al anular una compra, el costo vuelve al de la entrada vigente más reciente.
    const previous = await tx.inventoryMovement.findFirst({
      where: {
        inventoryItemId: item.id,
        type: { in: COST_SETTING },
        unitCost: { not: null },
        // Entradas sin compra (inicial, manual) o de compras vigentes; nunca la línea que se anula.
        // (Un NOT sobre purchaseItemId descartaría también las filas sin compra: en SQL, NULL <> x no es verdadero.)
        OR: [
          { purchaseItemId: null },
          {
            purchaseItemId: change.purchaseItemId ? { not: change.purchaseItemId } : undefined,
            purchaseItem: { purchase: { status: 'RECEIVED' } },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (previous?.unitCost) purchaseCost = previous.unitCost;
  } else if (change.delta.gt(0) && change.unitCost != null && COST_SETTING.includes(change.type)) {
    // Costo de compra = lo que se pagó en la última entrada con costo.
    purchaseCost = change.unitCost.toDecimalPlaces(4);
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
