import type { RecipeLineInput } from '@sanfefer/shared';
import { badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/** Verifica que los artículos de una receta existan; `path` ubica el error en el formulario. */
export async function assertRecipeItems(lines: RecipeLineInput[], path: string) {
  if (lines.length === 0) return;
  const ids = lines.map((l) => l.inventoryItemId);
  const found = await prisma.inventoryItem.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(found.map((f) => f.id));
  const missing = lines.findIndex((l) => !known.has(l.inventoryItemId));
  if (missing >= 0) {
    throw badRequest('Un artículo de la receta no existe.', {
      [`${path}.${missing}.inventoryItemId`]: 'Este artículo ya no existe',
    });
  }
}

export async function assertCategory(categoryId: number) {
  const exists = await prisma.category.count({ where: { id: categoryId } });
  if (!exists)
    throw badRequest('La categoría no existe.', { categoryId: 'La categoría no existe' });
}

export async function assertModifierGroups(ids: number[]) {
  if (ids.length === 0) return;
  const count = await prisma.modifierGroup.count({ where: { id: { in: ids } } });
  if (count !== ids.length) {
    throw badRequest('Un grupo de extras no existe.', {
      modifierGroupIds: 'Un grupo de extras no existe',
    });
  }
}

/** Verifica que todos los ids existan antes de reordenar. */
export async function assertSameSet(
  model: 'category' | 'product' | 'modifierGroup',
  ids: number[],
) {
  const where = { id: { in: ids } };
  const count =
    model === 'category'
      ? await prisma.category.count({ where })
      : model === 'product'
        ? await prisma.product.count({ where })
        : await prisma.modifierGroup.count({ where });
  if (count !== ids.length) throw badRequest('Algunos elementos ya no existen. Recarga la página.');
}
