import { useEffect, useState } from 'react';

/** "ahora", "hace 5 min", "hace 1 h 10 min". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `hace ${h} h${m ? ` ${m} min` : ''}`;
}

/** Re-renderiza cada `ms` para que los "hace X min" avancen solos. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const QUICK_NOTES = [
  'Sin hielo',
  'Poco hielo',
  'Extra limón',
  'Bien fría',
  'Para llevar a la mesa',
];
