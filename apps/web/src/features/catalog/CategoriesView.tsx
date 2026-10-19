import { zodResolver } from '@hookform/resolvers/zod';
import {
  CATEGORY_COLOR_LABELS,
  CATEGORY_COLORS,
  categoryInputSchema,
  type CategoryDto,
} from '@sanfefer/shared';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from './api';
import { CATEGORY_DOT, moveId } from './catalog-utils';

function CategoryFormModal({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category?: CategoryDto;
  onClose: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: { name: '', color: 'primary' as const, active: true },
  });

  useEffect(() => {
    if (open)
      reset(
        category
          ? { name: category.name, color: category.color, active: category.active }
          : { name: '', color: 'primary', active: true },
      );
  }, [open, category, reset]);

  const onSubmit = handleSubmit((values) => {
    const opts = {
      onSuccess: () => {
        toast.success(category ? 'Categoría actualizada.' : `Categoría ${values.name} creada.`);
        onClose();
      },
      onError: (err: unknown) => handleFormError(err, setError),
    };
    if (category) update.mutate({ id: category.id, input: values }, opts);
    else create.mutate(values, opts);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="category-form"
            size="lg"
            className="flex-1"
            loading={create.isPending || update.isPending}
          >
            {category ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nombre" error={errors.name?.message}>
          {(a) => (
            <Input {...a} {...register('name')} autoComplete="off" placeholder="Ej. Micheladas" />
          )}
        </Field>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-bold">Color en el POS</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <label
                    key={c}
                    className={cn(
                      'flex h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 text-sm font-bold',
                      field.value === c ? 'border-text bg-surface-2' : 'border-border',
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name="color"
                      value={c}
                      checked={field.value === c}
                      onChange={() => field.onChange(c)}
                    />
                    <span
                      aria-hidden="true"
                      className={cn('size-4 rounded-full', CATEGORY_DOT[c])}
                    />
                    {CATEGORY_COLOR_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onChange={field.onChange}
              label="Visible en el POS"
              showLabel
            />
          )}
        />
      </form>
    </Modal>
  );
}

export function CategoriesView() {
  const categories = useCategories();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<CategoryDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CategoryDto | null>(null);

  if (categories.isPending) return <LoadingState />;
  if (categories.error)
    return <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />;
  const list = categories.data;

  const move = (c: CategoryDto, dir: -1 | 1) => {
    const ids = moveId(
      list.map((x) => x.id),
      c.id,
      dir,
    );
    if (ids) reorder.mutate(ids, { onError: (e) => toast.error(errorMessage(e)) });
  };
  const openForm = (c?: CategoryDto) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          El orden de esta lista es el orden de las pestañas en el POS.
        </p>
        <Button size="lg" onClick={() => openForm()}>
          <Plus aria-hidden="true" className="size-5" />
          Nueva categoría
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<Tags aria-hidden="true" className="size-8 text-muted" />}
          title="Aún no hay categorías."
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((c, index) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-t border-surface-2 px-4 py-3 first:border-t-0"
            >
              <span
                aria-hidden="true"
                className={cn('size-4 shrink-0 rounded-full', CATEGORY_DOT[c.color])}
              />
              <div className={cn('min-w-40 flex-1', !c.active && 'opacity-60')}>
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.productCount} producto{c.productCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  checked={c.active}
                  onChange={(active) =>
                    update.mutate(
                      { id: c.id, input: { active } },
                      { onError: (e) => toast.error(errorMessage(e)) },
                    )
                  }
                  label={`${c.name} visible en el POS`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(c, -1)}
                  disabled={index === 0 || reorder.isPending}
                  aria-label={`Subir ${c.name}`}
                  title="Subir"
                >
                  <ArrowUp aria-hidden="true" className="size-[18px]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(c, 1)}
                  disabled={index === list.length - 1 || reorder.isPending}
                  aria-label={`Bajar ${c.name}`}
                  title="Bajar"
                >
                  <ArrowDown aria-hidden="true" className="size-[18px]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openForm(c)}
                  aria-label={`Editar ${c.name}`}
                  title="Editar"
                >
                  <Pencil aria-hidden="true" className="size-[18px]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-danger-ink"
                  onClick={() => setToDelete(c)}
                  aria-label={`Eliminar ${c.name}`}
                  title="Eliminar"
                >
                  <Trash2 aria-hidden="true" className="size-[18px]" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CategoryFormModal open={formOpen} category={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        tone="danger"
        title="Eliminar categoría"
        confirmLabel="Eliminar"
        loading={remove.isPending}
        message={`¿Eliminar la categoría ${toDelete?.name ?? ''}? Solo se puede si no tiene productos.`}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success(`Categoría ${toDelete.name} eliminada.`),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </div>
  );
}
