import { Download, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { toast } from '@/stores/toast';
import { change } from './report-format';

/** Variación contra el periodo anterior: flecha + porcentaje (nunca solo color). */
export function Delta({ current, previous }: { current: number; previous: number }) {
  const ratio = change(current, previous);
  if (ratio === null)
    return (
      <span className="text-muted">
        {current ? 'Sin ventas en el periodo anterior' : 'Sin ventas'}
      </span>
    );
  const flat = Math.abs(ratio) < 0.005;
  const up = ratio > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-bold',
        flat ? 'text-muted' : up ? 'text-primary-ink' : 'text-danger-ink',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {flat ? 'Igual' : `${up ? '+' : '−'}${formatPercent(Math.abs(ratio))}`}
      <span className="font-normal text-muted">vs. periodo anterior</span>
    </span>
  );
}

/** Indicador con su comparación. Las cifras grandes usan números proporcionales. */
export function KpiCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="truncate text-2xl font-extrabold tracking-tight sm:text-[28px]">{value}</p>
      {footer ? <div className="text-[13px]">{footer}</div> : null}
    </div>
  );
}

/** Botón de exportar: acepta filas ya cargadas o una función que las pide. */
export function CsvButton({
  onExport,
  label = 'CSV',
  disabled,
}: {
  onExport: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="md"
      loading={busy}
      disabled={disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await onExport();
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? null : <Download aria-hidden="true" className="size-4" />}
      {label}
    </Button>
  );
}

/** Contenido atenuado mientras llega el reporte del nuevo periodo (sin saltos de diseño). */
export function Refreshing({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      aria-busy={active}
      className={cn('flex flex-col gap-4 transition-opacity', active && 'opacity-60')}
    >
      {children}
    </div>
  );
}

/** Tabla simple con encabezado gris y números alineados a la derecha. */
export function DataTable({
  label,
  head,
  children,
  foot,
  minWidth,
}: {
  /** Nombre de la tabla para lectores de pantalla (también nombra la zona desplazable). */
  label: string;
  head: { label: string; numeric?: boolean }[];
  children: ReactNode;
  foot?: ReactNode;
  minWidth?: number;
}) {
  return (
    // En celular la tabla se desplaza de lado: el contenedor recibe foco para moverla con el teclado.
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-2xl border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="bg-surface-2/50 text-left text-muted">
            {head.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn('px-4 py-3 font-bold whitespace-nowrap', h.numeric && 'text-right')}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">{children}</tbody>
        {foot ? (
          <tfoot className="tabular border-t-2 border-border font-extrabold">{foot}</tfoot>
        ) : null}
      </table>
    </div>
  );
}

export const td = 'px-4 py-2.5 border-t border-surface-2';
export const tdNum = `${td} text-right whitespace-nowrap`;
