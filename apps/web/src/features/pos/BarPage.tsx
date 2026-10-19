import type { BarOrderDto, OrderItemStatus } from '@sanfefer/shared';
import { CupSoda } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast';
import { useAdvanceOrder, useBar, useSetItemStatus } from './api';
import { ItemStatusBadge, PosHeader } from './components';
import { barColumn, minutesSince, NEXT_STATUS, timeAgo, useNow } from './pos-utils';

type Column = Exclude<OrderItemStatus, 'CANCELLED'>;

const COLUMNS: { key: Column; label: string; chip: string }[] = [
  { key: 'PENDING', label: 'Pendiente', chip: 'bg-warning-soft text-warning-ink' },
  { key: 'PREPARING', label: 'Preparando', chip: 'bg-highlight-soft text-highlight-ink' },
  { key: 'DELIVERED', label: 'Entregado', chip: 'bg-primary-soft text-primary-ink' },
];

/** Minutos de espera a partir de los cuales una comanda pendiente se resalta. */
const LATE_MINUTES = 10;

function OrderCard({ order, now }: { order: BarOrderDto; now: number }) {
  const advance = useAdvanceOrder();
  const setStatus = useSetItemStatus();
  const column = barColumn(order);
  const late = column === 'PENDING' && minutesSince(order.sentAt, now) >= LATE_MINUTES;
  const where = order.tab.tableName
    ? `${order.tab.tableName} · ${order.tab.customerName}`
    : `${order.tab.customerName} · sin mesa`;

  const run = (to: 'PREPARING' | 'DELIVERED') =>
    advance.mutate({ id: order.id, to }, { onError: (e) => toast.error(errorMessage(e)) });

  return (
    <article
      aria-label={`Comanda ${order.id}, ${where}`}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-surface p-3.5',
        late ? 'border-danger' : 'border-border',
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-[17px] font-extrabold">{where}</h3>
        <span
          className={cn('shrink-0 text-[13px] font-bold', late ? 'text-danger-ink' : 'text-muted')}
        >
          {timeAgo(order.sentAt, now)}
        </span>
      </header>
      <ul className="flex flex-col gap-2">
        {order.items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() =>
                setStatus.mutate(
                  { id: i.id, status: NEXT_STATUS[i.status as Column] },
                  { onError: (e) => toast.error(errorMessage(e)) },
                )
              }
              aria-label={`${i.quantity} ${i.productName}: ${i.status === 'DELIVERED' ? 'volver a pendiente' : 'avanzar estado'}`}
              className={cn(
                'flex w-full items-start gap-2 rounded-xl p-1.5 text-left hover:bg-surface-2',
                i.status === 'DELIVERED' && column !== 'DELIVERED' && 'opacity-55',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">
                  {i.quantity}× {i.productName}
                </span>
                {i.modifiers.length ? (
                  <span className="block text-sm text-muted">
                    {i.modifiers.map((m) => m.optionName).join(' · ')}
                  </span>
                ) : null}
                {i.note ? (
                  <span className="block text-sm font-bold text-warning-ink">Nota: {i.note}</span>
                ) : null}
              </span>
              {column !== 'DELIVERED' ? <ItemStatusBadge status={i.status} /> : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Comanda #{order.id} · {order.createdBy.name.split(' ')[0]}
      </p>
      {column === 'PENDING' ? (
        <Button
          size="lg"
          variant="highlight"
          loading={advance.isPending}
          onClick={() => run('PREPARING')}
        >
          Empezar
        </Button>
      ) : column === 'PREPARING' ? (
        <Button size="lg" loading={advance.isPending} onClick={() => run('DELIVERED')}>
          Entregar
        </Button>
      ) : null}
    </article>
  );
}

export function BarPage() {
  const bar = useBar();
  const now = useNow(15_000);
  const [mobileColumn, setMobileColumn] = useState<Column>('PENDING');
  const grouped = (key: Column) => (bar.data?.orders ?? []).filter((o) => barColumn(o) === key);
  // Entregadas: las más recientes primero.
  const ordered = (key: Column) =>
    key === 'DELIVERED' ? [...grouped(key)].reverse() : grouped(key);

  return (
    <div className="flex flex-col">
      <PosHeader
        title="Barra"
        subtitle="Se actualiza sola cada 5 segundos · toca un producto para cambiar su estado"
      />
      {bar.isPending ? (
        <LoadingState label="Cargando comandas…" />
      ) : bar.error ? (
        <ErrorState error={bar.error} onRetry={() => void bar.refetch()} />
      ) : bar.data.orders.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<CupSoda aria-hidden="true" className="size-8 text-muted" />}
            title="No hay comandas por preparar."
          >
            Las órdenes que envíen los vendedores aparecerán aquí.
          </EmptyState>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="lg:hidden">
            <Segmented
              label="Columna"
              value={mobileColumn}
              onChange={setMobileColumn}
              options={COLUMNS.map((c) => ({
                value: c.key,
                label: `${c.label} (${grouped(c.key).length})`,
              }))}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((c) => (
              <section
                key={c.key}
                aria-label={c.label}
                className={cn(
                  'flex flex-col gap-3 rounded-3xl bg-surface-2/60 p-3',
                  c.key !== mobileColumn && 'hidden lg:flex',
                )}
              >
                <h2 className="flex items-center gap-2 text-base font-extrabold">
                  <span className={cn('rounded-full px-3 py-1 text-sm', c.chip)}>{c.label}</span>
                  <span className="text-muted">
                    {c.key === 'DELIVERED' ? 'últimos 15 min' : grouped(c.key).length}
                  </span>
                </h2>
                {ordered(c.key).length === 0 ? (
                  <p className="px-1 py-4 text-sm text-muted">Nada por aquí.</p>
                ) : (
                  ordered(c.key).map((o) => <OrderCard key={o.id} order={o} now={now} />)
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
