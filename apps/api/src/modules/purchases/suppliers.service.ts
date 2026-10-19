import type { SupplierInput, SupplierUpdateInput } from '@sanfefer/shared';
import { supplierInputSchema, supplierUpdateSchema } from '@sanfefer/shared';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toSupplierDto } from './purchases.mapper';

/** Totales por proveedor (solo compras recibidas cuentan para el monto). */
async function statsFor(supplierIds: number[]) {
  const [counts, received] = await Promise.all([
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds } },
      _count: { _all: true },
    }),
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds }, status: 'RECEIVED' },
      _sum: { total: true },
      _max: { purchasedAt: true },
    }),
  ]);
  const stats = new Map<number, { count: number; total: number; last: Date | null }>();
  for (const id of supplierIds) stats.set(id, { count: 0, total: 0, last: null });
  for (const c of counts) stats.get(c.supplierId)!.count = c._count._all;
  for (const r of received) {
    const s = stats.get(r.supplierId)!;
    s.total = Number(r._sum.total ?? 0);
    s.last = r._max.purchasedAt;
  }
  return stats;
}

export async function listSuppliers(includeInactive = false) {
  const rows = await prisma.supplier.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  const stats = await statsFor(rows.map((r) => r.id));
  return rows.map((r) => toSupplierDto(r, stats.get(r.id)!));
}

async function getOrThrow(id: number) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) throw notFound('El proveedor no existe.');
  return s;
}

export async function getSupplier(id: number) {
  const s = await getOrThrow(id);
  return toSupplierDto(s, (await statsFor([id])).get(id)!);
}

export async function createSupplier(raw: SupplierInput) {
  const input = supplierInputSchema.parse(raw);
  const s = await prisma.supplier.create({ data: input });
  return getSupplier(s.id);
}

export async function updateSupplier(id: number, raw: SupplierUpdateInput) {
  await getOrThrow(id);
  await prisma.supplier.update({ where: { id }, data: supplierUpdateSchema.parse(raw) });
  return getSupplier(id);
}

export async function deleteSupplier(id: number) {
  await getOrThrow(id);
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) {
    throw conflict(
      `Tiene ${purchases} compra${purchases === 1 ? '' : 's'} registrada${purchases === 1 ? '' : 's'}. Desactívalo en lugar de eliminarlo.`,
    );
  }
  await prisma.supplier.delete({ where: { id } });
}
