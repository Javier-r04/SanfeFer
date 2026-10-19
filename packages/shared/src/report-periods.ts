import { getBusinessDate } from './business-date';

/** Agrupación de las series de ventas. Las semanas empiezan en lunes. */
export const REPORT_GROUPS = ['day', 'week', 'month'] as const;
export type ReportGroupBy = (typeof REPORT_GROUPS)[number];

export const REPORT_GROUP_LABELS: Record<ReportGroupBy, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

/** Rangos rápidos del selector de periodo. */
export const REPORT_PRESETS = [
  'today',
  'yesterday',
  'week',
  'last7',
  'month',
  'lastMonth',
  'last30',
  'year',
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  week: 'Esta semana',
  last7: 'Últimos 7 días',
  month: 'Este mes',
  lastMonth: 'Mes anterior',
  last30: 'Últimos 30 días',
  year: 'Este año',
};

/** Máximo de días que abarca un reporte (dos años). */
export const MAX_REPORT_DAYS = 731;

const pad = (n: number) => String(n).padStart(2, '0');
const toUtc = (date: string) => new Date(`${date}T00:00:00.000Z`);
const fromUtc = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Suma días a una fecha AAAA-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Días del rango, contando ambos extremos. */
export function daysInRange(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: string): number {
  return toUtc(date).getUTCDay() || 7;
}

/** Fecha que identifica el periodo al que pertenece un día (el propio día, su lunes o el día 1). */
export function periodKey(date: string, groupBy: ReportGroupBy): string {
  if (groupBy === 'day') return date;
  if (groupBy === 'week') return addDays(date, 1 - isoWeekday(date));
  return `${date.slice(0, 7)}-01`;
}

/** Todos los periodos que toca el rango, en orden, para que la serie no tenga huecos. */
export function periodKeys(from: string, to: string, groupBy: ReportGroupBy): string[] {
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = periodKey(d, groupBy);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

/** Agrupación por defecto según el largo del rango. */
export function defaultGroupBy(from: string, to: string): ReportGroupBy {
  const days = daysInRange(from, to);
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

/** Rango del mismo largo inmediatamente anterior, para comparar. */
export function previousRange(from: string, to: string) {
  const days = daysInRange(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** Rango de un preset, tomando como "hoy" el día del negocio. */
export function presetRange(preset: ReportPreset, today = getBusinessDate()) {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: periodKey(today, 'week'), to: today };
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: monthStart, to: today };
    case 'lastMonth': {
      const end = addDays(monthStart, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** El preset que coincide exactamente con un rango, si lo hay. */
export function matchPreset(
  from: string,
  to: string,
  today = getBusinessDate(),
): ReportPreset | null {
  return (
    REPORT_PRESETS.find((p) => {
      const r = presetRange(p, today);
      return r.from === from && r.to === to;
    }) ?? null
  );
}
