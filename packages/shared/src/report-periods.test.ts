import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import {
  addDays,
  daysInRange,
  defaultGroupBy,
  isoWeekday,
  matchPreset,
  periodKey,
  periodKeys,
  presetRange,
  previousRange,
} from './report-periods';
import { salesReportQuerySchema } from './schemas/reports';

describe('periodos de reportes', () => {
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('cuenta los días del rango con ambos extremos', () => {
    expect(daysInRange('2026-10-19', '2026-10-19')).toBe(1);
    expect(daysInRange('2026-10-01', '2026-10-31')).toBe(31);
  });

  it('las semanas empiezan en lunes', () => {
    expect(isoWeekday('2026-10-19')).toBe(1); // lunes
    expect(isoWeekday('2026-10-25')).toBe(7); // domingo
    expect(periodKey('2026-10-25', 'week')).toBe('2026-10-19');
    expect(periodKey('2026-10-19', 'week')).toBe('2026-10-19');
    expect(periodKey('2026-10-25', 'month')).toBe('2026-10-01');
  });

  it('lista los periodos sin huecos', () => {
    expect(periodKeys('2026-10-30', '2026-11-02', 'day')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(periodKeys('2026-10-15', '2026-11-03', 'week')).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ]);
    expect(periodKeys('2026-09-20', '2026-11-03', 'month')).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('elige la agrupación según el largo del rango', () => {
    expect(defaultGroupBy('2026-10-01', '2026-10-31')).toBe('day');
    expect(defaultGroupBy('2026-08-01', '2026-10-31')).toBe('week');
    expect(defaultGroupBy('2026-01-01', '2026-10-31')).toBe('month');
  });

  it('el periodo anterior tiene el mismo largo', () => {
    expect(previousRange('2026-10-19', '2026-10-19')).toEqual({
      from: '2026-10-18',
      to: '2026-10-18',
    });
    expect(previousRange('2026-10-01', '2026-10-31')).toEqual({
      from: '2026-08-31',
      to: '2026-09-30',
    });
  });

  it('calcula los rangos rápidos desde el día del negocio', () => {
    const today = '2026-10-21'; // miércoles
    expect(presetRange('week', today)).toEqual({ from: '2026-10-19', to: today });
    expect(presetRange('last7', today)).toEqual({ from: '2026-10-15', to: today });
    expect(presetRange('month', today)).toEqual({ from: '2026-10-01', to: today });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('lastMonth', '2026-01-10')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('year', today)).toEqual({ from: '2026-01-01', to: today });
    expect(matchPreset('2026-09-01', '2026-09-30', today)).toBe('lastMonth');
    expect(matchPreset('2026-09-02', '2026-09-30', today)).toBeNull();
  });

  it('valida el rango con mensajes en español', () => {
    const backwards = salesReportQuerySchema.safeParse({ from: '2026-10-20', to: '2026-10-19' });
    expect(backwards.error?.issues[0]?.message).toBe(
      'La fecha final no puede ser anterior a la inicial',
    );
    const tooLong = salesReportQuerySchema.safeParse({ from: '2020-01-01', to: '2026-10-19' });
    expect(tooLong.error?.issues[0]?.message).toBe('El rango no puede ser mayor a dos años');
    expect(salesReportQuerySchema.parse({ from: '2026-10-01', to: '2026-10-19' }).groupBy).toBe(
      'day',
    );
  });
});

describe('CSV', () => {
  const columns = [
    { header: 'Producto', value: (r: { name: string; total: number | null }) => r.name },
    { header: 'Total (Q)', value: (r: { name: string; total: number | null }) => r.total },
  ];

  it('separa con coma, usa punto decimal y CRLF', () => {
    expect(toCsv(columns, [{ name: 'Gallo', total: 40.5 }])).toBe(
      'Producto,Total (Q)\r\nGallo,40.5\r\n',
    );
  });

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(toCsv(columns, [{ name: 'Michelada "La Chula", grande', total: null }])).toBe(
      'Producto,Total (Q)\r\n"Michelada ""La Chula"", grande",\r\n',
    );
  });

  it('neutraliza textos que Excel ejecutaría como fórmula, pero no los números negativos', () => {
    expect(toCsv(columns, [{ name: '=HYPERLINK("x")', total: -5 }])).toBe(
      'Producto,Total (Q)\r\n"\'=HYPERLINK(""x"")",-5\r\n',
    );
  });
});
