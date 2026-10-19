import type { SupplierDto } from '@sanfefer/shared';
import { Mail, Pencil, Phone, Plus, Power, Trash2, Truck } from 'lucide-react';
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
import { useDeleteSupplier, useSuppliers, useUpdateSupplier } from './api';
import { formatBusinessDate } from './dates';
import { SupplierFormModal } from './SupplierFormModal';

type Confirm = { kind: 'toggle' | 'delete'; supplier: SupplierDto } | null;

export function SuppliersView() {
  const [showInactive, setShowInactive] = useState(false);
  const suppliers = useSuppliers(showInactive);
  const update = useUpdateSupplier();
  const remove = useDeleteSupplier();
  const [editing, setEditing] = useState<SupplierDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const openForm = (s?: SupplierDto) => {
    setEditing(s);
    setFormOpen(true);
  };

  const runConfirm = () => {
    if (!confirm) return;
    const { kind, supplier: s } = confirm;
    const opts = {
      onSettled: () => setConfirm(null),
      onError: (e: unknown) => toast.error(errorMessage(e)),
    };
    if (kind === 'toggle') {
      update.mutate(
        { id: s.id, input: { active: !s.active } },
        {
          ...opts,
          onSuccess: () =>
            toast.success(s.active ? `${s.name} desactivado.` : `${s.name} activado.`),
        },
      );
    } else {
      remove.mutate(s.id, { ...opts, onSuccess: () => toast.success(`${s.name} eliminado.`) });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch checked={showInactive} onChange={setShowInactive} label="Ver inactivos" showLabel />
        <Button size="lg" onClick={() => openForm()}>
          <Plus aria-hidden="true" className="size-5" />
          Nuevo proveedor
        </Button>
      </div>
      {suppliers.isPending ? (
        <LoadingState label="Cargando proveedores…" />
      ) : suppliers.error ? (
        <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />
      ) : suppliers.data.length === 0 ? (
        <EmptyState
          icon={<Truck aria-hidden="true" className="size-8 text-muted" />}
          title="Aún no hay proveedores."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {suppliers.data.map((s) => (
            <article
              key={s.id}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
                !s.active && 'opacity-70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold">{s.name}</h3>
                  <p className="text-sm text-muted">
                    {[s.contactName, s.taxId ? `NIT ${s.taxId}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Sin contacto registrado'}
                  </p>
                </div>
                {s.active ? null : <Badge tone="neutral">Inactivo</Badge>}
              </div>
              {s.phone || s.email ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-secondary-ink"
                    >
                      <Phone aria-hidden="true" className="size-4" />
                      {s.phone}
                    </a>
                  ) : null}
                  {s.email ? (
                    <a
                      href={`mailto:${s.email}`}
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-secondary-ink"
                    >
                      <Mail aria-hidden="true" className="size-4" />
                      {s.email}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {s.notes ? <p className="text-sm text-muted">{s.notes}</p> : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 pt-3">
                <p className="text-sm">
                  <strong className="tabular">{formatMoney(s.totalPurchased)}</strong>
                  <span className="text-muted">
                    {' '}
                    en {s.purchaseCount} compra{s.purchaseCount === 1 ? '' : 's'}
                    {s.lastPurchaseAt ? ` · última ${formatBusinessDate(s.lastPurchaseAt)}` : ''}
                  </span>
                </p>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openForm(s)}
                    aria-label={`Editar ${s.name}`}
                    title="Editar"
                  >
                    <Pencil aria-hidden="true" className="size-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirm({ kind: 'toggle', supplier: s })}
                    aria-label={s.active ? `Desactivar ${s.name}` : `Activar ${s.name}`}
                    title={s.active ? 'Desactivar' : 'Activar'}
                  >
                    <Power aria-hidden="true" className="size-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger-ink"
                    onClick={() => setConfirm({ kind: 'delete', supplier: s })}
                    aria-label={`Eliminar ${s.name}`}
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
      <SupplierFormModal open={formOpen} supplier={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={update.isPending || remove.isPending}
        tone={confirm?.kind === 'delete' || confirm?.supplier.active ? 'danger' : 'primary'}
        title={
          confirm?.kind === 'delete'
            ? 'Eliminar proveedor'
            : confirm?.supplier.active
              ? 'Desactivar proveedor'
              : 'Activar proveedor'
        }
        confirmLabel={
          confirm?.kind === 'delete'
            ? 'Eliminar'
            : confirm?.supplier.active
              ? 'Desactivar'
              : 'Activar'
        }
        message={
          confirm?.kind === 'delete'
            ? `¿Eliminar a ${confirm.supplier.name}? Solo se puede si no tiene compras registradas.`
            : confirm?.supplier.active
              ? `No podrás registrarle compras a ${confirm.supplier.name}. Su historial se conserva.`
              : `Podrás volver a registrarle compras a ${confirm?.supplier.name ?? ''}.`
        }
      />
    </div>
  );
}
