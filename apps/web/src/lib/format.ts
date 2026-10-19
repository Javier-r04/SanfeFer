const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});
const time = new Intl.DateTimeFormat('es-GT', {
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export const formatDateTime = (iso: string | Date) => dateTime.format(new Date(iso));
export const formatTime = (iso: string | Date) => time.format(new Date(iso));
export const formatMoney = (value: number | string) => money.format(Number(value));
