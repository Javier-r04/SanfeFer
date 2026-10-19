import type { Prisma } from '@prisma/client';
import type { ItemCounts, OrderItemDto, TabDto, TabSummaryDto } from '@sanfefer/shared';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const itemInclude = {
  modifiers: { orderBy: { id: 'asc' } },
} satisfies Prisma.OrderItemInclude;

type ItemRow = Prisma.OrderItemGetPayload<{ include: typeof itemInclude }>;
type ItemLike = Pick<ItemRow, 'quantity' | 'unitPrice' | 'discountAmount' | 'status'>;

export const lineTotal = (i: ItemLike) =>
  round2(i.quantity * Number(i.unitPrice) - Number(i.discountAmount));

export function toOrderItemDto(i: ItemRow): OrderItemDto {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    productName: i.productName,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    lineTotal: lineTotal(i),
    note: i.note,
    status: i.status,
    statusChangedAt: i.statusChangedAt.toISOString(),
    modifiers: i.modifiers.map((m) => ({
      groupName: m.groupName,
      optionName: m.optionName,
      priceDelta: Number(m.priceDelta),
    })),
    cancelReason: i.cancelReason,
  };
}

/** Subtotal, unidades y estados de los ítems vigentes (sin cancelados). */
export function summarizeItems(items: ItemLike[]) {
  const live = items.filter((i) => i.status !== 'CANCELLED');
  const counts: ItemCounts = { pending: 0, preparing: 0, delivered: 0 };
  for (const i of live) {
    if (i.status === 'PENDING') counts.pending += i.quantity;
    else if (i.status === 'PREPARING') counts.preparing += i.quantity;
    else counts.delivered += i.quantity;
  }
  return {
    subtotal: round2(live.reduce((s, i) => s + lineTotal(i), 0)),
    itemCount: live.reduce((s, i) => s + i.quantity, 0),
    counts,
  };
}

export const tabSummaryInclude = {
  items: { select: { quantity: true, unitPrice: true, discountAmount: true, status: true } },
} satisfies Prisma.TabInclude;

type TabSummaryRow = Prisma.TabGetPayload<{ include: typeof tabSummaryInclude }>;

export function toTabSummary(t: TabSummaryRow): TabSummaryDto {
  return {
    id: t.id,
    customerName: t.customerName,
    tableId: t.tableId,
    openedAt: t.openedAt.toISOString(),
    ...summarizeItems(t.items),
  };
}

export const tabDetailInclude = {
  table: { select: { id: true, name: true } },
  openedBy: { select: { id: true, name: true } },
  items: { include: itemInclude, orderBy: { id: 'asc' } },
  orders: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { id: 'asc' } },
} satisfies Prisma.TabInclude;

type TabDetailRow = Prisma.TabGetPayload<{ include: typeof tabDetailInclude }>;

export function toTabDto(t: TabDetailRow, siblings: TabSummaryRow[]): TabDto {
  // Los ítems se agrupan por la comanda con que se enviaron (un ítem movido conserva su comanda).
  const byOrder = new Map<number, OrderItemDto[]>();
  for (const item of t.items) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push(toOrderItemDto(item));
    byOrder.set(item.orderId, list);
  }
  return {
    id: t.id,
    customerName: t.customerName,
    tableId: t.tableId,
    openedAt: t.openedAt.toISOString(),
    ...summarizeItems(t.items),
    status: t.status,
    table: t.table,
    openedBy: t.openedBy,
    siblings: siblings.map((s) => ({
      id: s.id,
      customerName: s.customerName,
      subtotal: summarizeItems(s.items).subtotal,
    })),
    orders: t.orders
      .filter((o) => byOrder.has(o.id))
      .map((o) => ({
        id: o.id,
        sentAt: o.sentAt.toISOString(),
        createdBy: o.createdBy,
        items: byOrder.get(o.id)!,
      })),
  };
}
