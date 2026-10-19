import { zodResolver } from '@hookform/resolvers/zod';
import {
  marginOf,
  productInputSchema,
  requiredExtrasBase,
  type ProductDto,
} from '@sanfefer/shared';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useInventoryItems } from '@/features/inventory/api';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/format';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useCategories, useCreateProduct, useModifierGroups, useUpdateProduct } from './api';
import { recipeCost, selectionRule } from './catalog-utils';
import { RecipeEditor } from './RecipeEditor';

const emptyValues = (categoryId?: number) => ({
  name: '',
  categoryId: categoryId ?? Number.NaN,
  price: Number.NaN,
  description: '',
  active: true,
  recipe: [] as { inventoryItemId: number; quantity: number }[],
  modifierGroupIds: [] as number[],
});

const fromProduct = (p: ProductDto) => ({
  name: p.name,
  categoryId: p.categoryId,
  price: p.price,
  description: p.description ?? '',
  active: p.active,
  recipe: p.recipe.map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: l.quantity })),
  modifierGroupIds: p.modifierGroupIds,
});

export function ProductFormModal({
  open,
  product,
  defaultCategoryId,
  onClose,
}: {
  open: boolean;
  product?: ProductDto;
  defaultCategoryId?: number;
  onClose: () => void;
}) {
  const categories = useCategories();
  const groups = useModifierGroups();
  const items = useInventoryItems({ includeInactive: true });
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const form = useForm({ resolver: zodResolver(productInputSchema), defaultValues: emptyValues() });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(product ? fromProduct(product) : emptyValues(defaultCategoryId));
  }, [open, product, defaultCategoryId, reset]);

  const [price, recipe, selectedGroups] = useWatch({
    control,
    name: ['price', 'recipe', 'modifierGroupIds'],
  });
  // Mismo cálculo que la API: receta + extras obligatorios más baratos (ej. la cerveza).
  const extras = requiredExtrasBase(
    (groups.data ?? []).filter((g) => selectedGroups?.includes(g.id)),
  );
  const basePrice = (Number.isFinite(price) ? price : 0) + extras.priceDelta;
  const cost = recipeCost(recipe ?? [], items.data ?? []) + extras.cost;
  const margin = Number.isFinite(price) ? marginOf(basePrice, cost) : null;

  const onSubmit = handleSubmit((values) => {
    const onError = (err: unknown) => handleFormError(err, setError);
    if (product) {
      update.mutate(
        { id: product.id, input: values },
        {
          onSuccess: () => {
            toast.success('Producto actualizado.');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: ({ product: p }) => {
          toast.success(`${p.name} agregado al menú.`);
          onClose();
        },
        onError,
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="product-form"
            size="lg"
            className="flex-1"
            loading={create.isPending || update.isPending}
          >
            {product ? 'Guardar' : 'Agregar al menú'}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form id="product-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" error={errors.name?.message} className="sm:col-span-2">
              {(a) => (
                <Input
                  {...a}
                  {...register('name')}
                  autoComplete="off"
                  placeholder="Ej. Michelada de mango"
                />
              )}
            </Field>
            <Field label="Categoría" error={errors.categoryId?.message}>
              {(a) => (
                <Select {...a} {...register('categoryId', { valueAsNumber: true })}>
                  <option value="">Elige una categoría…</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.active ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Precio (Q)" error={errors.price?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...register('price', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                />
              )}
            </Field>
            <Field
              label="Descripción (opcional)"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              {(a) => (
                <Textarea
                  {...a}
                  {...register('description')}
                  rows={2}
                  placeholder="Ej. Pulpa de mango, chamoy y tajín"
                />
              )}
            </Field>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  label="Disponible en el menú"
                  showLabel
                />
              )}
            />
          </div>

          <section className="flex flex-col gap-2 rounded-2xl border border-border p-4">
            <div>
              <h3 className="font-extrabold">Receta</h3>
              <p className="text-sm text-muted">
                Lo que se descuenta del inventario al vender una unidad. La cerveza de la michelada
                va en los extras.
              </p>
            </div>
            <RecipeEditor
              name="recipe"
              items={items.data ?? []}
              emptyText="Sin receta: este producto no controlará stock."
            />
            {margin !== null ? (
              <p
                className={cn(
                  'text-sm font-bold',
                  margin < 0.3 ? 'text-warning-ink' : 'text-primary-ink',
                )}
              >
                Costo {formatMoney(cost)} · utilidad {formatMoney(basePrice - cost)} (
                {formatPercent(margin)})
                {extras.cost > 0 ? (
                  <span className="block font-semibold text-muted">
                    Incluye {formatMoney(extras.cost)} de extras obligatorios (la opción más
                    barata).
                  </span>
                ) : null}
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <div>
              <h3 className="font-extrabold">Extras</h3>
              <p className="text-sm text-muted">
                Opciones que el vendedor elige al tomar la orden.
              </p>
            </div>
            <Controller
              control={control}
              name="modifierGroupIds"
              render={({ field: { value: selected = [], onChange } }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.data?.length ? (
                    groups.data.map((g) => {
                      const checked = selected.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3',
                            checked ? 'border-primary bg-primary-soft' : 'border-border',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 accent-[var(--primary)]"
                            checked={checked}
                            onChange={() =>
                              onChange(
                                checked
                                  ? selected.filter((id) => id !== g.id)
                                  : [...selected, g.id],
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block font-bold">
                              {g.name}
                              {g.active ? '' : ' (inactivo)'}
                            </span>
                            <span className="block text-sm text-muted">
                              {selectionRule(g.minSelect, g.maxSelect)} ·{' '}
                              {g.options.map((o) => o.name).join(', ')}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted">
                      Aún no hay grupos de extras. Créalos en la pestaña Extras.
                    </p>
                  )}
                </div>
              )}
            />
          </section>
        </form>
      </FormProvider>
    </Modal>
  );
}
