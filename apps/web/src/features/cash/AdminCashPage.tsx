import { getBusinessDate, type CashSessionDto } from '@sanfefer/shared';
import { Printer, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/ui/States';
import { Tabs, useTab } from '@/components/ui/Tabs';
import { PageHeader } from '@/features/common/ComingSoon';
import { useSettings } from '@/features/settings/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { printInBrowser } from '@/printing/print';
import { useCashSessions, useDaily } from './api';
import { CashSummary } from './CashSummary';
import { cashCloseDocument, dailyCloseDocument } from './close-documents';

function DifferenceBadge({ s }: { s: CashSessionDto }) {
  if (s.status === 'OPEN') return <Badge tone="warning">Abierta</Badge>;
  if (s.difference === 0) return <Badge tone="primary">Cuadra</Badge>;
  return (s.difference ?? 0) > 0 ? (
    <Badge tone="secondary">Sobran {formatMoney(s.difference!)}</Badge>
  ) : (
    <Badge tone="danger">Faltan {formatMoney(-s.difference!)}</Badge>
  );
}

function DailyView() {
  const [date, setDate] = useState(getBusinessDate());
  const daily = useDaily(date);
  const settings = useSettings();
  const d = daily.data;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Día" className="w-52">
          {(a) => (
            <Input
              {...a}
              type="date"
              value={date}
              max={getBusinessDate()}
              onChange={(e) => setDate(e.target.value || getBusinessDate())}
            />
          )}
        </Field>
        {d ? (
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              printInBrowser(dailyCloseDocument(d, settings.data), settings.data?.paperWidth ?? 80)
            }
          >
            <Printer aria-hidden="true" className="size-5" />
            Imprimir cierre del día
          </Button>
        ) : null}
      </div>
      <p className="-mt-2 text-sm text-muted">
        La jornada es el día calendario completo (00:00 a 23:59, hora de Guatemala). Cuenta la fecha
        del cobro.
      </p>
      {daily.isPending ? (
        <LoadingState />
      ) : daily.error ? (
        <ErrorState error={daily.error} onRetry={() => void daily.refetch()} />
      ) : d ? (
        <>
          {d.openTabs > 0 ? (
            <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning-ink">
              Hay {d.openTabs} cuenta{d.openTabs === 1 ? '' : 's'} abierta
              {d.openTabs === 1 ? '' : 's'} sin cobrar; no están incluidas.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total vendido" value={formatMoney(d.total)} />
            <StatCard label="Cuentas cobradas" value={d.tabsPaid} />
            <StatCard label="Ticket promedio" value={formatMoney(d.averageTicket)} />
            <StatCard label="Productos vendidos" value={d.unitsSold} />
            <StatCard label="Efectivo" value={formatMoney(d.cash)} />
            <StatCard label="Tarjeta" value={formatMoney(d.card)} />
            <StatCard
              label="Descuentos · servicio"
              value={`−${formatMoney(d.discounts)} · ${formatMoney(d.serviceCharges)}`}
            />
            <StatCard
              label="Cancelado"
              value={`${d.cancelled.units} u · ${formatMoney(d.cancelled.amount)}`}
              tone={d.cancelled.units ? 'warning' : undefined}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="mb-3 font-extrabold">Por vendedor</h2>
              {d.bySeller.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1.5 font-bold">Vendedor</th>
                      <th className="py-1.5 text-right font-bold">Cuentas</th>
                      <th className="py-1.5 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.bySeller.map((s) => (
                      <tr key={s.id} className="border-t border-surface-2">
                        <td className="py-2 font-bold">{s.name}</td>
                        <td className="tabular py-2 text-right">{s.tabs}</td>
                        <td className="tabular py-2 text-right font-extrabold">
                          {formatMoney(s.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted">Sin ventas este día.</p>
              )}
            </section>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="mb-3 font-extrabold">Más vendidos</h2>
              {d.topProducts.length ? (
                <ol className="flex flex-col gap-1.5 text-sm">
                  {d.topProducts.map((p, i) => (
                    <li
                      key={p.name}
                      className="flex justify-between gap-2 border-t border-surface-2 pt-1.5 first:border-t-0 first:pt-0"
                    >
                      <span>
                        <span className="tabular mr-2 text-muted">{i + 1}.</span>
                        <span className="font-bold">{p.name}</span>
                      </span>
                      <span className="tabular">
                        {p.quantity} u · <strong>{formatMoney(p.total)}</strong>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Sin ventas este día.</p>
              )}
            </section>
          </div>
          <section className="flex flex-col gap-2">
            <h2 className="font-extrabold">Cajas del día</h2>
            {d.sessions.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-bold">Caja #{s.id}</span>
                      <span className="text-muted"> · {s.openedBy.name.split(' ')[0]}</span>
                    </span>
                    <DifferenceBadge s={s} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No se abrió caja este día.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function HistoryView() {
  const sessions = useCashSessions();
  const settings = useSettings();
  const [selected, setSelected] = useState<CashSessionDto | null>(null);
  const rows = sessions.data?.pages.flatMap((p) => p.items) ?? [];
  if (sessions.isPending) return <LoadingState />;
  if (sessions.error)
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  if (!rows.length)
    return (
      <EmptyState
        icon={<Wallet aria-hidden="true" className="size-8 text-muted" />}
        title="Aún no hay cajas registradas."
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-surface-2/50 text-left text-muted">
              <th className="px-4 py-3 font-bold">Caja</th>
              <th className="px-4 py-3 font-bold">Apertura</th>
              <th className="px-4 py-3 font-bold">Cierre</th>
              <th className="px-4 py-3 text-right font-bold">Efectivo</th>
              <th className="px-4 py-3 text-right font-bold">Tarjeta</th>
              <th className="px-4 py-3 text-right font-bold">Debe haber</th>
              <th className="px-4 py-3 font-bold">Arqueo</th>
              <th className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-surface-2">
                <td className="px-4 py-3 font-bold">#{s.id}</td>
                <td className="px-4 py-3">
                  {formatDateTime(s.openedAt)}
                  <span className="block text-xs text-muted">{s.openedBy.name}</span>
                </td>
                <td className="px-4 py-3">
                  {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                  {s.closedBy ? (
                    <span className="block text-xs text-muted">{s.closedBy.name}</span>
                  ) : null}
                </td>
                <td className="tabular px-4 py-3 text-right">{formatMoney(s.cashSales)}</td>
                <td className="tabular px-4 py-3 text-right">{formatMoney(s.cardSales)}</td>
                <td className="tabular px-4 py-3 text-right font-bold">
                  {formatMoney(s.expectedCash)}
                </td>
                <td className="px-4 py-3">
                  <DifferenceBadge s={s} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="outline"
                    onClick={() => setSelected(s)}
                    aria-label={`Ver caja ${s.id}`}
                  >
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sessions.hasNextPage ? (
        <Button
          variant="outline"
          size="lg"
          className="self-center"
          loading={sessions.isFetchingNextPage}
          onClick={() => void sessions.fetchNextPage()}
        >
          Cargar más
        </Button>
      ) : null}
      {selected ? (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`Caja #${selected.id}`}
          footer={
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() =>
                printInBrowser(
                  cashCloseDocument(selected, settings.data),
                  settings.data?.paperWidth ?? 80,
                )
              }
            >
              <Printer aria-hidden="true" className="size-5" />
              Imprimir
            </Button>
          }
        >
          <CashSummary session={selected} />
        </Modal>
      ) : null}
    </div>
  );
}

const TABS = ['daily', 'history'] as const;

export function AdminCashPage() {
  const [tab, setTab] = useTab(TABS, 'daily');
  return (
    <div>
      <PageHeader
        title="Caja"
        subtitle="Cierre del día y arqueos de cada turno. La caja se abre y cierra desde el punto de venta."
      />
      <Tabs
        label="Secciones de caja"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'daily', label: 'Cierre del día' },
          { value: 'history', label: 'Historial de cajas' },
        ]}
      />
      {tab === 'daily' ? <DailyView /> : <HistoryView />}
    </div>
  );
}
