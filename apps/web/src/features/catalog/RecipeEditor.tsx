import { KIND_LABELS, UNIT_LABELS, type InventoryItemDto } from '@sanfefer/shared';
import { Plus, X } from 'lucide-react';
import { get, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { formatMoney } from '@/lib/format';
import { recipeCost } from './catalog-utils';

/**
 * Lista de insumos (artículo + cantidad) dentro de un formulario con FormProvider.
 * `name` es la ruta del arreglo: "recipe" o "options.2.components".
 */
export function RecipeEditor({
  name,
  items,
  emptyText,
  compact = false,
}: {
  name: string;
  items: InventoryItemDto[];
  emptyText: string;
  compact?: boolean;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const lines = (useWatch({ control, name }) ?? []) as {
    inventoryItemId?: number;
    quantity?: number;
  }[];
  const byId = new Map(items.map((i) => [i.id, i]));
  const supplies = items.filter((i) => i.kind === 'SUPPLY');
  const resale = items.filter((i) => i.kind === 'RESALE');
  const arrayError = get(errors, name)?.message ?? get(errors, `${name}.root`)?.message;

  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 ? <p className="text-sm text-muted">{emptyText}</p> : null}
      {fields.map((field, index) => {
        const line = lines[index];
        const item = line?.inventoryItemId ? byId.get(line.inventoryItemId) : undefined;
        const itemError = get(errors, `${name}.${index}.inventoryItemId`)?.message as
          string | undefined;
        const qtyError = get(errors, `${name}.${index}.quantity`)?.message as string | undefined;
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <Select
                aria-label={`Insumo ${index + 1}`}
                aria-invalid={itemError ? true : undefined}
                className="min-w-0 flex-1"
                {...register(`${name}.${index}.inventoryItemId`, { valueAsNumber: true })}
              >
                <option value="">Elige un artículo…</option>
                {[
                  { label: KIND_LABELS.SUPPLY, list: supplies },
                  { label: KIND_LABELS.RESALE, list: resale },
                ].map((group) =>
                  group.list.length ? (
                    <optgroup key={group.label} label={group.label}>
                      {group.list.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                          {i.active ? '' : ' (inactivo)'}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </Select>
              <div className="relative w-28 shrink-0 sm:w-32">
                <Input
                  aria-label={`Cantidad del insumo ${index + 1}`}
                  aria-invalid={qtyError ? true : undefined}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  className="pr-10 text-right"
                  {...register(`${name}.${index}.quantity`, { valueAsNumber: true })}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
                  {item ? UNIT_LABELS[item.unit] : ''}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label={`Quitar insumo ${index + 1}`}
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </div>
            {itemError || qtyError ? (
              <p className="text-sm font-semibold text-danger-ink">{itemError ?? qtyError}</p>
            ) : null}
          </div>
        );
      })}
      {arrayError ? (
        <p className="text-sm font-semibold text-danger-ink">{String(arrayError)}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant={compact ? 'ghost' : 'secondary'}
          onClick={() => append({ inventoryItemId: Number.NaN, quantity: Number.NaN })}
        >
          <Plus aria-hidden="true" className="size-4" />
          Agregar insumo
        </Button>
        {fields.length > 0 ? (
          <span className="text-sm text-muted">
            Costo:{' '}
            <strong className="tabular text-text">{formatMoney(recipeCost(lines, items))}</strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}
