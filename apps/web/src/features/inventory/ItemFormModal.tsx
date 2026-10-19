import { zodResolver } from '@hookform/resolvers/zod';
import {
  INVENTORY_KINDS,
  inventoryItemCreateSchema,
  KIND_LABELS,
  UNIT_LABELS,
  UNIT_NAMES,
  UNITS,
  type InventoryItemDto,
} from '@sanfefer/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useCreateItem, useUpdateItem } from './api';

export function ItemFormModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item?: InventoryItemDto;
  onClose: () => void;
}) {
  const editing = !!item;
  const create = useCreateItem();
  const update = useUpdateItem();
  const form = useForm({
    // Al editar, stock y costo iniciales no se muestran ni se envían (quedan en 0).
    resolver: zodResolver(inventoryItemCreateSchema),
    defaultValues: {
      name: '',
      kind: 'SUPPLY' as const,
      unit: 'UNIT' as const,
      minStock: 0,
      initialStock: 0,
      initialCost: 0,
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            name: item.name,
            kind: item.kind,
            unit: item.unit,
            minStock: item.minStock,
            initialStock: 0,
            initialCost: 0,
          }
        : { name: '', kind: 'SUPPLY', unit: 'UNIT', minStock: 0, initialStock: 0, initialCost: 0 },
    );
  }, [open, item, reset]);

  const unit = UNIT_LABELS[watch('unit')];
  const lockedUnit = editing && item.usedIn > 0;

  const onSubmit = handleSubmit((values) => {
    const done = (message: string) => () => {
      toast.success(message);
      onClose();
    };
    const onError = (err: unknown) => handleFormError(err, setError);
    if (item) {
      update.mutate(
        {
          id: item.id,
          input: {
            name: values.name,
            kind: values.kind,
            unit: values.unit,
            minStock: values.minStock,
          },
        },
        { onSuccess: done('Artículo actualizado.'), onError },
      );
    } else {
      create.mutate(values, { onSuccess: done(`${values.name} agregado al inventario.`), onError });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar artículo' : 'Nuevo artículo'}
      description="Insumos (clamato, limón…) o productos de reventa (cervezas, aguas…)."
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="item-form"
            size="lg"
            className="flex-1"
            loading={create.isPending || update.isPending}
          >
            {editing ? 'Guardar' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="Nombre"
          error={errors.name?.message}
          hint="Incluye la presentación. Ej. Corona 355 ml"
        >
          {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" error={errors.kind?.message}>
            {(a) => (
              <Select {...a} {...register('kind')}>
                {INVENTORY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Unidad"
            error={errors.unit?.message}
            hint={lockedUnit ? 'No se puede cambiar: se usa en recetas.' : undefined}
          >
            {(a) => (
              <Select {...a} {...register('unit')} disabled={lockedUnit}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_NAMES[u]} ({UNIT_LABELS[u]})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          label={`Stock mínimo (${unit})`}
          error={errors.minStock?.message}
          hint="Debajo de este número aparece la alerta."
        >
          {(a) => (
            <Input
              {...a}
              {...register('minStock', { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
            />
          )}
        </Field>
        {!editing ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Stock inicial (${unit})`} error={errors.initialStock?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...register('initialStock', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                />
              )}
            </Field>
            <Field label={`Costo por ${unit} (Q)`} error={errors.initialCost?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...register('initialCost', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                />
              )}
            </Field>
          </div>
        ) : null}
        {!editing ? (
          <p className="text-sm text-muted">
            El costo es por unidad base: si un galón de clamato (3,785 ml) cuesta Q 90, el costo por
            ml es 90 ÷ 3785 ≈ Q 0.0238.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
