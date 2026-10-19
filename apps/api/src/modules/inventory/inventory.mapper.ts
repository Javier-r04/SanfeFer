import type { InventoryItem, InventoryMovement, User } from '@prisma/client';
import { stockStatus, type InventoryItemDto, type MovementDto } from '@sanfefer/shared';

const round = (n: number, places: number) => Number(n.toFixed(places));

export function toInventoryItemDto(item: InventoryItem, usedIn: number): InventoryItemDto {
  const stock = Number(item.stock);
  const minStock = Number(item.minStock);
  const averageCost = Number(item.averageCost);
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    unit: item.unit,
    stock,
    minStock,
    averageCost,
    stockValue: round(Math.max(stock, 0) * averageCost, 2),
    status: stockStatus(stock, minStock),
    active: item.active,
    usedIn,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toMovementDto(
  m: InventoryMovement & {
    inventoryItem: Pick<InventoryItem, 'id' | 'name' | 'unit'>;
    user: Pick<User, 'id' | 'name'>;
  },
): MovementDto {
  return {
    id: m.id,
    type: m.type,
    quantity: Number(m.quantity),
    unitCost: m.unitCost === null ? null : Number(m.unitCost),
    stockAfter: Number(m.stockAfter),
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
    item: { id: m.inventoryItem.id, name: m.inventoryItem.name, unit: m.inventoryItem.unit },
    user: { id: m.user.id, name: m.user.name },
  };
}
