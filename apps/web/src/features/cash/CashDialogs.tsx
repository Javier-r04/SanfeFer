import { toCents } from '@sanfefer/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import type { CashSessionDto } from '@sanfefer/shared';
import { useCashMovement, useCloseCash } from './api';

export function MovementDialog({
  type,
  onClose,
}: {
  type: 'IN' | 'OUT' | null;
  onClose: () => void;
}) {
  const movement = useCashMovement();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setAmount('');
    setReason('');
    setErrors({});
  }, [type]);

  if (!type) return null;
  const save = () => {
    const next: Record<string, string> = {};
    if (!(Number(amount) > 0)) next.amount = 'Escribe el monto';
    if (reason.trim().length < 3) next.reason = 'Indica el motivo';
    setErrors(next);
    if (Object.keys(next).length) return;
    movement.mutate(
      { type, amount: Number(amount), reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(type === 'IN' ? 'Entrada registrada.' : 'Salida registrada.');
          onClose();
        },
        onError: (e) =>
          e instanceof ApiError && e.fields?.amount
            ? setErrors({ amount: e.message })
            : toast.error(errorMessage(e)),
      },
    );
  };
  const suggestions =
    type === 'IN'
      ? ['Cambio adicional', 'Reposición de fondo']
      : ['Pago a proveedor', 'Compra de hielo', 'Retiro del dueño'];
  return (
    <Modal
      open
      onClose={onClose}
      title={type === 'IN' ? 'Entrada de efectivo' : 'Salida de efectivo'}
      description="Movimientos de dinero que no son ventas."
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={save} loading={movement.isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Monto (Q)" error={errors.amount}>
          {(a) => (
            <Input
              {...a}
              value={amount}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <Field label="Motivo" error={errors.reason}>
            {(a) => (
              <Input
                {...a}
                value={reason}
                maxLength={120}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="min-h-9 rounded-full border border-border px-3 text-[13px] font-semibold text-muted"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function CloseCashDialog({
  session,
  openTabs,
  open,
  onClose,
  onClosed,
}: {
  session: CashSessionDto;
  openTabs: number;
  open: boolean;
  onClose: () => void;
  onClosed: (s: CashSessionDto) => void;
}) {
  const close = useCloseCash();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCounted('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  const countedNum = Number(counted);
  const diff = counted === '' ? null : (toCents(countedNum) - toCents(session.expectedCash)) / 100;

  const save = () => {
    if (counted === '' || !(countedNum >= 0)) return setError('Escribe el efectivo que contaste');
    close.mutate(
      { countedCash: countedNum, notes },
      {
        onSuccess: ({ session: closed }) => {
          toast.success('Caja cerrada.');
          onClosed(closed);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cerrar caja"
      description={`Debe haber ${formatMoney(session.expectedCash)} en efectivo.`}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={save} loading={close.isPending}>
            Cerrar caja
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {openTabs > 0 ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning-ink">
            Hay {openTabs} cuenta{openTabs === 1 ? '' : 's'} sin cobrar. Puedes cerrar igual; se
            cobrarán en la próxima caja.
          </p>
        ) : null}
        <Field
          label="Efectivo contado (Q)"
          error={error ?? undefined}
          hint="Cuenta billetes y monedas, incluido el fondo inicial."
        >
          {(a) => (
            <Input
              {...a}
              value={counted}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              autoFocus
              onChange={(e) => {
                setCounted(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        {diff !== null && Number.isFinite(diff) ? (
          <p
            role="status"
            className={cn(
              'rounded-xl px-3 py-2.5 text-sm font-bold',
              diff === 0
                ? 'bg-primary-soft text-primary-ink'
                : diff > 0
                  ? 'bg-secondary-soft text-secondary-ink'
                  : 'bg-danger-soft text-danger-ink',
            )}
          >
            {diff === 0
              ? 'La caja cuadra.'
              : diff > 0
                ? `Sobran ${formatMoney(diff)}.`
                : `Faltan ${formatMoney(-diff)}.`}
          </p>
        ) : null}
        <Field label="Notas (opcional)">
          {(a) => (
            <Input
              {...a}
              value={notes}
              maxLength={200}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
