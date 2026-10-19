import { zodResolver } from '@hookform/resolvers/zod';
import {
  modifierGroupInputSchema,
  type ModifierGroupDto,
  type ModifierGroupInput,
} from '@sanfefer/shared';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useInventoryItems } from '@/features/inventory/api';
import { cn } from '@/lib/cn';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useSaveModifierGroup } from './api';
import { selectionRule } from './catalog-utils';
import { RecipeEditor } from './RecipeEditor';

const newOption = () => ({
  name: '',
  priceDelta: 0,
  active: true,
  components: [] as { inventoryItemId: number; quantity: number }[],
});

const fromGroup = (g?: ModifierGroupDto): ModifierGroupInput =>
  g
    ? {
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        active: g.active,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: o.priceDelta,
          active: o.active,
          components: o.components.map((c) => ({
            inventoryItemId: c.inventoryItemId,
            quantity: c.quantity,
          })),
        })),
      }
    : { name: '', minSelect: 0, maxSelect: 1, active: true, options: [newOption()] };

export function ModifierGroupFormModal({
  open,
  group,
  onClose,
}: {
  open: boolean;
  group?: ModifierGroupDto;
  onClose: () => void;
}) {
  const items = useInventoryItems({ includeInactive: true });
  const save = useSaveModifierGroup();
  const form = useForm({
    resolver: zodResolver(modifierGroupInputSchema),
    defaultValues: fromGroup(),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;
  // keyName distinto de "id": las opciones existentes ya traen su propio id.
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'options',
    keyName: 'fieldKey',
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [min, max, options] = useWatch({ control, name: ['minSelect', 'maxSelect', 'options'] });

  useEffect(() => {
    if (open) {
      reset(fromGroup(group));
      setExpanded(new Set());
    }
  }, [open, group, reset]);

  const toggleExpanded = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { id: group?.id, input: values },
      {
        onSuccess: () => {
          toast.success(group ? 'Grupo de extras actualizado.' : `Grupo ${values.name} creado.`);
          onClose();
        },
        onError: (err) => handleFormError(err, setError),
      },
    ),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={group ? 'Editar grupo de extras' : 'Nuevo grupo de extras'}
      description="Ej. Tipo de cerveza (obligatorio, elige 1), Escarchado (opcional), Extras (varios)."
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="modifier-form"
            size="lg"
            className="flex-1"
            loading={save.isPending}
          >
            {group ? 'Guardar' : 'Crear grupo'}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form id="modifier-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Nombre del grupo" error={errors.name?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...register('name')}
                  autoComplete="off"
                  placeholder="Ej. Escarchado"
                />
              )}
            </Field>
            <Field label="Mínimo" error={errors.minSelect?.message} className="sm:w-28">
              {(a) => (
                <Input
                  {...a}
                  {...register('minSelect', { valueAsNumber: true })}
                  type="number"
                  inputMode="numeric"
                  min={0}
                />
              )}
            </Field>
            <Field label="Máximo" error={errors.maxSelect?.message} className="sm:w-28">
              {(a) => (
                <Input
                  {...a}
                  {...register('maxSelect', { valueAsNumber: true })}
                  type="number"
                  inputMode="numeric"
                  min={1}
                />
              )}
            </Field>
          </div>
          <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-secondary-ink">
              {Number.isInteger(min) && Number.isInteger(max) ? selectionRule(min, max) : ' '}
            </p>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  label="Grupo activo"
                  showLabel
                />
              )}
            />
          </div>

          <section className="flex flex-col gap-3">
            <h3 className="font-extrabold">Opciones</h3>
            {errors.options?.message || errors.options?.root?.message ? (
              <p className="text-sm font-semibold text-danger-ink">
                {errors.options.message ?? errors.options.root?.message}
              </p>
            ) : null}
            {fields.map((field, index) => {
              const open = expanded.has(field.fieldKey);
              const componentCount = options?.[index]?.components?.length ?? 0;
              const optionErrors = errors.options?.[index];
              return (
                <div
                  key={field.fieldKey}
                  className="flex flex-col gap-3 rounded-2xl border border-border p-3"
                >
                  <div className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <Field label={`Opción ${index + 1}`} error={optionErrors?.name?.message}>
                      {(a) => (
                        <Input
                          {...a}
                          {...register(`options.${index}.name`)}
                          autoComplete="off"
                          placeholder="Ej. Tajín"
                        />
                      )}
                    </Field>
                    <Field label="Recargo (Q)" error={optionErrors?.priceDelta?.message}>
                      {(a) => (
                        <Input
                          {...a}
                          {...register(`options.${index}.priceDelta`, { valueAsNumber: true })}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                        />
                      )}
                    </Field>
                    <div className="col-span-2 flex items-end justify-between gap-1 sm:col-span-1">
                      <Controller
                        control={control}
                        name={`options.${index}.active`}
                        render={({ field: f }) => (
                          <Switch
                            checked={f.value ?? true}
                            onChange={f.onChange}
                            label={`Opción ${index + 1} activa`}
                          />
                        )}
                      />
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          aria-label={`Subir opción ${index + 1}`}
                        >
                          <ArrowUp aria-hidden="true" className="size-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(index, index + 1)}
                          disabled={index === fields.length - 1}
                          aria-label={`Bajar opción ${index + 1}`}
                        >
                          <ArrowDown aria-hidden="true" className="size-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger-ink"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          aria-label={`Quitar opción ${index + 1}`}
                        >
                          <Trash2 aria-hidden="true" className="size-[18px]" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleExpanded(field.fieldKey)}
                    className="flex min-h-11 items-center gap-2 self-start text-sm font-bold text-secondary-ink"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('size-4 transition', open && 'rotate-180')}
                    />
                    Consumo de inventario {componentCount ? `(${componentCount})` : '(ninguno)'}
                  </button>
                  {open ? (
                    <RecipeEditor
                      compact
                      name={`options.${index}.components`}
                      items={items.data ?? []}
                      emptyText="Esta opción no descuenta inventario."
                    />
                  ) : null}
                </div>
              );
            })}
            <Button variant="secondary" className="self-start" onClick={() => append(newOption())}>
              <Plus aria-hidden="true" className="size-4" />
              Agregar opción
            </Button>
          </section>
        </form>
      </FormProvider>
    </Modal>
  );
}
