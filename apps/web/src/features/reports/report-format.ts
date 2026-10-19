import type { ReportGroupBy } from '@sanfefer/shared';
import { addDays } from '@sanfefer/shared';

// Las fechas del reporte son días calendario (AAAA-MM-DD); se formatean en UTC para no correrse de día.
const utc = (date: string) => new Date(`${date}T12:00:00Z`);
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-GT', { ...opts, timeZone: 'UTC' });
const dayMonth = fmt({ day: 'numeric', month: 'short' });
const weekdayDay = fmt({ weekday: 'short', day: 'numeric' });
const monthYear = fmt({ month: 'short', year: 'numeric' });
const fullDate = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const longDate = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const clean = (s: string) => s.replace(/\./g, '');

/** Etiqueta corta de un periodo para el eje del gráfico. */
export function periodLabel(period: string, groupBy: ReportGroupBy, compact = false): string {
  if (groupBy === 'month') return clean(monthYear.format(utc(period)));
  if (groupBy === 'week') {
    const end = addDays(period, 6);
    const sameMonth = period.slice(0, 7) === end.slice(0, 7);
    return sameMonth
      ? `${Number(period.slice(8))}–${clean(dayMonth.format(utc(end)))}`
      : `${clean(dayMonth.format(utc(period)))} – ${clean(dayMonth.format(utc(end)))}`;
  }
  return clean((compact ? weekdayDay : dayMonth).format(utc(period)));
}

/** Etiqueta completa de un periodo para el tooltip y la tabla. */
export function periodTitle(period: string, groupBy: ReportGroupBy): string {
  if (groupBy === 'day') return longDate.format(utc(period));
  if (groupBy === 'week')
    return `Semana del ${clean(fullDate.format(utc(period)))} al ${clean(fullDate.format(utc(addDays(period, 6))))}`;
  const month = fmt({ month: 'long', year: 'numeric' }).format(utc(period));
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/** "19 oct 2026" o "1 – 19 oct 2026". */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return clean(fullDate.format(utc(from)));
  return `${clean(fullDate.format(utc(from)))} – ${clean(fullDate.format(utc(to)))}`;
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Q 850 · Q 1.2k · Q 15k: para ejes, donde no cabe el monto completo. */
export function compactMoney(value: number): string {
  if (Math.abs(value) < 1000) return `Q ${Math.round(value)}`;
  const k = value / 1000;
  return `Q ${Number.isInteger(k) || Math.abs(k) >= 10 ? Math.round(k) : k.toFixed(1)}k`;
}

/** Variación contra el periodo anterior; null si antes no hubo nada con qué comparar. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
