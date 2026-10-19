import { BarChart3, Table2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ColumnDatum {
  key: string;
  /** Etiqueta corta del eje. */
  label: string;
  /** Título completo del tooltip. */
  title: string;
  value: number;
  details?: { label: string; value: string }[];
}

/** Paso "redondo" (1, 2, 5 × 10ⁿ) para que el eje muestre números limpios. */
function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const PLOT_HEIGHT = 180;

/**
 * Gráfico de columnas de una sola serie. Cada columna es su propia zona de hover/foco
 * (toda la franja, no solo la barra) y se recorre con las flechas del teclado.
 */
export function ColumnChart({
  data,
  label,
  formatValue,
  formatTick,
}: {
  data: ColumnDatum[];
  label: string;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
}) {
  const [plotRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const max = Math.max(0, ...data.map((d) => d.value));
  const step = max > 0 ? niceStep(max / 4) : 1;
  const top = max > 0 ? Math.ceil(max / step) * step : 4;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const maxIndex = max > 0 ? data.findIndex((d) => d.value === max) : -1;

  // Mostrar solo las etiquetas del eje que caben (unos 48 px cada una).
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(width / 48))));
  const slot = width / Math.max(1, data.length);
  const shown = active ?? null;

  const onKey = (e: KeyboardEvent, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? i + 1
        : e.key === 'ArrowLeft'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? data.length - 1
              : null;
    if (next === null || next < 0 || next >= data.length) return;
    e.preventDefault();
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex gap-2">
      {/* Eje Y */}
      <div className="relative w-12 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
        {ticks.map((t) => (
          <span
            key={t}
            className="tabular absolute right-0 text-[11px] leading-none text-muted"
            style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}
          >
            {formatTick(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div ref={plotRef} className="relative" style={{ height: PLOT_HEIGHT }}>
          {/* Cuadrícula: líneas finas y sólidas, un paso por encima de la superficie */}
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden="true"
              className={cn('absolute inset-x-0 h-px', t === 0 ? 'bg-border-strong' : 'bg-border')}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div role="group" aria-label={label} className="absolute inset-0 flex">
            {data.map((d, i) => {
              const h = top > 0 ? (d.value / top) * 100 : 0;
              return (
                <button
                  key={d.key}
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  tabIndex={i === focusIndex ? 0 : -1}
                  aria-label={`${d.title}: ${formatValue(d.value)}${d.details?.length ? `, ${d.details.map((x) => `${x.label} ${x.value}`).join(', ')}` : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => {
                    setActive(i);
                    setFocusIndex(i);
                  }}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  onKeyDown={(e) => onKey(e, i)}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  {d.value > 0 ? (
                    <span
                      className={cn(
                        'block w-[70%] max-w-6 rounded-t-[4px] transition-colors',
                        shown === i ? 'bg-primary-ink' : 'bg-primary',
                      )}
                      style={{ height: `${Math.max(h, 1)}%` }}
                    />
                  ) : null}
                  {i === maxIndex && shown === null && slot >= 40 ? (
                    <span
                      aria-hidden="true"
                      className="tabular absolute left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-text"
                      style={{ bottom: `calc(${h}% + 4px)` }}
                    >
                      {formatTick(d.value)}
                    </span>
                  ) : null}
                  <span className="pointer-events-none absolute inset-0 rounded-md group-focus-visible:ring-2 group-focus-visible:ring-primary" />
                </button>
              );
            })}
          </div>
          {shown !== null && data[shown] ? (
            <Tooltip
              datum={data[shown]}
              formatValue={formatValue}
              x={(shown + 0.5) * slot}
              width={width}
            />
          ) : null}
        </div>
        {/* Eje X */}
        <div className="relative mt-1.5 h-5" aria-hidden="true">
          {data.map((d, i) =>
            i % every === 0 ? (
              <span
                key={d.key}
                className="absolute -translate-x-1/2 text-[11px] whitespace-nowrap text-muted"
                style={{ left: (i + 0.5) * slot }}
              >
                {d.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

function Tooltip({
  datum,
  formatValue,
  x,
  width,
}: {
  datum: ColumnDatum;
  formatValue: (v: number) => string;
  x: number;
  width: number;
}) {
  // Al lado de la columna para no taparla; si no cabe a ningún lado, centrado arriba.
  const TIP = 190;
  const left =
    x + 14 + TIP <= width
      ? x + 14
      : x - 14 - TIP >= 0
        ? x - 14 - TIP
        : Math.min(Math.max(x - TIP / 2, 0), Math.max(0, width - TIP));
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-0 z-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg"
      style={{ left, width: TIP }}
    >
      <p className="tabular text-base font-extrabold">{formatValue(datum.value)}</p>
      <p className="text-xs text-muted">{datum.title}</p>
      {datum.details?.map((x) => (
        <p key={x.label} className="mt-0.5 flex justify-between gap-2 text-xs">
          <span className="text-muted">{x.label}</span>
          <span className="tabular font-bold">{x.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Barras horizontales de una serie, con el valor en la punta. */
export function BarList({
  items,
  formatValue,
  empty,
}: {
  items: { key: string | number; label: string; value: number; note?: string }[];
  formatValue: (v: number) => string;
  empty: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="tabular mr-1.5 text-muted">{i + 1}.</span>
              <span className="font-bold">{item.label}</span>
            </span>
            <span className="tabular shrink-0">
              {item.note ? <span className="text-muted">{item.note} · </span> : null}
              <strong>{formatValue(item.value)}</strong>
            </span>
          </div>
          <div className="h-2 w-full" aria-hidden="true">
            {item.value > 0 ? (
              <div
                className="h-full rounded-r-[4px] bg-primary"
                style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 1) : 0}%` }}
              />
            ) : (
              <div className="h-full w-full rounded-[4px] bg-surface-2" />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Tarjeta de gráfico con alternador a vista de tabla (lo que el tooltip muestra, sin depender de él). */
export function ChartCard({
  title,
  subtitle,
  actions,
  chart,
  table,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chart: ReactNode;
  table?: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-extrabold">{title}</h2>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table ? (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-muted transition hover:bg-surface-2 hover:text-text"
            >
              {asTable ? (
                <BarChart3 aria-hidden="true" className="size-4" />
              ) : (
                <Table2 aria-hidden="true" className="size-4" />
              )}
              {asTable ? 'Gráfico' : 'Tabla'}
            </button>
          ) : null}
        </div>
      </header>
      {asTable && table ? <div className="max-h-80 overflow-auto">{table}</div> : chart}
    </section>
  );
}
