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
