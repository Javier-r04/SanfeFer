import type { OrderItemDto } from '@sanfefer/shared';
import {
  ArrowLeftRight,
  MoreHorizontal,
  Percent,
  Plus,
  ReceiptText,
  ShoppingBag,
  Split,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSettings } from '@/features/settings/api';
import { formatMoney, formatTime } from '@/lib/format';
import { TicketModal } from '@/printing/TicketModal';
import { toast } from '@/stores/toast';
import { useCloseZeroTab, useOpenTab, useSetCharges, useTab } from './api';
import { cartTotals, useTabCart } from './cart';
import { ItemStatusBadge, PosHeader } from './components';
import { DiscountModal } from './DiscountModal';
import { ItemActionsModal } from './ItemActionsModal';
import { MoveItemsModal } from './MoveItemsModal';
import { timeAgo, useNow } from './pos-utils';
import { TabOptionsModal } from './TabOptionsModal';

export function TabPage() {
  const tabId = Number(useParams().tabId);
  const tab = useTab(tabId);
  const openTab = useOpenTab();
  const navigate = useNavigate();
  const draft = useTabCart(tabId);
  const now = useNow();
  const [selected, setSelected] = useState<OrderItemDto | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<'move' | 'split' | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const settings = useSettings();
  const setCharges = useSetCharges();
  const closeZero = useCloseZeroTab();

  if (tab.isPending) return <LoadingState label="Cargando cuenta…" />;
  if (tab.error) {
    return (
      <div>
        <PosHeader title="Cuenta" backTo="/pos" backLabel="Volver a mesas" />
        <ErrorState error={tab.error} onRetry={() => void tab.refetch()} />
      </div>
    );
  }
  const t = tab.data;
  const b = t.billing;
  const open = t.status === 'OPEN';
  const draftTotals = cartTotals(draft);
  const hasItems = t.itemCount > 0;

  const toggleService = () =>
    setCharges.mutate(
      {
        tabId: t.id,
        input: {
          serviceChargeRate: b.serviceChargeRate ? null : (settings.data?.serviceChargeRate ?? 10),
        },
      },
      { onError: (e) => toast.error(errorMessage(e)) },
    );

  const addCustomer = () =>
    openTab.mutate(
      { tableId: t.tableId },
      {
        onSuccess: ({ tab: created }) => navigate(`/pos/cuentas/${created.id}/orden`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <PosHeader
        title={t.table ? t.table.name : t.customerName}
        subtitle={`${t.table ? 'Mesa' : 'Cliente sin mesa'} · abierta ${timeAgo(t.openedAt, now)} por ${t.openedBy.name.split(' ')[0]}`}
        backTo="/pos"
        backLabel="Volver a mesas"
        actions={
          <>
            {hasItems ? (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTicketOpen(true)}
                aria-label={open ? 'Ver pre-cuenta' : 'Ver comprobante'}
                title={open ? 'Pre-cuenta' : 'Comprobante'}
              >
                <ReceiptText aria-hidden="true" className="size-5" />
              </Button>
            ) : null}
            {open ? (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOptionsOpen(true)}
                aria-label="Opciones de la cuenta"
              >
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 pt-3 pb-60 sm:px-4">
        {t.table && open ? (
          <nav
            aria-label="Cuentas de la mesa"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {t.siblings.map((s) => (
              <Link
                key={s.id}
                to={`/pos/cuentas/${s.id}`}
                replace
                aria-current={s.id === t.id ? 'page' : undefined}
                className={cn(
                  'flex h-14 shrink-0 flex-col justify-center rounded-2xl px-3.5 text-sm font-bold',
                  s.id === t.id ? 'bg-text text-bg' : 'border-[1.5px] border-border bg-surface',
                )}
              >
                {s.customerName}
                <span
                  className={cn(
                    'tabular text-xs font-semibold',
                    s.id === t.id ? 'opacity-80' : 'text-muted',
                  )}
                >
                  {formatMoney(s.subtotal)}
                </span>
              </Link>
            ))}
            <button
              type="button"
              onClick={addCustomer}
              disabled={openTab.isPending}
              aria-label="Agregar otro cliente a la mesa"
              title="Agregar cliente"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-[1.5px] border-dashed border-border-strong text-primary-ink"
            >
              <Plus aria-hidden="true" className="size-6" strokeWidth={2.6} />
            </button>
          </nav>
        ) : (
          <p className="text-lg font-extrabold">{t.customerName}</p>
        )}

        {!open ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold">
            Esta cuenta está {t.status === 'PAID' ? 'cobrada' : 'cancelada'}
            {t.closedBy ? ` (${t.closedBy.name.split(' ')[0]})` : ''}.
          </p>
        ) : null}

        {draft.length ? (
          <Link
            to={`/pos/cuentas/${t.id}/orden`}
            className="flex items-center gap-3 rounded-2xl border-[1.5px] border-warning bg-warning-soft px-4 py-3 text-warning-ink"
          >
            <ShoppingBag aria-hidden="true" className="size-5 shrink-0" />
            <span className="flex-1 text-sm font-bold">
              {draftTotals.units} producto{draftTotals.units === 1 ? '' : 's'} sin enviar a barra
            </span>
            <span className="text-sm font-extrabold underline underline-offset-4">Continuar</span>
          </Link>
        ) : null}

        {open && hasItems ? (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Acciones de la cuenta">
            {[
              {
                label: 'Mover',
                Icon: ArrowLeftRight,
                onClick: () => setMoveMode('move'),
                on: false,
              },
              { label: 'Dividir', Icon: Split, onClick: () => setMoveMode('split'), on: false },
              {
                label: 'Descuento',
                Icon: Percent,
                onClick: () => setDiscountOpen(true),
                on: !!b.discount,
              },
              {
                label: `Servicio ${b.serviceChargeRate ?? settings.data?.serviceChargeRate ?? 10}%`,
                Icon: null,
                onClick: toggleService,
                on: !!b.serviceChargeRate,
              },
            ].map(({ label, Icon, onClick, on }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                aria-pressed={
                  label.startsWith('Servicio') || label === 'Descuento' ? on : undefined
                }
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold',
                  on
                    ? 'border-primary bg-primary-soft text-primary-ink'
                    : 'border-border bg-surface',
                )}
              >
                {Icon ? (
                  <Icon aria-hidden="true" className="size-5" />
                ) : (
                  <span className="text-[15px] font-extrabold">%</span>
                )}
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {t.orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag aria-hidden="true" className="size-8 text-muted" />}
            title="Aún no hay productos."
          >
            Toca «Agregar» para tomar la orden.
          </EmptyState>
        ) : (
          t.orders.map((o) => (
            <section key={o.id} aria-label={`Comanda ${o.id}`} className="flex flex-col gap-2">
              <h2 className="text-xs font-extrabold tracking-wider text-muted uppercase">
                Comanda #{o.id} · {formatTime(o.sentAt)} · {o.createdBy.name.split(' ')[0]}
              </h2>
              {o.items.map((item) => {
                const cancelled = item.status === 'CANCELLED';
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!open || cancelled}
                    onClick={() => setSelected(item)}
                    className={cn(
                      'flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-3 text-left',
                      cancelled && 'opacity-60',
                    )}
                  >
                    <span className="flex w-full items-start gap-2.5">
                      <span className="tabular min-w-7 text-[15px] font-extrabold">
                        {item.quantity}×
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block font-bold', cancelled && 'line-through')}>
                          {item.productName}
                        </span>
                        {item.modifiers.length ? (
                          <span className="block text-[13px] text-muted">
                            {item.modifiers.map((m) => m.optionName).join(' · ')}
                          </span>
                        ) : null}
                        {item.note ? (
                          <span className="block text-[13px] font-semibold text-warning-ink">
                            Nota: {item.note}
                          </span>
                        ) : null}
                        {cancelled && item.cancelReason ? (
                          <span className="block text-[13px] text-danger-ink">
                            Motivo: {item.cancelReason}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn('tabular font-extrabold', cancelled && 'line-through')}>
                        {formatMoney(item.lineTotal)}
                      </span>
                    </span>
                    <span className="self-start">
                      <ItemStatusBadge status={item.status} />
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <dl className="flex flex-col gap-0.5 text-sm">
            <div className="flex justify-between text-muted">
              <dt>
                Subtotal · {t.itemCount} producto{t.itemCount === 1 ? '' : 's'}
              </dt>
              <dd className="tabular">{formatMoney(b.subtotal)}</dd>
            </div>
            {b.discountTotal > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Descuento{b.discount?.type === 'PERCENT' ? ` (${b.discount.value}%)` : ''}</dt>
                <dd className="tabular">−{formatMoney(b.discountTotal)}</dd>
              </div>
            ) : null}
            {b.serviceCharge > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Servicio ({b.serviceChargeRate}%)</dt>
                <dd className="tabular">{formatMoney(b.serviceCharge)}</dd>
              </div>
            ) : null}
            {b.paid > 0 && open ? (
              <div className="flex justify-between font-semibold text-primary-ink">
                <dt>Pagado</dt>
                <dd className="tabular">{formatMoney(b.paid)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between">
              <dt className="text-base font-extrabold">{b.paid > 0 && open ? 'Falta' : 'Total'}</dt>
              <dd className="tabular text-2xl font-extrabold">
                {formatMoney(b.paid > 0 && open ? b.remaining : b.total)}
              </dd>
            </div>
          </dl>
          <div className="flex gap-2.5">
            <Link
              to={`/pos/cuentas/${t.id}/orden`}
              aria-disabled={!open}
              className={cn(
                'flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[17px] font-extrabold',
                t.itemCount === 0
                  ? 'bg-primary text-on-primary'
                  : 'bg-secondary-soft text-secondary-ink',
                !open && 'pointer-events-none opacity-50',
              )}
            >
              <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
              Agregar
            </Link>
            {open && hasItems && b.remaining === 0 ? (
              <Button
                size="xl"
                className="flex-[1.4]"
                loading={closeZero.isPending}
                onClick={() =>
                  closeZero.mutate(t.id, {
                    onSuccess: () => toast.success('Cuenta cerrada sin cobro.'),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                Cerrar sin cobro
              </Button>
            ) : open ? (
              <Link
                to={`/pos/cuentas/${t.id}/cobro`}
                aria-disabled={!hasItems}
                className={cn(
                  'tabular flex h-14 flex-[1.4] items-center justify-center rounded-2xl bg-primary text-[17px] font-extrabold text-on-primary',
                  !hasItems && 'pointer-events-none opacity-50',
                )}
              >
                Cobrar {hasItems ? formatMoney(b.remaining) : ''}
              </Link>
            ) : (
              <Button
                size="xl"
                variant="secondary"
                className="flex-[1.4]"
                onClick={() => setTicketOpen(true)}
              >
                Ver comprobante
              </Button>
            )}
          </div>
        </div>
      </div>

      <ItemActionsModal item={selected} onClose={() => setSelected(null)} />
      {open ? <MoveItemsModal tab={t} mode={moveMode} onClose={() => setMoveMode(null)} /> : null}
      {open ? (
        <DiscountModal tab={t} open={discountOpen} onClose={() => setDiscountOpen(false)} />
      ) : null}
      <TicketModal tabId={ticketOpen ? t.id : null} onClose={() => setTicketOpen(false)} />
      {open ? (
        <TabOptionsModal tab={t} open={optionsOpen} onClose={() => setOptionsOpen(false)} />
      ) : null}
    </div>
  );
}
