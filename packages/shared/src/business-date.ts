import { BUSINESS_TIMEZONE } from './constants';

const pad = (n: number) => String(n).padStart(2, '0');

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Día calendario (YYYY-MM-DD) al que pertenece un instante en la zona del negocio.
 * La jornada va de 00:00 a 23:59: lo cobrado a las 00:30 pertenece al día siguiente.
 */
export function getBusinessDate(date: Date = new Date(), timeZone = BUSINESS_TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Diferencia en ms entre la hora local de la zona y UTC para un instante dado. */
function offsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instante UTC en que empieza (00:00 local) el día indicado. */
export function startOfBusinessDay(businessDate: string, timeZone = BUSINESS_TIMEZONE): Date {
  const [y, m, d] = businessDate.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d);
  // Dos pasadas para cubrir zonas con cambio de horario.
  let instant = naive - offsetMs(naive, timeZone);
  instant = naive - offsetMs(instant, timeZone);
  return new Date(instant);
}

/** Rango [inicio, fin) en UTC que cubre el día calendario completo del negocio. */
export function businessDayRange(businessDate: string, timeZone = BUSINESS_TIMEZONE) {
  const start = startOfBusinessDay(businessDate, timeZone);
  const [y, m, d] = businessDate.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDate = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  return { start, end: startOfBusinessDay(nextDate, timeZone) };
}
