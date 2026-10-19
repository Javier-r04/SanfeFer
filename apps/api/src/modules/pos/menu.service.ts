import type { CategoryColor, MenuCategory } from '@sanfefer/shared';
import { prisma } from '../../lib/prisma';
import { productInclude, productAvailability } from '../catalog/catalog.mapper';

/** Menú del POS: solo categorías, productos, grupos y opciones activos, con disponibilidad. */
export async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      products: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: productInclude,
      },
    },
  });
  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: (c.color ?? 'primary') as CategoryColor,
      products: c.products.map((p) => {
        const { available, status } = productAvailability(p);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          available,
          stockStatus: status,
          modifierGroups: p.modifierGroups
            .filter(({ group }) => group.active)
            .map(({ group }) => ({
              id: group.id,
              name: group.name,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              options: group.options
                .filter((o) => o.active)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })),
            })),
        };
      }),
    }))
    .filter((c) => c.products.length > 0);
}
