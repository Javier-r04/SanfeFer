import type { ModifierGroupDto } from '@sanfefer/shared';
import { ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useDeleteModifierGroup, useModifierGroups, useSetModifierGroupActive } from './api';
import { selectionRule } from './catalog-utils';
import { ModifierGroupFormModal } from './ModifierGroupFormModal';

export function ModifierGroupsView() {
  const groups = useModifierGroups();
  const setActive = useSetModifierGroupActive();
  const remove = useDeleteModifierGroup();
  const [editing, setEditing] = useState<ModifierGroupDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ModifierGroupDto | null>(null);

  if (groups.isPending) return <LoadingState />;
  if (groups.error)
    return <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />;

  const openForm = (g?: ModifierGroupDto) => {
    setEditing(g);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Opciones que el vendedor elige al agregar un producto. Cada opción puede tener recargo y
          descontar inventario.
        </p>
        <Button size="lg" onClick={() => openForm()}>
          <Plus aria-hidden="true" className="size-5" />
          Nuevo grupo
        </Button>
      </div>
      {groups.data.length === 0 ? (
        <EmptyState
          icon={<ListPlus aria-hidden="true" className="size-8 text-muted" />}
          title="Aún no hay grupos de extras."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.data.map((g) => (
            <article
              key={g.id}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
                !g.active && 'opacity-70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold">{g.name}</h3>
                  <p className="text-sm text-muted">
                    {selectionRule(g.minSelect, g.maxSelect)} · en {g.productCount} producto
                    {g.productCount === 1 ? '' : 's'}
                  </p>
                </div>
                <Switch
                  checked={g.active}
                  onChange={(active) =>
                    setActive.mutate(
                      { id: g.id, active },
                      { onError: (e) => toast.error(errorMessage(e)) },
                    )
                  }
                  label={`${g.name} activo`}
                />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {g.options.map((o) => (
                  <li
                    key={o.id}
                    className={cn(
                      'rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold',
                      !o.active && 'line-through opacity-60',
                    )}
                  >
                    {o.name}
                    {o.priceDelta > 0 ? (
                      <span className="text-muted"> +{formatMoney(o.priceDelta)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2">
                {g.options.some((o) => o.components.length) ? (
                  <Badge tone="secondary">Descuenta inventario</Badge>
                ) : (
                  <span className="text-sm text-muted">No descuenta inventario</span>
                )}
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openForm(g)}
                    aria-label={`Editar ${g.name}`}
                    title="Editar"
                  >
                    <Pencil aria-hidden="true" className="size-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger-ink"
                    onClick={() => setToDelete(g)}
                    aria-label={`Eliminar ${g.name}`}
                    title="Eliminar"
                  >
                    <Trash2 aria-hidden="true" className="size-[18px]" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <ModifierGroupFormModal open={formOpen} group={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        tone="danger"
        title="Eliminar grupo de extras"
        confirmLabel="Eliminar"
        loading={remove.isPending}
        message={`¿Eliminar ${toDelete?.name ?? ''}? Solo se puede si ningún producto lo usa. Las ventas pasadas conservan los extras elegidos.`}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success(`${toDelete.name} eliminado.`),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </div>
  );
}
