import { Prisma } from '@prisma/client';
import type { ProductInput, ProductUpdateInput } from '@sanfefer/shared';
import { productInputSchema } from '@sanfefer/shared';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { productInclude, toProductDto } from './catalog.mapper';
import {
  assertCategory,
  assertModifierGroups,
  assertRecipeItems,
  assertSameSet,
} from './catalog.validation';

const D = (v: number) => new Prisma.Decimal(v);

export async function listProducts(filters: { categoryId?: number; active?: boolean; q?: string }) {
  const rows = await prisma.product.findMany({
    where: {
      categoryId: filters.categoryId,
      active: filters.active,
      name: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
    },
    include: productInclude,
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toProductDto);
}

export async function getProduct(id: number) {
  const p = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!p) throw notFound('El producto no existe.');
  return toProductDto(p);
}

export async function createProduct(raw: ProductInput) {
  const input = productInputSchema.parse(raw);
  await assertCategory(input.categoryId);
  await assertRecipeItems(input.recipe, 'recipe');
  await assertModifierGroups(input.modifierGroupIds);

  const last = await prisma.product.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  const p = await prisma.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      price: D(input.price),
      description: input.description,
      active: input.active,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
      recipe: {
        create: input.recipe.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: D(l.quantity),
        })),
      },
      modifierGroups: {
        create: input.modifierGroupIds.map((groupId, sortOrder) => ({ groupId, sortOrder })),
      },
    },
    include: productInclude,
  });
  return toProductDto(p);
}

export async function updateProduct(id: number, input: ProductUpdateInput) {
  await getProduct(id);
  if (input.categoryId !== undefined) await assertCategory(input.categoryId);
  if (input.recipe) await assertRecipeItems(input.recipe, 'recipe');
  if (input.modifierGroupIds) await assertModifierGroups(input.modifierGroupIds);

  // Receta y extras se reemplazan completos, en la misma transacción que el resto.
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        price: input.price === undefined ? undefined : D(input.price),
        description: input.description,
        active: input.active,
      },
    });
    if (input.recipe) {
      await tx.productComponent.deleteMany({ where: { productId: id } });
      await tx.productComponent.createMany({
        data: input.recipe.map((l) => ({
          productId: id,
          inventoryItemId: l.inventoryItemId,
          quantity: D(l.quantity),
        })),
      });
    }
    if (input.modifierGroupIds) {
      await tx.productModifierGroup.deleteMany({ where: { productId: id } });
      await tx.productModifierGroup.createMany({
        data: input.modifierGroupIds.map((groupId, sortOrder) => ({
          productId: id,
          groupId,
          sortOrder,
        })),
      });
    }
  });
  return getProduct(id);
}

export async function deleteProduct(id: number) {
  await getProduct(id);
  const sold = await prisma.orderItem.count({ where: { productId: id } });
  if (sold > 0)
    throw conflict(
      'Este producto ya tiene ventas registradas. Desactívalo en lugar de eliminarlo.',
    );
  await prisma.product.delete({ where: { id } });
}

export async function reorderProducts(ids: number[]) {
  await assertSameSet('product', ids);
  await prisma.$transaction(
    ids.map((id, sortOrder) => prisma.product.update({ where: { id }, data: { sortOrder } })),
  );
}
