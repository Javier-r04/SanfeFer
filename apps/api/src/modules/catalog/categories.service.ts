import type { CategoryInput, CategoryUpdateInput } from '@sanfefer/shared';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toCategoryDto } from './catalog.mapper';
import { assertSameSet } from './catalog.validation';

const withCount = { _count: { select: { products: true } } } as const;

export async function listCategories() {
  const rows = await prisma.category.findMany({
    include: withCount,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toCategoryDto);
}

async function getOrThrow(id: number) {
  const c = await prisma.category.findUnique({ where: { id }, include: withCount });
  if (!c) throw notFound('La categoría no existe.');
  return c;
}

export async function createCategory(input: CategoryInput) {
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const c = await prisma.category.create({
    data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    include: withCount,
  });
  return toCategoryDto(c);
}

export async function updateCategory(id: number, input: CategoryUpdateInput) {
  await getOrThrow(id);
  return toCategoryDto(
    await prisma.category.update({ where: { id }, data: input, include: withCount }),
  );
}

export async function deleteCategory(id: number) {
  const c = await getOrThrow(id);
  if (c._count.products > 0) {
    throw conflict(
      `La categoría tiene ${c._count.products} producto${c._count.products === 1 ? '' : 's'}. Muévelos a otra categoría o desactívala.`,
    );
  }
  await prisma.category.delete({ where: { id } });
}

export async function reorderCategories(ids: number[]) {
  await assertSameSet('category', ids);
  await prisma.$transaction(
    ids.map((id, sortOrder) => prisma.category.update({ where: { id }, data: { sortOrder } })),
  );
  return listCategories();
}
