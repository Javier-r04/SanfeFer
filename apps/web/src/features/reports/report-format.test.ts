import { describe, expect, it } from 'vitest';
import { change, compactMoney, periodLabel, periodTitle, rangeLabel } from './report-format';

describe('formatos de reportes', () => {
  it('etiqueta los periodos sin correrse de día', () => {
    expect(periodLabel('2026-10-01', 'day')).toBe('1 oct');
    expect(periodLabel('2026-10-19', 'week')).toBe('19–25 oct');
    expect(periodLabel('2026-09-28', 'week')).toBe('28 sept – 4 oct');
    expect(periodLabel('2026-10-01', 'month')).toBe('oct 2026');
    expect(periodTitle('2026-10-01', 'month')).toBe('Octubre de 2026');
    expect(rangeLabel('2026-10-01', '2026-10-19')).toBe('1 oct 2026 – 19 oct 2026');
  });

  it('abrevia montos del eje', () => {
    expect(compactMoney(850)).toBe('Q 850');
    expect(compactMoney(1200)).toBe('Q 1.2k');
    expect(compactMoney(3000)).toBe('Q 3k');
    expect(compactMoney(15400)).toBe('Q 15k');
  });

  it('variación contra el periodo anterior', () => {
    expect(change(110, 100)).toBeCloseTo(0.1);
    expect(change(50, 100)).toBeCloseTo(-0.5);
    expect(change(10, 0)).toBeNull();
  });
});
