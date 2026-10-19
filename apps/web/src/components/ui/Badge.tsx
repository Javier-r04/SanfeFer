import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'primary' | 'secondary' | 'danger' | 'warning' | 'highlight' | 'neutral';

const tones: Record<BadgeTone, string> = {
  primary: 'bg-primary-soft text-primary-ink',
  secondary: 'bg-secondary-soft text-secondary-ink',
  danger: 'bg-danger-soft text-danger-ink',
  warning: 'bg-warning-soft text-warning-ink',
  highlight: 'bg-highlight-soft text-highlight-ink',
  neutral: 'bg-surface-2 text-muted',
};

/** Etiqueta de estado: siempre texto (y punto o ícono), nunca solo color. */
export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-extrabold',
        tones[tone],
      )}
    >
      {icon ?? <span aria-hidden="true" className="size-2 rounded-full bg-current" />}
      {children}
    </span>
  );
}
