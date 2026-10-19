import { splitEvenly, suggestedBills, toCents } from '@sanfefer/shared';
import { CircleCheck, Delete, ReceiptText, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useCurrentCash } from '@/features/cash/api';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney, formatTime } from '@/lib/format';
import { TicketModal } from '@/printing/TicketModal';
import { toast } from '@/stores/toast';
import { useAddPayment, useDeletePayment, useTab } from './api';
import { PosHeader } from './components';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/** Teclado para el efectivo recibido (máximo 2 decimales). */
function pressKey(value: string, key: string) {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.' && value.includes('.')) return value;
  if (/\.\d{2}$/.test(value)) return value;
  const next = value === '0' && key !== '.' ? key : value + key;
  return next.length > 9 ? value : next;
}

export function PaymentPage() {
  const tabId = Number(useParams().tabId);
  const tab = useTab(tabId);
  const cash = useCurrentCash();
  const pay = useAddPayment();
  const removePayment = useDeletePayment();
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [parts, setParts] = useState(1);
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');
  const [done, setDone] = useState<{ change: number } | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  const b = tab.data?.billing;
  // Monto sugerido: la parte que toca (dividiendo el total en partes iguales), sin pasarse de lo que falta.
  const suggested = useMemo(() => {
    if (!b) return 0;
    const split = splitEvenly(b.total, parts);
    const part = split[Math.min(b.payments.length, parts - 1)] ?? b.remaining;
    return Math.min(part, b.remaining);
  }, [b, parts]);

  // Solo se reinicia al cambiar la parte sugerida o al registrar un pago, no en cada refresco automático.
  const paymentsCount = b?.payments.length ?? 0;
  useEffect(() => {
    setAmount(suggested ? suggested.toFixed(2) : '');
    setReceived('');
  }, [suggested, paymentsCount]);

  if (tab.isPending || cash.isPending) return <LoadingState label="Cargando cuenta…" />;
  if (tab.error) return <ErrorState error={tab.error} onRetry={() => void tab.refetch()} />;
  const t = tab.data;
  const billing = t.billing;
  const where = t.table ? `${t.table.name} · ${t.customerName}` : t.customerName;

  const amountNum = Number(amount);
  const amountValid = amountNum > 0 && toCents(amountNum) <= toCents(billing.remaining);
  const receivedNum = received === '' ? amountNum : Number(received);
  const change = Math.max(0, (toCents(receivedNum) - toCents(amountNum)) / 100);
  const short = method === 'CASH' && toCents(receivedNum) < toCents(amountNum);

  if (done || t.status === 'PAID') {
    return (
      <div className="flex min-h-dvh flex-col">
        <PosHeader
          title="Cuenta cobrada"
          subtitle={where}
          backTo="/pos"
          backLabel="Volver a mesas"
        />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
          <CircleCheck aria-hidden="true" className="size-16 text-primary" strokeWidth={1.8} />
          <div>
            <p className="text-lg font-bold">Total cobrado</p>
            <p className="tabular text-4xl font-extrabold">{formatMoney(billing.total)}</p>
          </div>
          {done && done.change > 0 ? (
            <div
              role="status"
              className="w-full rounded-3xl bg-primary-soft px-6 py-5 text-primary-ink"
            >
              <p className="text-base font-bold">Vuelto</p>
              <p className="tabular text-5xl font-extrabold">{formatMoney(done.change)}</p>
            </div>
          ) : null}
          <div className="flex w-full flex-col gap-2.5">
            <Button size="xl" variant="secondary" onClick={() => setTicketOpen(true)}>
              <ReceiptText aria-hidden="true" className="size-5" />
              Imprimir comprobante
            </Button>
            <Link
              to="/pos"
              className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-extrabold text-on-primary"
            >
              Volver a mesas
            </Link>
          </div>
        </div>
        <TicketModal tabId={ticketOpen ? t.id : null} onClose={() => setTicketOpen(false)} />
      </div>
    );
  }

  const confirm = () => {
    if (!amountValid)
      return toast.error(
        `El monto debe ser mayor que 0 y como máximo ${formatMoney(billing.remaining)}.`,
      );
    if (short) return toast.error('El efectivo recibido no alcanza.');
    pay.mutate(
      {
        tabId,
        input: {
          method,
          amount: amountNum,
          tendered: method === 'CASH' ? receivedNum : undefined,
          reference: method === 'CARD' ? reference : null,
        },
      },
      {
        onSuccess: (r) => {
          if (r.closed) {
            setDone({ change: r.change });
          } else {
            toast.success(
              `Pago registrado${r.change ? ` · vuelto ${formatMoney(r.change)}` : ''}. Falta ${formatMoney(r.tab.billing.remaining)}.`,
            );
            setReference('');
          }
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <PosHeader
        title="Cobrar"
        subtitle={where}
        backTo={`/pos/cuentas/${tabId}`}
        backLabel="Volver a la cuenta"
      />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-3 pb-36">
        {!cash.data ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-warning bg-warning-soft p-4 text-warning-ink"
          >
            <p className="flex items-center gap-2 font-bold">
              <Wallet aria-hidden="true" className="size-5" /> La caja está cerrada
            </p>
            <p className="text-sm">Para cobrar, primero abre la caja con el fondo inicial.</p>
            <Link
              to="/pos/caja"
              className="self-start rounded-xl bg-warning px-4 py-2.5 text-sm font-extrabold text-on-warning"
            >
              Abrir caja
            </Link>
          </div>
        ) : null}

        <div className="text-center">
          <p className="text-sm font-semibold text-muted">
            {billing.paid > 0 ? 'Falta por cobrar' : 'Total a cobrar'}
          </p>
          <p className="tabular text-5xl font-extrabold tracking-tight">
            {formatMoney(billing.remaining)}
          </p>
          {billing.paid > 0 ? (
            <p className="text-sm text-muted">
              Total {formatMoney(billing.total)} · pagado {formatMoney(billing.paid)}
            </p>
          ) : null}
        </div>

        {billing.payments.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="Pagos registrados">
            {billing.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="flex-1 font-semibold">
                  {p.method === 'CASH' ? 'Efectivo' : 'Tarjeta'} · {formatTime(p.createdAt)}
                  {p.reference ? ` · ${p.reference}` : ''}
                </span>
                <span className="tabular font-bold">{formatMoney(p.amount)}</span>
                <button
                  type="button"
                  aria-label={`Quitar pago de ${formatMoney(p.amount)}`}
                  className="grid size-9 place-items-center rounded-full hover:bg-surface"
                  onClick={() =>
                    removePayment.mutate(p.id, { onError: (e) => toast.error(errorMessage(e)) })
                  }
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Dividir en partes iguales</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Partes">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={parts === n}
                onClick={() => setParts(n)}
                className={cn(
                  'h-11 flex-1 rounded-xl text-sm font-extrabold',
                  parts === n ? 'bg-text text-bg' : 'border-[1.5px] border-border bg-surface',
                )}
              >
                {n === 1 ? 'Todo' : `÷${n}`}
              </button>
            ))}
          </div>
          {parts > 1 ? (
            <p className="text-sm text-muted">
              Parte {Math.min(billing.payments.length + 1, parts)} de {parts}:{' '}
              {formatMoney(splitEvenly(billing.total, parts)[0]!)} c/u
            </p>
          ) : null}
        </div>

        <Segmented
          label="Método de pago"
          value={method}
          onChange={setMethod}
          options={[
            { value: 'CASH', label: 'Efectivo' },
            { value: 'CARD', label: 'Tarjeta' },
          ]}
        />
        <p className="-mt-2 text-xs text-muted">Pago mixto: cobra una parte con cada método.</p>

        <Field
          label="Monto de este pago (Q)"
          error={amount && !amountValid ? `Máximo ${formatMoney(billing.remaining)}` : undefined}
        >
          {(a) => (
            <Input
              {...a}
              value={amount}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>

        {method === 'CASH' ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className={cn(
                  'rounded-2xl border-[1.5px] bg-surface p-3',
                  short ? 'border-danger' : 'border-primary',
                )}
              >
                <p className="text-sm font-semibold text-muted">Recibido</p>
                <p className="tabular text-2xl font-extrabold" aria-live="polite">
                  {formatMoney(receivedNum || 0)}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-2xl p-3',
                  short ? 'bg-danger-soft text-danger-ink' : 'bg-primary-soft text-primary-ink',
                )}
              >
                <p className="text-sm font-semibold">{short ? 'Falta' : 'Vuelto'}</p>
                <p className="tabular text-2xl font-extrabold" aria-live="polite">
                  {formatMoney(short ? amountNum - receivedNum : change)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Billetes sugeridos">
              {amountValid
                ? suggestedBills(amountNum).map((bill, i) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setReceived(bill.toFixed(2))}
                      className={cn(
                        'h-11 flex-1 rounded-xl border-[1.5px] px-2 text-sm font-bold',
                        toCents(receivedNum) === toCents(bill)
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-surface',
                      )}
                    >
                      {i === 0 ? 'Exacto' : formatMoney(bill)}
                    </button>
                  ))
                : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={k === 'del' ? 'Borrar' : k === '.' ? 'Punto decimal' : k}
                  onClick={() => setReceived((v) => pressKey(v, k))}
                  className={cn(
                    'grid h-14 place-items-center rounded-2xl text-2xl font-bold active:scale-[0.97]',
                    k === 'del' || k === '.' ? 'bg-surface-2' : 'border border-border bg-surface',
                  )}
                >
                  {k === 'del' ? <Delete aria-hidden="true" className="size-6" /> : k}
                </button>
              ))}
            </div>
          </>
        ) : (
          <Field label="N.º de voucher o autorización (opcional)">
            {(a) => (
              <Input
                {...a}
                value={reference}
                maxLength={40}
                inputMode="numeric"
                onChange={(e) => setReference(e.target.value)}
              />
            )}
          </Field>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">
          <Button
            size="xl"
            className="w-full"
            onClick={confirm}
            loading={pay.isPending}
            disabled={!cash.data || !amountValid || short}
          >
            <CircleCheck aria-hidden="true" className="size-5" />
            Confirmar pago {amountValid ? formatMoney(amountNum) : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
