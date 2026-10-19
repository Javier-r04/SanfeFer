interface OptionLike {
  active: boolean;
  priceDelta: number;
  cost: number;
}
interface GroupLike {
  active: boolean;
  minSelect: number;
  options: OptionLike[];
}

/**
 * Configuración más simple que se puede vender: en cada grupo obligatorio se toman las
 * opciones de menor recargo (y, a igual recargo, de menor costo). Ej. una michelada lleva
 * al menos una cerveza; su costo real incluye la cerveza más barata.
 */
export function requiredExtrasBase(groups: GroupLike[]) {
  let priceDelta = 0;
  let cost = 0;
  for (const g of groups) {
    if (!g.active || g.minSelect < 1) continue;
    const picks = g.options
      .filter((o) => o.active)
      .sort((a, b) => a.priceDelta - b.priceDelta || a.cost - b.cost)
      .slice(0, g.minSelect);
    for (const o of picks) {
      priceDelta += o.priceDelta;
      cost += o.cost;
    }
  }
  return { priceDelta, cost };
}

/** Margen sobre el precio de venta; null si el precio es 0. */
export const marginOf = (price: number, cost: number) =>
  price > 0 ? (price - cost) / price : null;

interface SelectableGroup {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id: number }[];
}

/**
 * Revisa que los extras elegidos cumplan las reglas de cada grupo del producto.
 * Devuelve un mensaje por grupo con problema (vacío si todo está bien).
 */
export function validateModifierSelection(groups: SelectableGroup[], selectedOptionIds: number[]) {
  const errors: Record<number, string> = {};
  const known = new Set(groups.flatMap((g) => g.options.map((o) => o.id)));
  const unknown = selectedOptionIds.filter((id) => !known.has(id));
  for (const g of groups) {
    const ids = new Set(g.options.map((o) => o.id));
    const count = selectedOptionIds.filter((id) => ids.has(id)).length;
    if (count < g.minSelect) {
      errors[g.id] =
        g.minSelect === 1
          ? `Elige una opción de ${g.name}`
          : `Elige al menos ${g.minSelect} opciones de ${g.name}`;
    } else if (count > g.maxSelect) {
      errors[g.id] =
        g.maxSelect === 1
          ? `Solo se puede elegir una opción de ${g.name}`
          : `Máximo ${g.maxSelect} opciones de ${g.name}`;
    }
  }
  return { errors, unknown };
}
