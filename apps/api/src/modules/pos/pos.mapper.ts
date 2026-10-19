import type { Prisma } from '@prisma/client';
import {
  computeTabTotals,
  fromCents,
  toCents,
  type ItemCounts,
  type OrderItemDto,
  type PaymentDto,
  type TabBillingDto,
  type TabDto,
  type TabSummaryDto,
} from '@sanfefer/shared';

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

export const paymentInclude = {
  receivedBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

export function toPaymentDto(p: PaymentRow): PaymentDto {
  return {
    id: p.id,
    method: p.method,
    amount: Number(p.amount),
    tendered: p.tendered === null ? null : Number(p.tendered),
    change: p.change === null ? null : Number(p.change),
    reference: p.reference,
    receivedBy: p.receivedBy,
    createdAt: p.createdAt.toISOString(),
  };
}

type BillingSource = Pick<
  Prisma.TabGetPayload<object>,
  | 'status'
  | 'discountType'
  | 'discountValue'
  | 'discountReason'
  | 'serviceChargeRate'
  | 'subtotal'
  | 'discountTotal'
  | 'serviceCharge'
  | 'total'
> & { items: ItemLike[]; payments: PaymentRow[] };

/**
 * Totales de la cuenta. Abierta: se calculan con los productos vigentes.
 * Cobrada: se usan los totales congelados al cerrar.
 */
export function computeBilling(t: BillingSource): TabBillingDto {
  const discount =
    t.discountType && t.discountValue
      ? { type: t.discountType, value: Number(t.discountValue) }
      : null;
  const serviceChargeRate = t.serviceChargeRate === null ? null : Number(t.serviceChargeRate);
  const totals =
    t.status === 'PAID'
      ? {
          subtotal: Number(t.subtotal),
          discountTotal: Number(t.discountTotal),
          serviceCharge: Number(t.serviceCharge),
          total: Number(t.total),
        }
      : computeTabTotals(summarizeItems(t.items).subtotal, discount, serviceChargeRate);
  const paidCents = t.payments.reduce((s, p) => s + toCents(Number(p.amount)), 0);
  return {
    discount: discount ? { ...discount, reason: t.discountReason } : null,
    serviceChargeRate,
    ...totals,
    paid: fromCents(paidCents),
    remaining: fromCents(Math.max(0, toCents(totals.total) - paidCents)),
    payments: t.payments.map(toPaymentDto),
  };
}

export const tabDetailInclude = {
  table: { select: { id: true, name: true } },
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  payments: { include: paymentInclude, orderBy: { id: 'asc' } },
  // La comanda se toma de cada ítem: un ítem movido desde otra cuenta conserva su comanda original.
  items: {
    include: {
      ...itemInclude,
      order: { include: { createdBy: { select: { id: true, name: true } } } },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.TabInclude;

type TabDetailRow = Prisma.TabGetPayload<{ include: typeof tabDetailInclude }>;
type OrderRow = TabDetailRow['items'][number]['order'];

export function toTabDto(t: TabDetailRow, siblings: TabSummaryRow[]): TabDto {
  // Los ítems se agrupan por la comanda con que se enviaron.
  const byOrder = new Map<number, { order: OrderRow; items: OrderItemDto[] }>();
  for (const item of t.items) {
    const group = byOrder.get(item.orderId) ?? { order: item.order, items: [] };
    group.items.push(toOrderItemDto(item));
    byOrder.set(item.orderId, group);
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
    closedBy: t.closedBy,
    closedAt: t.closedAt?.toISOString() ?? null,
    billing: computeBilling(t),
    siblings: siblings.map((s) => ({
      id: s.id,
      customerName: s.customerName,
      subtotal: summarizeItems(s.items).subtotal,
    })),
    orders: [...byOrder.values()]
      .sort((a, b) => a.order.id - b.order.id)
      .map(({ order, items }) => ({
        id: order.id,
        sentAt: order.sentAt.toISOString(),
        createdBy: order.createdBy,
        items,
      })),
  };
}
