import type { Prisma } from '@prisma/client';
import type { PurchaseDto, PurchaseSummaryDto, SupplierDto } from '@sanfefer/shared';

export const purchaseSummaryInclude = {
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.PurchaseInclude;

export const purchaseDetailInclude = {
  ...purchaseSummaryInclude,
  voidedBy: { select: { id: true, name: true } },
  items: {
    include: { inventoryItem: { select: { name: true, unit: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.PurchaseInclude;

type SummaryRow = Prisma.PurchaseGetPayload<{ include: typeof purchaseSummaryInclude }>;
type DetailRow = Prisma.PurchaseGetPayload<{ include: typeof purchaseDetailInclude }>;

/** Las fechas @db.Date llegan como medianoche UTC: se devuelve solo AAAA-MM-DD. */
export const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export function toPurchaseSummary(p: SummaryRow): PurchaseSummaryDto {
  return {
    id: p.id,
    purchasedAt: dateOnly(p.purchasedAt),
    supplier: p.supplier,
    invoiceNumber: p.invoiceNumber,
    itemCount: p._count.items,
    total: Number(p.total),
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toPurchaseDto(p: DetailRow): PurchaseDto {
  return {
    ...toPurchaseSummary(p),
    notes: p.notes,
    voidedAt: p.voidedAt?.toISOString() ?? null,
    voidReason: p.voidReason,
    voidedBy: p.voidedBy,
    items: p.items.map((i) => ({
      id: i.id,
      inventoryItemId: i.inventoryItemId,
      name: i.inventoryItem.name,
      unit: i.inventoryItem.unit,
      quantity: Number(i.quantity),
      unitCost: Number(i.unitCost),
      subtotal: Number(i.subtotal),
    })),
  };
}

export function toSupplierDto(
  s: Prisma.SupplierGetPayload<object>,
  stats: { count: number; total: number; last: Date | null },
): SupplierDto {
  return {
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    taxId: s.taxId,
    notes: s.notes,
    active: s.active,
    purchaseCount: stats.count,
    totalPurchased: stats.total,
    lastPurchaseAt: stats.last ? dateOnly(stats.last) : null,
  };
}
