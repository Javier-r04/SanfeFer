import { zodResolver } from '@hookform/resolvers/zod';
import {
  KIND_LABELS,
  purchaseInputSchema,
  UNIT_LABELS,
  unitCostFromLine,
  type InventoryItemDto,
  type PurchaseInput,
} from '@sanfefer/shared';
import { ArrowLeft, Package, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type FieldErrors,
} from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Textarea } from '@/components/ui/Textarea';
import { useInventoryItems } from '@/features/inventory/api';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent, formatQty, formatUnitCost } from '@/lib/format';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useCreatePurchase, useSuppliers } from './api';
import { today } from './dates';
import { SupplierFormModal } from './SupplierFormModal';

const newLine = () => ({
  inventoryItemId: Number.NaN,
  quantity: Number.NaN,
  lineTotal: Number.NaN,
});

/** Compara el costo de esta compra con el promedio actual del artículo. */
function CostHint({
  item,
  quantity,
  lineTotal,
}: {
  item?: InventoryItemDto;
  quantity: number;
  lineTotal: number;
}) {
  if (!item || !(quantity > 0) || !Number.isFinite(lineTotal)) return null;
  const unitCost = unitCostFromLine(lineTotal, quantity);
  const unit = UNIT_LABELS[item.unit];
  let comparison = '';
  let tone = 'text-muted';
  if (item.averageCost > 0) {
    const diff = (unitCost - item.averageCost) / item.averageCost;
    if (Math.abs(diff) < 0.005) comparison = ' · igual al promedio';
    else {
      comparison = ` · ${diff > 0 ? '↑' : '↓'} ${formatPercent(Math.abs(diff))} ${diff > 0 ? 'más caro' : 'más barato'} que el promedio (${formatUnitCost(item.averageCost)})`;
      if (diff > 0.1) tone = 'text-warning-ink font-bold';
    }
  }
  return (
    <p className={cn('text-sm', tone)}>
      {formatUnitCost(unitCost)} por {unit}
      {comparison}. Quedarán {formatQty(item.stock + quantity, item.unit)}.
    </p>
  );
}

function LineRow({
  index,
  control,
  register,
  setValue,
  errors,
  items,
  onRemove,
  canRemove,
}: {
  index: number;
  control: Control<PurchaseInput>;
  register: UseFormRegister<PurchaseInput>;
  setValue: UseFormSetValue<PurchaseInput>;
  errors: FieldErrors<PurchaseInput>;
  items: InventoryItemDto[];
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [packMode, setPackMode] = useState(false);
  const [packs, setPacks] = useState('');
  const [perPack, setPerPack] = useState('');
  const line = useWatch({ control, name: `items.${index}` });
  const item = items.find((i) => i.id === line?.inventoryItemId);
  const unit = item ? UNIT_LABELS[item.unit] : '';
  const lineErrors = errors.items?.[index];

  const updatePacks = (p: string, per: string) => {
    setPacks(p);
    setPerPack(per);
    const qty = Number(p) * Number(per);
    if (p && per && Number.isFinite(qty))
      setValue(`items.${index}.quantity`, Math.round(qty * 1000) / 1000, { shouldValidate: true });
  };

  const supplies = items.filter((i) => i.kind === 'SUPPLY');
  const resale = items.filter((i) => i.kind === 'RESALE');

  return (
    <li className="flex flex-col gap-2 border-t border-surface-2 py-4 first:border-t-0 first:pt-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] sm:items-start">
        <Field label={`Artículo ${index + 1}`} error={lineErrors?.inventoryItemId?.message}>
          {(a) => (
            <Select {...a} {...register(`items.${index}.inventoryItemId`, { valueAsNumber: true })}>
              <option value="">Elige un artículo…</option>
              <optgroup label={KIND_LABELS.RESALE}>
                {resale.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={KIND_LABELS.SUPPLY}>
                {supplies.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label={`Cantidad${unit ? ` (${unit})` : ''}`} error={lineErrors?.quantity?.message}>
          {(a) => (
            <Input
              {...a}
              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              readOnly={packMode}
              className="text-right"
            />
          )}
        </Field>
        <Field label="Total de la línea (Q)" error={lineErrors?.lineTotal?.message}>
          {(a) => (
            <Input
              {...a}
              {...register(`items.${index}.lineTotal`, { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              className="text-right"
            />
          )}
        </Field>
        <div className="flex sm:pt-7">
          <Button
            variant={packMode ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setPackMode((m) => !m)}
            aria-pressed={packMode}
            aria-label={`Calcular la cantidad del artículo ${index + 1} por paquetes`}
            title="Por paquetes (cajas, galones…)"
          >
            <Package aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Quitar artículo ${index + 1}`}
            title="Quitar"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>
      {packMode ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3">
          <Field label="Paquetes" className="w-28">
            {(a) => (
              <Input
                {...a}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={packs}
                onChange={(e) => updatePacks(e.target.value, perPack)}
              />
            )}
          </Field>
          <span className="pb-3 font-bold">×</span>
          <Field label={`Contenido por paquete${unit ? ` (${unit})` : ''}`} className="w-48">
            {(a) => (
              <Input
                {...a}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={perPack}
                onChange={(e) => updatePacks(packs, e.target.value)}
              />
            )}
          </Field>
          <p className="pb-3 text-sm text-muted">Ej. 2 cajas × 24 u, o 3 galones × 3785 ml</p>
        </div>
      ) : null}
      <CostHint item={item} quantity={Number(line?.quantity)} lineTotal={Number(line?.lineTotal)} />
    </li>
  );
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const items = useInventoryItems();
  const create = useCreatePurchase();
  const [supplierModal, setSupplierModal] = useState(false);
  // Un proveedor recién creado se selecciona cuando ya aparece en la lista (si no, el <select> lo ignora).
  const [pendingSupplier, setPendingSupplier] = useState<number | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseInputSchema),
    defaultValues: {
      supplierId: Number.NaN,
      purchasedAt: today(),
      invoiceNumber: '',
      notes: '',
      items: [newLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const lines = useWatch({ control, name: 'items' });

  useEffect(() => {
    if (pendingSupplier !== null && suppliers.data?.some((s) => s.id === pendingSupplier)) {
      setValue('supplierId', pendingSupplier, { shouldValidate: true });
      setPendingSupplier(null);
    }
  }, [pendingSupplier, suppliers.data, setValue]);
  const total = (lines ?? []).reduce(
    (sum, l) => sum + (Number.isFinite(l.lineTotal) ? Number(l.lineTotal) : 0),
    0,
  );

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: ({ purchase }) => {
        toast.success(
          `Compra #${purchase.id} registrada: ${purchase.itemCount} artículo${purchase.itemCount === 1 ? '' : 's'} sumados al inventario.`,
        );
        // Sin esto, la lista mostraría un instante los datos anteriores (sin la compra nueva).
        queryClient.removeQueries({ queryKey: ['purchases', 'list'] });
        navigate('/admin/compras');
      },
      onError: (err) => handleFormError(err, setError),
    }),
  );

  if (suppliers.isPending || items.isPending) return <LoadingState />;
  if (suppliers.error || items.error) return <ErrorState error={suppliers.error ?? items.error} />;

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pb-28">
        <div>
          <Link
            to="/admin/compras"
            className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-secondary-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver a compras
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Nueva compra</h1>
          <p className="mt-1 text-sm text-muted">
            Copia las líneas de la factura: cantidad en la unidad del artículo y el total que cobró
            el proveedor.
          </p>
        </div>

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Proveedor" error={errors.supplierId?.message} className="sm:col-span-2">
            {(a) => (
              <div className="flex gap-2">
                <Select
                  {...a}
                  {...register('supplierId', { valueAsNumber: true })}
                  className="flex-1"
                >
                  <option value="">Elige un proveedor…</option>
                  {suppliers.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setSupplierModal(true)}
                  aria-label="Nuevo proveedor"
                  title="Nuevo proveedor"
                >
                  <Plus aria-hidden="true" className="size-5" />
                </Button>
              </div>
            )}
          </Field>
          <Field label="Fecha de la compra" error={errors.purchasedAt?.message}>
            {(a) => <Input {...a} {...register('purchasedAt')} type="date" max={today()} />}
          </Field>
          <Field label="N.º de factura (opcional)" error={errors.invoiceNumber?.message}>
            {(a) => <Input {...a} {...register('invoiceNumber')} autoComplete="off" />}
          </Field>
          <Field
            label="Notas (opcional)"
            error={errors.notes?.message}
            className="sm:col-span-2 lg:col-span-4"
          >
            {(a) => <Textarea {...a} {...register('notes')} rows={2} />}
          </Field>
        </section>

        <section className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-extrabold">Artículos</h2>
          {errors.items?.message || errors.items?.root?.message ? (
            <p className="mb-2 text-sm font-semibold text-danger-ink">
              {errors.items.message ?? errors.items.root?.message}
            </p>
          ) : null}
          <ul>
            {fields.map((field, index) => (
              <LineRow
                key={field.id}
                index={index}
                control={control}
                register={register}
                setValue={setValue}
                errors={errors}
                items={items.data}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </ul>
          <Button variant="secondary" className="mt-2 self-start" onClick={() => append(newLine())}>
            <Plus aria-hidden="true" className="size-4" />
            Agregar artículo
          </Button>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Total de la compra</p>
              <p className="tabular text-2xl font-extrabold">{formatMoney(total)}</p>
            </div>
            <Button type="submit" size="xl" loading={create.isPending}>
              Registrar compra
            </Button>
          </div>
        </div>
      </form>
      {/* Fuera del <form> de la compra: un formulario no puede ir dentro de otro. */}
      <SupplierFormModal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        onCreated={(s) => setPendingSupplier(s.id)}
      />
    </>
  );
}
