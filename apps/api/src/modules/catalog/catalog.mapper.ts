import type { InventoryItem, Prisma } from '@prisma/client';
import {
  marginOf,
  requiredExtrasBase,
  stockStatus,
  type CategoryColor,
  type CategoryDto,
  type ModifierGroupDto,
  type ProductDto,
  type RecipeLineDto,
  type StockStatus,
} from '@sanfefer/shared';

const round = (n: number, places = 2) => Number(n.toFixed(places));

export const recipeInclude = { inventoryItem: true } satisfies Prisma.ProductComponentInclude;

export const productInclude = {
  category: { select: { name: true } },
  recipe: { include: recipeInclude, orderBy: { id: 'asc' } },
  modifierGroups: {
    orderBy: { sortOrder: 'asc' },
    // Los extras obligatorios entran en el costo y la disponibilidad del producto.
    include: {
      group: { include: { options: { include: { components: { include: recipeInclude } } } } },
    },
  },
} satisfies Prisma.ProductInclude;

export const modifierGroupInclude = {
  options: {
    orderBy: { sortOrder: 'asc' },
    include: { components: { include: recipeInclude, orderBy: { id: 'asc' } } },
  },
  _count: { select: { products: true } },
} satisfies Prisma.ModifierGroupInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ModifierGroupRow = Prisma.ModifierGroupGetPayload<{ include: typeof modifierGroupInclude }>;

export function toRecipeLine(line: {
  quantity: Prisma.Decimal;
  inventoryItem: InventoryItem;
}): RecipeLineDto {
  const quantity = Number(line.quantity);
  const unitCost = Number(line.inventoryItem.averageCost);
  return {
    inventoryItemId: line.inventoryItem.id,
    name: line.inventoryItem.name,
    unit: line.inventoryItem.unit,
    quantity,
    unitCost,
    lineCost: round(quantity * unitCost, 4),
    stock: Number(line.inventoryItem.stock),
    itemActive: line.inventoryItem.active,
  };
}

type Line = { quantity: Prisma.Decimal; inventoryItem: InventoryItem };

/** Porciones que alcanzan con estas líneas; Infinity si no consumen inventario. */
function portions(lines: Line[]) {
  return lines.reduce(
    (min, l) =>
      Math.min(min, Math.max(0, Math.floor(Number(l.inventoryItem.stock) / Number(l.quantity)))),
    Infinity,
  );
}

const lineCost = (lines: Line[]) =>
  lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.inventoryItem.averageCost), 0);

/**
 * Disponibilidad del producto: lo que permite la receta y, en cada grupo obligatorio,
 * la suma de lo que permiten sus opciones (cualquiera sirve: Gallo o Corona).
 */
export function productAvailability(p: ProductRow) {
  let available = portions(p.recipe);
  for (const { group } of p.modifierGroups) {
    if (!group.active || group.minSelect < 1) continue;
    const options = group.options.filter((o) => o.active);
    const total = options.reduce((sum, o) => sum + portions(o.components), 0);
    available = Math.min(available, Math.floor(total / group.minSelect));
  }
  if (available === Infinity) return { available: null, status: null };
  let status: StockStatus = p.recipe.some(
    (l) => stockStatus(Number(l.inventoryItem.stock), Number(l.inventoryItem.minStock)) === 'LOW',
  )
    ? 'LOW'
    : 'OK';
  if (available === 0) status = 'OUT';
  return { available, status };
}

export function toProductDto(p: ProductRow): ProductDto {
  const recipe = p.recipe.map(toRecipeLine);
  const recipeCost = lineCost(p.recipe);
  const extras = requiredExtrasBase(
    p.modifierGroups.map(({ group }) => ({
      active: group.active,
      minSelect: group.minSelect,
      options: group.options.map((o) => ({
        active: o.active,
        priceDelta: Number(o.priceDelta),
        cost: lineCost(o.components),
      })),
    })),
  );
  const price = Number(p.price);
  const basePrice = price + extras.priceDelta;
  const cost = recipeCost + extras.cost;
  const margin = marginOf(basePrice, cost);
  const { available, status } = productAvailability(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    active: p.active,
    sortOrder: p.sortOrder,
    recipe,
    modifierGroupIds: p.modifierGroups.map((g) => g.groupId),
    recipeCost: round(recipeCost),
    basePrice: round(basePrice),
    cost: round(cost),
    margin: margin === null ? null : round(margin, 4),
    available,
    stockStatus: status,
  };
}

export function toModifierGroupDto(g: ModifierGroupRow): ModifierGroupDto {
  return {
    id: g.id,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    active: g.active,
    sortOrder: g.sortOrder,
    productCount: g._count.products,
    options: g.options.map((o) => {
      const components = o.components.map(toRecipeLine);
      return {
        id: o.id,
        name: o.name,
        priceDelta: Number(o.priceDelta),
        active: o.active,
        sortOrder: o.sortOrder,
        components,
        cost: round(components.reduce((s, c) => s + c.lineCost, 0)),
      };
    }),
  };
}

export function toCategoryDto(c: {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
  _count: { products: number };
}): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    color: (c.color ?? 'primary') as CategoryColor,
    sortOrder: c.sortOrder,
    active: c.active,
    productCount: c._count.products,
  };
}
