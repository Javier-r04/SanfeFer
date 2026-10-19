import { describe, expect, it } from 'vitest';
import { businessDayRange, getBusinessDate } from './business-date';

describe('getBusinessDate', () => {
  it('usa la hora de Guatemala (UTC-6)', () => {
    // 18 oct 23:59 en Guatemala = 19 oct 05:59 UTC
    expect(getBusinessDate(new Date('2026-10-19T05:59:00Z'))).toBe('2026-10-18');
  });

  it('lo vendido después de medianoche cuenta para el día siguiente', () => {
    // 19 oct 00:30 en Guatemala = 19 oct 06:30 UTC
    expect(getBusinessDate(new Date('2026-10-19T06:30:00Z'))).toBe('2026-10-19');
  });
});

describe('businessDayRange', () => {
  it('cubre de 00:00 a 23:59:59 hora local', () => {
    const { start, end } = businessDayRange('2026-10-18');
    expect(start.toISOString()).toBe('2026-10-18T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-19T06:00:00.000Z');
  });

  it('funciona en cambio de mes y año', () => {
    const { start, end } = businessDayRange('2026-12-31');
    expect(start.toISOString()).toBe('2026-12-31T06:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T06:00:00.000Z');
  });
});
