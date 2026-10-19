import { describe, expect, it } from 'vitest';
import { computeTabTotals, splitEvenly, suggestedBills } from './tab-totals';

describe('computeTabTotals', () => {
  it('sin descuento ni servicio el total es el subtotal', () => {
    expect(computeTabTotals(103, null, null)).toEqual({
      subtotal: 103,
      discountTotal: 0,
      serviceCharge: 0,
      total: 103,
    });
  });

  it('servicio del 10 % sobre el subtotal (diseño: Q 103 → Q 113.30)', () => {
    expect(computeTabTotals(103, null, 10).total).toBe(113.3);
  });

  it('el servicio se calcula después del descuento', () => {
    // 100 − 10 % = 90; servicio 10 % = 9; total 99
    expect(computeTabTotals(100, { type: 'PERCENT', value: 10 }, 10)).toEqual({
      subtotal: 100,
      discountTotal: 10,
      serviceCharge: 9,
      total: 99,
    });
  });

  it('un descuento en monto no puede pasar del subtotal', () => {
    expect(computeTabTotals(30, { type: 'AMOUNT', value: 50 }, null).total).toBe(0);
  });

  it('redondea a centavos sin errores de coma flotante', () => {
    expect(computeTabTotals(0.1 + 0.2, null, 10).total).toBe(0.33);
  });
});

describe('splitEvenly', () => {
  it('reparte los centavos sobrantes en la última parte', () => {
    expect(splitEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitEvenly(113.3, 2)).toEqual([56.65, 56.65]);
  });
});

describe('suggestedBills', () => {
  it('propone el exacto y montos redondos mayores', () => {
    expect(suggestedBills(113.3)).toEqual([113.3, 115, 120, 150, 200]);
    expect(suggestedBills(50)).toEqual([50, 60, 100, 200]);
  });
});
