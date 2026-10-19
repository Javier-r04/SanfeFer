import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-primary">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p role="alert" className="font-semibold text-danger-ink">
        {errorMessage(error)}
      </p>
      {onRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      {icon}
      <p className="font-bold">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/** Tarjeta de indicador (KPI). */
export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-danger-ink' : tone === 'warning' ? 'text-warning-ink' : '';
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-extrabold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}
