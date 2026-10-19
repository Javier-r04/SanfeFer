import {
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  type MovementDto,
  type MovementType,
} from '@sanfefer/shared';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQty, formatUnitCost } from '@/lib/format';
import { useInventoryItems, useMovements, type MovementFilters } from './api';

const typeTone: Record<MovementType, BadgeTone> = {
  INITIAL: 'neutral',
  PURCHASE: 'primary',
  PURCHASE_VOID: 'danger',
  SALE: 'secondary',
  SALE_VOID: 'secondary',
  WASTE: 'danger',
  MANUAL_IN: 'primary',
  ADJUSTMENT: 'highlight',
};

function Quantity({ m }: { m: MovementDto }) {
  const positive = m.quantity > 0;
  return (
    <span
      className={cn('tabular font-extrabold', positive ? 'text-primary-ink' : 'text-danger-ink')}
    >
      {positive ? '+' : '−'}
      {formatQty(Math.abs(m.quantity), m.item.unit)}
    </span>
  );
}

export function MovementsView() {
  const [filters, setFilters] = useState<MovementFilters>({});
  const items = useInventoryItems({ includeInactive: true });
  const movements = useMovements(filters);
  const rows = movements.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (patch: Partial<MovementFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Artículo">
          {(a) => (
            <Select
              {...a}
              value={filters.itemId ?? ''}
              onChange={(e) => set({ itemId: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Todos</option>
              {items.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tipo">
          {(a) => (
            <Select
              {...a}
              value={filters.type ?? ''}
              onChange={(e) => set({ type: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Desde">
          {(a) => (
            <Input
              {...a}
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => set({ from: e.target.value || undefined })}
            />
          )}
        </Field>
        <Field label="Hasta">
          {(a) => (
            <Input
              {...a}
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => set({ to: e.target.value || undefined })}
            />
          )}
        </Field>
      </div>

      {movements.isPending ? (
        <LoadingState label="Cargando movimientos…" />
      ) : movements.error ? (
        <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden="true" className="size-8 text-muted" />}
          title="No hay movimientos con esos filtros."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2/50 text-left text-muted">
                  <th className="px-4 py-3.5 font-bold">Fecha</th>
                  <th className="px-4 py-3.5 font-bold">Artículo</th>
                  <th className="px-4 py-3.5 font-bold">Tipo</th>
                  <th className="px-4 py-3.5 text-right font-bold">Cantidad</th>
                  <th className="px-4 py-3.5 text-right font-bold">Quedó</th>
                  <th className="px-4 py-3.5 text-right font-bold">Costo u.</th>
                  <th className="px-4 py-3.5 font-bold">Usuario</th>
                  <th className="px-4 py-3.5 font-bold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-surface-2">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-bold">{m.item.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={typeTone[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Quantity m={m} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatQty(m.stockAfter, m.item.unit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-muted">
                      {m.unitCost === null ? '—' : formatUnitCost(m.unitCost)}
                    </td>
                    <td className="px-4 py-3">{m.user.name}</td>
                    <td className="max-w-56 px-4 py-3 text-muted">{m.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{m.item.name}</p>
                  <Quantity m={m} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge tone={typeTone[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>
                  <span>Quedó {formatQty(m.stockAfter, m.item.unit)}</span>
                </div>
                <p className="text-xs text-muted">
                  {formatDateTime(m.createdAt)} · {m.user.name}
                  {m.reason ? ` · ${m.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>

          {movements.hasNextPage ? (
            <Button
              variant="outline"
              size="lg"
              className="self-center"
              loading={movements.isFetchingNextPage}
              onClick={() => void movements.fetchNextPage()}
            >
              Cargar más
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
