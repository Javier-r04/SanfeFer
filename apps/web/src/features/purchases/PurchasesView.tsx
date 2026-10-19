import { ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { usePurchases, useSuppliers, type PurchaseFilters } from './api';
import { formatBusinessDate } from './dates';
import { PurchaseDetailModal } from './PurchaseDetailModal';

export function PurchasesView() {
  const [filters, setFilters] = useState<PurchaseFilters>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const suppliers = useSuppliers(true);
  const purchases = usePurchases(filters);
  const rows = purchases.data?.pages.flatMap((p) => p.items) ?? [];
  const totalReceived = purchases.data?.pages[0]?.totalReceived;
  const set = (patch: Partial<PurchaseFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Proveedor">
          {(a) => (
            <Select
              {...a}
              value={filters.supplierId ?? ''}
              onChange={(e) =>
                set({ supplierId: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">Todos</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estado">
          {(a) => (
            <Select
              {...a}
              value={filters.status ?? ''}
              onChange={(e) =>
                set({ status: (e.target.value || undefined) as PurchaseFilters['status'] })
              }
            >
              <option value="">Todas</option>
              <option value="RECEIVED">Recibidas</option>
              <option value="VOIDED">Anuladas</option>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <StatCard
          label="Total comprado (sin anuladas)"
          value={totalReceived === undefined ? '—' : formatMoney(totalReceived)}
        />
      </div>

      {purchases.isPending ? (
        <LoadingState label="Cargando compras…" />
      ) : purchases.error ? (
        <ErrorState error={purchases.error} onRetry={() => void purchases.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptText aria-hidden="true" className="size-8 text-muted" />}
          title="No hay compras con esos filtros."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2/50 text-left text-muted">
                  <th className="px-4 py-3.5 font-bold">N.º</th>
                  <th className="px-4 py-3.5 font-bold">Fecha</th>
                  <th className="px-4 py-3.5 font-bold">Proveedor</th>
                  <th className="px-4 py-3.5 font-bold">Factura</th>
                  <th className="px-4 py-3.5 text-right font-bold">Artículos</th>
                  <th className="px-4 py-3.5 text-right font-bold">Total</th>
                  <th className="px-4 py-3.5 font-bold">Estado</th>
                  <th className="px-4 py-3.5">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-surface-2',
                      p.status === 'VOIDED' && 'text-muted',
                    )}
                  >
                    <td className="tabular px-4 py-3 font-bold">#{p.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatBusinessDate(p.purchasedAt)}
                    </td>
                    <td className="px-4 py-3 font-bold">{p.supplier.name}</td>
                    <td className="px-4 py-3">{p.invoiceNumber ?? '—'}</td>
                    <td className="tabular px-4 py-3 text-right">{p.itemCount}</td>
                    <td
                      className={cn(
                        'tabular px-4 py-3 text-right font-extrabold',
                        p.status === 'VOIDED' && 'line-through',
                      )}
                    >
                      {formatMoney(p.total)}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'VOIDED' ? (
                        <Badge tone="danger">Anulada</Badge>
                      ) : (
                        <Badge tone="primary">Recibida</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        onClick={() => setOpenId(p.id)}
                        aria-label={`Ver compra ${p.id}`}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-bold">{p.supplier.name}</span>
                      <span className="block text-sm text-muted">
                        #{p.id} · {formatBusinessDate(p.purchasedAt)}
                        {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'tabular text-lg font-extrabold',
                        p.status === 'VOIDED' && 'text-muted line-through',
                      )}
                    >
                      {formatMoney(p.total)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {p.status === 'VOIDED' ? (
                      <Badge tone="danger">Anulada</Badge>
                    ) : (
                      <Badge tone="primary">Recibida</Badge>
                    )}
                    {p.itemCount} artículo{p.itemCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {purchases.hasNextPage ? (
            <Button
              variant="outline"
              size="lg"
              className="self-center"
              loading={purchases.isFetchingNextPage}
              onClick={() => void purchases.fetchNextPage()}
            >
              Cargar más
            </Button>
          ) : null}
        </>
      )}

      <PurchaseDetailModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
