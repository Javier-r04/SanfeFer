import { zodResolver } from '@hookform/resolvers/zod';
import {
  movementInputSchema,
  UNIT_LABELS,
  type InventoryItemDto,
  type ManualMovementType,
} from '@sanfefer/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { formatQty, formatUnitCost } from '@/lib/format';
import { handleFormError, optionalNumber } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useCreateMovement } from './api';

interface Values {
  type: ManualMovementType;
  quantity?: number;
  unitCost?: number;
  countedStock?: number;
  reason?: string;
}

const typeOptions: { value: ManualMovementType; label: string }[] = [
  { value: 'MANUAL_IN', label: 'Entrada' },
  { value: 'WASTE', label: 'Salida / merma' },
  { value: 'ADJUSTMENT', label: 'Conteo' },
];

export function MovementModal({
  item,
  initialType = 'MANUAL_IN',
  onClose,
}: {
  item: InventoryItemDto | null;
  initialType?: ManualMovementType;
  onClose: () => void;
}) {
  const create = useCreateMovement();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({
    // El esquema es una unión por tipo; el formulario comparte campos entre los tres.
    resolver: zodResolver(movementInputSchema) as never,
    defaultValues: { type: initialType },
  });

  useEffect(() => {
    if (item) reset({ type: initialType, reason: '' });
  }, [item, initialType, reset]);

  if (!item) return null;

  const type = watch('type');
  const unit = UNIT_LABELS[item.unit];
  const quantity = watch('quantity');
  const counted = watch('countedStock');
  const preview =
    type === 'ADJUSTMENT'
      ? Number.isFinite(counted) && counted !== undefined
        ? counted
        : null
      : Number.isFinite(quantity) && quantity !== undefined
        ? item.stock + (type === 'WASTE' ? -quantity : quantity)
        : null;

  const onSubmit = handleSubmit((values) => {
    const input =
      values.type === 'MANUAL_IN'
        ? {
            type: values.type,
            quantity: values.quantity!,
            unitCost: values.unitCost,
            reason: values.reason,
          }
        : values.type === 'WASTE'
          ? { type: values.type, quantity: values.quantity!, reason: values.reason ?? '' }
          : { type: values.type, countedStock: values.countedStock!, reason: values.reason };
    create.mutate(
      { itemId: item.id, input },
      {
        onSuccess: ({ item: updated }) => {
          toast.success(`${updated.name}: ahora hay ${formatQty(updated.stock, updated.unit)}.`);
          onClose();
        },
        onError: (err) => handleFormError(err, setError),
      },
    );
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar movimiento"
      description={`${item.name} · stock actual ${formatQty(item.stock, item.unit)}`}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="movement-form"
            size="lg"
            className="flex-1"
            loading={create.isPending}
          >
            Registrar
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Segmented
          label="Tipo de movimiento"
          value={type}
          onChange={(t) => setValue('type', t)}
          options={typeOptions}
        />
        <p className="-mt-2 text-sm text-muted">
          {type === 'MANUAL_IN'
            ? 'Mercadería que entra sin compra registrada (préstamo, regalo, corrección). Las compras a proveedores se registran en Compras.'
            : type === 'WASTE'
              ? 'Producto que sale sin venderse: se quebró, se venció, consumo interno…'
              : 'Escribe lo que contaste físicamente; el sistema registra la diferencia.'}
        </p>

        {type === 'ADJUSTMENT' ? (
          <Field label={`Cantidad contada (${unit})`} error={errors.countedStock?.message}>
            {(a) => (
              <Input
                {...a}
                {...register('countedStock', { valueAsNumber: true })}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                autoFocus
              />
            )}
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Cantidad (${unit})`}
              error={errors.quantity?.message}
              className={type === 'WASTE' ? 'col-span-2' : ''}
            >
              {(a) => (
                <Input
                  {...a}
                  {...register('quantity', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  autoFocus
                />
              )}
            </Field>
            {type === 'MANUAL_IN' ? (
              <Field
                label={`Costo por ${unit} (opcional)`}
                error={errors.unitCost?.message}
                hint={`Promedio actual ${formatUnitCost(item.averageCost)}`}
              >
                {(a) => (
                  <Input
                    {...a}
                    {...register('unitCost', { setValueAs: optionalNumber })}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                  />
                )}
              </Field>
            ) : null}
          </div>
        )}

        <Field
          label={type === 'WASTE' ? 'Motivo' : 'Motivo (opcional)'}
          error={errors.reason?.message}
        >
          {(a) => (
            <Input
              {...a}
              {...register('reason')}
              autoComplete="off"
              placeholder={type === 'WASTE' ? 'Ej. se quebraron 2 botellas' : ''}
            />
          )}
        </Field>

        {preview !== null ? (
          <p
            className={
              preview < 0
                ? 'rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-bold text-danger-ink'
                : 'rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-bold'
            }
          >
            Quedarán {formatQty(preview, item.unit)}
            {type === 'ADJUSTMENT' && Number.isFinite(preview)
              ? ` (diferencia ${preview - item.stock >= 0 ? '+' : '−'}${formatQty(Math.abs(preview - item.stock), item.unit)})`
              : ''}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
