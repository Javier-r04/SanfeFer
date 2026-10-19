import type { CategoryColor, InventoryItemDto } from '@sanfefer/shared';

/** Clases literales para que Tailwind las incluya. */
export const CATEGORY_DOT: Record<CategoryColor, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  danger: 'bg-danger',
  warning: 'bg-warning',
  highlight: 'bg-highlight',
};

/** "Obligatorio · elige 1", "Opcional · hasta 3", "Elige de 1 a 2". */
export function selectionRule(min: number, max: number) {
  if (min === 0) return max === 1 ? 'Opcional · elige 1' : `Opcional · hasta ${max}`;
  if (min === max) return `Obligatorio · elige ${min}`;
  return `Obligatorio · elige de ${min} a ${max}`;
}

/** Costo de una receta con el costo promedio actual de cada artículo. */
export function recipeCost(
  lines: { inventoryItemId?: number; quantity?: number }[],
  items: InventoryItemDto[],
) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return lines.reduce((sum, l) => {
    const item = l.inventoryItemId ? byId.get(l.inventoryItemId) : undefined;
    const qty = Number(l.quantity);
    return item && Number.isFinite(qty) ? sum + qty * item.averageCost : sum;
  }, 0);
}

/** Mueve un elemento una posición y devuelve los ids en el nuevo orden. */
export function moveId(ids: number[], id: number, direction: -1 | 1) {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
