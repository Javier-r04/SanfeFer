import { UNIT_LABELS, type MeasureUnit } from '@sanfefer/shared';

const tz = 'America/Guatemala';
const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: tz,
});
const time = new Intl.DateTimeFormat('es-GT', { timeStyle: 'short', timeZone: tz });
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const number = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat('es-GT', { style: 'percent', maximumFractionDigits: 0 });

export const formatDateTime = (iso: string | Date) => dateTime.format(new Date(iso));
export const formatTime = (iso: string | Date) => time.format(new Date(iso));
export const formatMoney = (value: number | string) => money.format(Number(value));
export const formatNumber = (value: number) => number.format(value);
export const formatPercent = (ratio: number) => percent.format(ratio);
export const formatQty = (value: number, unit: MeasureUnit) =>
  `${number.format(value)} ${UNIT_LABELS[unit]}`;

/** Costos unitarios pequeños (Q 0.0238 por ml) necesitan más decimales. */
export function formatUnitCost(value: number) {
  const digits = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}
