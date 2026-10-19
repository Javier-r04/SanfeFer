import { KIND_LABELS, type InventoryItemDto, type ManualMovementType } from '@sanfefer/shared';
import { ArrowDownUp, Boxes, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney, formatQty, formatUnitCost } from '@/lib/format';
import { toast } from '@/stores/toast';
import {
  useDeleteItem,
  useInventoryItems,
  useInventorySummary,
  useUpdateItem,
  type ItemFilters,
} from './api';
import { ItemFormModal } from './ItemFormModal';
import { MovementModal } from './MovementModal';
import { StockBadge } from './StockBadge';

type Filter = 'all' | 'SUPPLY' | 'RESALE' | 'alert';
type Confirm = { kind: 'toggle' | 'delete'; item: InventoryItemDto } | null;

export function ItemsView() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(params.get('alert') ? 'alert' : 'all');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formItem, setFormItem] = useState<InventoryItemDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [movement, setMovement] = useState<{
    item: InventoryItemDto;
    type: ManualMovementType;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const filters: ItemFilters = {
    kind: filter === 'SUPPLY' || filter === 'RESALE' ? filter : undefined,
    alert: filter === 'alert' || undefined,
    includeInactive: showInactive || undefined,
  };
  const items = useInventoryItems(filters);
  const summary = useInventorySummary();
  const update = useUpdateItem();
  const remove = useDeleteItem();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items.data ?? []).filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [items.data, search]);

  const openForm = (item?: InventoryItemDto) => {
    setFormItem(item);
    setFormOpen(true);
  };

  const runConfirm = () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    const opts = {
      onSettled: () => setConfirm(null),
      onError: (e: unknown) => toast.error(errorMessage(e)),
    };
    if (kind === 'toggle') {
      update.mutate(
        { id: item.id, input: { active: !item.active } },
        {
          ...opts,
          onSuccess: () =>
            toast.success(item.active ? `${item.name} desactivado.` : `${item.name} activado.`),
        },
      );
    } else {
      remove.mutate(item.id, {
        ...opts,
        onSuccess: () => toast.success(`${item.name} eliminado.`),
      });
    }
  };

  const rowActions = (i: InventoryItemDto) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="secondary"
        onClick={() => setMovement({ item: i, type: 'MANUAL_IN' })}
        disabled={!i.active}
      >
        <ArrowDownUp aria-hidden="true" className="size-4" />
        Movimiento
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => openForm(i)}
        aria-label={`Editar ${i.name}`}
        title="Editar"
      >
        <Pencil aria-hidden="true" className="size-[18px]" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirm({ kind: 'toggle', item: i })}
        aria-label={i.active ? `Desactivar ${i.name}` : `Activar ${i.name}`}
        title={i.active ? 'Desactivar' : 'Activar'}
      >
        <Power aria-hidden="true" className="size-[18px]" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-danger-ink"
        onClick={() => setConfirm({ kind: 'delete', item: i })}
        aria-label={`Eliminar ${i.name}`}
        title="Eliminar"
      >
        <Trash2 aria-hidden="true" className="size-[18px]" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Artículos activos" value={summary.data?.totalItems ?? '—'} />
        <StatCard
          label="Stock bajo"
          value={summary.data?.lowCount ?? '—'}
          tone={summary.data?.lowCount ? 'warning' : undefined}
        />
        <StatCard
          label="Agotados"
          value={summary.data?.outCount ?? '—'}
          tone={summary.data?.outCount ? 'danger' : undefined}
        />
        <StatCard
          label="Valor del inventario"
          value={summary.data ? formatMoney(summary.data.stockValue) : '—'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Filtrar artículos"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'SUPPLY', label: 'Insumos' },
            { value: 'RESALE', label: 'Reventa' },
            { value: 'alert', label: 'Con alerta' },
          ]}
        />
        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label="Buscar artículo"
            placeholder="Buscar artículo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
        <Switch checked={showInactive} onChange={setShowInactive} label="Ver inactivos" showLabel />
        <Button size="lg" onClick={() => openForm()}>
          <Plus aria-hidden="true" className="size-5" />
          Nuevo artículo
        </Button>
      </div>

      {items.isPending ? (
        <LoadingState label="Cargando inventario…" />
      ) : items.error ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Boxes aria-hidden="true" className="size-8 text-muted" />}
          title={
            filter === 'alert'
              ? 'No hay artículos con alerta. ¡Todo en orden!'
              : 'No hay artículos con ese filtro.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2/50 text-left text-muted">
                  <th className="px-4 py-3.5 font-bold">Artículo</th>
                  <th className="px-4 py-3.5 font-bold">Tipo</th>
                  <th className="px-4 py-3.5 text-right font-bold">Stock</th>
                  <th className="px-4 py-3.5 text-right font-bold">Mínimo</th>
                  <th className="px-4 py-3.5 text-right font-bold">Costo prom.</th>
                  <th className="px-4 py-3.5 font-bold">Estado</th>
                  <th className="px-4 py-3.5">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr
                    key={i.id}
                    className={cn('border-t border-surface-2', !i.active && 'opacity-60')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold">{i.name}</p>
                      <p className="text-xs text-muted">
                        {i.usedIn > 0
                          ? `En ${i.usedIn} receta${i.usedIn === 1 ? '' : 's'}`
                          : 'Sin recetas'}
                        {!i.active ? ' · Inactivo' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{KIND_LABELS[i.kind]}</td>
                    <td className="tabular px-4 py-3 text-right font-extrabold">
                      {formatQty(i.stock, i.unit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-muted">
                      {formatQty(i.minStock, i.unit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatUnitCost(i.averageCost)}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge status={i.status} />
                    </td>
                    <td className="px-4 py-2">{rowActions(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2.5 md:hidden">
            {visible.map((i) => (
              <li
                key={i.id}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
                  !i.active && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{i.name}</p>
                    <p className="text-sm text-muted">
                      {KIND_LABELS[i.kind]} · mín. {formatQty(i.minStock, i.unit)}
                    </p>
                  </div>
                  <StockBadge status={i.status} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="tabular text-xl font-extrabold">{formatQty(i.stock, i.unit)}</p>
                    <p className="text-xs text-muted">
                      Costo prom. {formatUnitCost(i.averageCost)}
                    </p>
                  </div>
                </div>
                {rowActions(i)}
              </li>
            ))}
          </ul>
        </>
      )}

      <ItemFormModal open={formOpen} item={formItem} onClose={() => setFormOpen(false)} />
      <MovementModal
        item={movement?.item ?? null}
        initialType={movement?.type}
        onClose={() => setMovement(null)}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={update.isPending || remove.isPending}
        tone={confirm?.kind === 'delete' || confirm?.item.active ? 'danger' : 'primary'}
        title={
          confirm?.kind === 'delete'
            ? 'Eliminar artículo'
            : confirm?.item.active
              ? 'Desactivar artículo'
              : 'Activar artículo'
        }
        confirmLabel={
          confirm?.kind === 'delete' ? 'Eliminar' : confirm?.item.active ? 'Desactivar' : 'Activar'
        }
        message={
          confirm?.kind === 'delete'
            ? `¿Eliminar ${confirm.item.name}? Solo se puede si no tiene movimientos ni se usa en recetas; si no, desactívalo.`
            : confirm?.item.active
              ? `${confirm.item.name} dejará de aparecer en el inventario y no se podrán registrar movimientos. Su historial se conserva.`
              : `${confirm?.item.name ?? ''} volverá a aparecer en el inventario.`
        }
      />
    </div>
  );
}
