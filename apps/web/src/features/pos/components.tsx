import type { OrderItemStatus } from '@sanfefer/shared';
import { Check, ChevronLeft, Clock, Flame, Minus, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

const STATUS: Record<OrderItemStatus, { label: string; tone: BadgeTone; Icon: typeof Check }> = {
  PENDING: { label: 'Pendiente', tone: 'warning', Icon: Clock },
  PREPARING: { label: 'Preparando', tone: 'highlight', Icon: Flame },
  DELIVERED: { label: 'Entregado', tone: 'primary', Icon: Check },
  CANCELLED: { label: 'Cancelado', tone: 'danger', Icon: X },
};

export function ItemStatusBadge({ status }: { status: OrderItemStatus }) {
  const { label, tone, Icon } = STATUS[status];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden="true" className="size-3.5" strokeWidth={2.6} />}>
      {label}
    </Badge>
  );
}

/** Encabezado de las pantallas del POS: volver, título y acciones. */
export function PosHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Volver',
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg/95 px-3 py-2.5 backdrop-blur">
      {backTo ? (
        <Link
          to={backTo}
          aria-label={backLabel}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>
      ) : null}
      <div className={cn('min-w-0 flex-1', !backTo && 'pl-1')}>
        <h1 className="truncate font-display text-[22px] leading-tight font-extrabold">{title}</h1>
        {subtitle ? <p className="truncate text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <ThemeToggle variant="icon" />
      </div>
    </header>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  size = 'lg',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'md' | 'lg';
}) {
  const btn = cn(
    'grid place-items-center disabled:opacity-40',
    size === 'lg' ? 'size-14' : 'size-11',
  );
  return (
    <div
      className="flex items-center rounded-2xl border-[1.5px] border-border"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Quitar uno (${label})`}
      >
        <Minus aria-hidden="true" className="size-5" strokeWidth={2.6} />
      </button>
      <span className="tabular w-8 text-center text-xl font-extrabold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Agregar uno (${label})`}
      >
        <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
      </button>
    </div>
  );
}
