import type { TabDto } from '@sanfefer/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useSession } from '@/features/auth/api';
import { ApiError, errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useSetCharges } from './api';

const REASONS = [
  'Cliente frecuente',
  'Cortesía de la casa',
  'Promoción',
  'Compensación por demora',
];

export function DiscountModal({
  tab,
  open,
  onClose,
}: {
  tab: TabDto;
  open: boolean;
  onClose: () => void;
}) {
  const { data: user } = useSession();
  const setCharges = useSetCharges();
  const current = tab.billing.discount;
  const [type, setType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const needsPin = user?.role !== 'ADMIN';

  useEffect(() => {
    if (!open) return;
    setType(current?.type ?? 'PERCENT');
    setValue(current ? String(current.value) : '');
    setReason(current?.reason?.replace(/ \(autorizó .*\)$/, '') ?? '');
    setPin('');
    setErrors({});
  }, [open, current]);

  const numeric = Number(value);
  const preview =
    Number.isFinite(numeric) && numeric > 0
      ? type === 'PERCENT'
        ? (tab.billing.subtotal * Math.min(numeric, 100)) / 100
        : Math.min(numeric, tab.billing.subtotal)
      : 0;

  const save = () => {
    const next: Record<string, string> = {};
    if (!(numeric > 0)) next.value = 'Escribe el descuento';
    else if (type === 'PERCENT' && numeric > 100)
      next.value = 'El porcentaje no puede ser mayor que 100';
    if (reason.trim().length < 3) next.reason = 'Indica el motivo';
    if (needsPin && !/^\d{4,6}$/.test(pin)) next.pin = 'Escribe el PIN del administrador';
    setErrors(next);
    if (Object.keys(next).length) return;
    setCharges.mutate(
      {
        tabId: tab.id,
        input: {
          discount: { type, value: numeric, reason: reason.trim() },
          authorizationPin: needsPin ? pin : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Descuento aplicado.');
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.fields?.authorizationPin) setErrors({ pin: e.message });
          else if (e instanceof ApiError && e.fields?.['discount.value'])
            setErrors({ value: e.fields['discount.value'] });
          else toast.error(errorMessage(e));
        },
      },
    );
  };

  const remove = () =>
    setCharges.mutate(
      { tabId: tab.id, input: { discount: null } },
      {
        onSuccess: () => {
          toast.success('Descuento quitado.');
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Descuento"
      description={`Subtotal ${formatMoney(tab.billing.subtotal)}`}
      footer={
        <>
          {current ? (
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-danger-ink"
              onClick={remove}
              disabled={setCharges.isPending}
            >
              Quitar descuento
            </Button>
          ) : (
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={save} loading={setCharges.isPending}>
            Aplicar {preview > 0 ? `−${formatMoney(preview)}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Tipo de descuento"
          value={type}
          onChange={setType}
          options={[
            { value: 'PERCENT', label: 'Porcentaje (%)' },
            { value: 'AMOUNT', label: 'Monto (Q)' },
          ]}
        />
        <Field
          label={type === 'PERCENT' ? 'Porcentaje' : 'Monto en quetzales'}
          error={errors.value}
        >
          {(a) => (
            <Input
              {...a}
              value={value}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              onChange={(e) => setValue(e.target.value)}
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
            {REASONS.map((r) => (
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
        {needsPin ? (
          <Field
            label="PIN del administrador"
            error={errors.pin}
            hint="Los descuentos los autoriza un administrador."
          >
            {(a) => (
              <Input
                {...a}
                value={pin}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
