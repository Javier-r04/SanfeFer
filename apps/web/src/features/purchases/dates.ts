import { getBusinessDate } from '@sanfefer/shared';

const fmt = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeZone: 'UTC' });

/** "2026-10-15" → "15 oct 2026" (fecha sin hora: se formatea en UTC para no correr el día). */
export const formatBusinessDate = (date: string) => fmt.format(new Date(`${date}T00:00:00Z`));

export const today = () => getBusinessDate();
