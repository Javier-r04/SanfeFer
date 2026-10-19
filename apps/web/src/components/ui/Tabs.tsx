import { useSearchParams } from 'react-router';
import { cn } from '@/lib/cn';

/** Pestañas guardadas en la URL (?tab=…) para que se puedan enlazar y sobrevivan a recargas. */
export function useTab<T extends string>(tabs: readonly T[], fallback: T) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as T | null;
  const tab = raw && tabs.includes(raw) ? raw : fallback;
  const setTab = (next: T) =>
    setParams(
      (p) => {
        const copy = new URLSearchParams(p);
        if (next === fallback) copy.delete('tab');
        else copy.set('tab', next);
        return copy;
      },
      { replace: true },
    );
  return [tab, setTab] as const;
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; badge?: number }[];
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-5 flex gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px flex h-12 shrink-0 items-center gap-2 border-b-[3px] px-4 text-[15px] font-bold transition',
            t.value === value
              ? 'border-primary text-primary-ink'
              : 'border-transparent text-muted hover:text-text',
          )}
        >
          {t.label}
          {t.badge ? (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-extrabold text-warning-ink">
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
