import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Marcador para módulos de fases posteriores. */
export function ComingSoon({
  title,
  phase,
  description,
  Icon = Construction,
}: {
  title: string;
  phase: number;
  description: string;
  Icon?: LucideIcon;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-ink">
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <p className="text-lg font-extrabold">Disponible en la Fase {phase}</p>
        <p className="max-w-md text-muted">{description}</p>
      </div>
    </div>
  );
}
