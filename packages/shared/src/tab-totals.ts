/** Cálculos de dinero en centavos enteros para que nunca haya errores de redondeo. */
export const toCents = (q: number) => Math.round(q * 100);
export const fromCents = (c: number) => c / 100;

export type DiscountType = 'PERCENT' | 'AMOUNT';

export interface TabTotals {
  subtotal: number;
  discountTotal: number;
  serviceCharge: number;
  total: number;
}

/**
 * Total de una cuenta: subtotal − descuento + cargo por servicio.
 * El servicio se calcula sobre el subtotal ya descontado.
 */
export function computeTabTotals(
  subtotal: number,
  discount: { type: DiscountType; value: number } | null,
  serviceChargeRate: number | null,
): TabTotals {
  const sub = toCents(subtotal);
  let disc = 0;
  if (discount) {
    disc =
      discount.type === 'PERCENT'
        ? Math.round((sub * Math.min(Math.max(discount.value, 0), 100)) / 100)
        : Math.min(toCents(discount.value), sub);
  }
  const service = serviceChargeRate ? Math.round(((sub - disc) * serviceChargeRate) / 100) : 0;
  return {
    subtotal: fromCents(sub),
    discountTotal: fromCents(disc),
    serviceCharge: fromCents(service),
    total: fromCents(sub - disc + service),
  };
}

/** Divide un monto en N partes iguales; la última absorbe los centavos sobrantes. */
export function splitEvenly(amount: number, parts: number): number[] {
  const cents = toCents(amount);
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) =>
    fromCents(i === n - 1 ? cents - base * (n - 1) : base),
  );
}

/** Billetes sugeridos para pagar en efectivo: el exacto y los siguientes montos redondos. */
export function suggestedBills(amount: number): number[] {
  const cents = toCents(amount);
  const options = new Set<number>([cents]);
  for (const step of [500, 1000, 2000, 5000, 10000, 20000]) {
    const rounded = Math.ceil(cents / step) * step;
    if (rounded > cents) options.add(rounded);
  }
  return [...options]
    .sort((a, b) => a - b)
    .slice(0, 5)
    .map(fromCents);
}
