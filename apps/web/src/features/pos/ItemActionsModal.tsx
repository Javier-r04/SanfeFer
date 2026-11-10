import type { OrderItemDto } from '@sanfefer/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useSession } from '@/features/auth/api';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useCancelItem } from './api';
import { Stepper } from './components';

const REASONS = [
  'El cliente cambió de opinión',
  'Se tomó por error',
  'Se derramó',
  'Tardó demasiado',
];

/** Cancelar un producto ya confirmado (total o parcial). Solo un administrador puede hacerlo. */
export function ItemActionsModal({
  item,
  onClose,
}: {
  item: OrderItemDto | null;
  onClose: () => void;
}) {
  const { data: user } = useSession();
  const cancel = useCancelItem();
  const [mode, setMode] = useState<'menu' | 'cancel'>('menu');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [wasted, setWasted] = useState(false);
  const [errors, setErrors] = useState<{ reason?: string; pin?: string }>({});

  useEffect(() => {
    if (!item) return;
    setMode('menu');
    setQuantity(item.quantity);
    setReason('');
    setPin('');
    setWasted(false);
    setErrors({});
  }, [item]);

  if (!item) return null;
  // Un vendedor puede pedir la cancelación, pero la autoriza un administrador con su PIN.
  const needsPin = user?.role !== 'ADMIN';

  const confirmCancel = () => {
    const next: typeof errors = {};
    if (reason.trim().length < 3) next.reason = 'Indica el motivo';
    if (needsPin && !/^\d{4,6}$/.test(pin)) next.pin = 'Escribe el PIN del administrador';
    setErrors(next);
    if (Object.keys(next).length) return;
    cancel.mutate(
      {
        id: item.id,
        input: {
          reason: reason.trim(),
          quantity,
          wasted,
          authorizationPin: needsPin ? pin : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            wasted ? 'Cancelado. Se registró como merma.' : 'Cancelado. El inventario se devolvió.',
          );
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.fields?.authorizationPin) setErrors({ pin: e.message });
          else toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.quantity}× ${item.productName}`}
      description={[
        item.modifiers.map((m) => m.optionName).join(' · '),
        item.note ? `Nota: ${item.note}` : null,
      ]
        .filter(Boolean)
        .join(' — ')}
      footer={
        mode === 'cancel' ? (
          <>
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setMode('menu')}>
              Volver
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={cancel.isPending}
              onClick={confirmCancel}
            >
              Cancelar {quantity === item.quantity ? 'producto' : `${quantity}`}
            </Button>
          </>
        ) : undefined
      }
    >
      {mode === 'menu' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted">Total de la línea</span>
            <span className="tabular text-lg font-extrabold">{formatMoney(item.lineTotal)}</span>
          </div>
          {needsPin ? (
            <p className="text-sm text-muted">
              Solo un administrador puede cancelar: te pedirá su PIN.
            </p>
          ) : null}
          <Button
            variant="outline"
            size="xl"
            className="text-danger-ink"
            onClick={() => setMode('cancel')}
          >
            Cancelar producto
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-bold">¿Ya se preparó?</legend>
            {[
              {
                value: false,
                label: 'No, vuelve al inventario',
                hint: 'Se tomó por error o no se hizo.',
              },
              { value: true, label: 'Sí, se desperdició', hint: 'Se registra como merma.' },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] px-3.5 py-3',
                  wasted === o.value ? 'border-text bg-surface-2' : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name="wasted"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={wasted === o.value}
                  onChange={() => setWasted(o.value)}
                />
                <span>
                  <span className="block font-bold">{o.label}</span>
                  <span className="block text-sm text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {item.quantity > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">¿Cuántos cancelar?</span>
              <Stepper
                value={quantity}
                onChange={setQuantity}
                max={item.quantity}
                label="Cantidad a cancelar"
                size="md"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Field label="Motivo" error={errors.reason}>
              {(a) => (
                <Input
                  {...a}
                  value={reason}
                  maxLength={120}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setErrors((x) => ({ ...x, reason: undefined }));
                  }}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-[13px] font-semibold',
                    reason === r ? 'border-text bg-surface-2' : 'border-border text-muted',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {needsPin ? (
            <Field label="PIN del administrador" error={errors.pin}>
              {(a) => (
                <Input
                  {...a}
                  value={pin}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setErrors((x) => ({ ...x, pin: undefined }));
                  }}
                />
              )}
            </Field>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
