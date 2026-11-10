import { zodResolver } from '@hookform/resolvers/zod';
import { tableBulkSchema, tableInputSchema, type DiningTableDto } from '@sanfefer/shared';
import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus, Rows3, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { moveId } from '@/features/catalog/catalog-utils';
import { PageHeader } from '@/features/common/ComingSoon';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import {
  useCreateTable,
  useCreateTables,
  useDeleteTable,
  useReorderTables,
  useTables,
  useUpdateTable,
} from './api';

/** Zonas ya usadas, para sugerirlas al escribir (Salón, Terraza…). */
function ZoneOptions({ id, zones }: { id: string; zones: string[] }) {
  return (
    <datalist id={id}>
      {zones.map((z) => (
        <option key={z} value={z} />
      ))}
    </datalist>
  );
}

function TableFormModal({
  open,
  table,
  zones,
  onClose,
}: {
  open: boolean;
  table?: DiningTableDto;
  zones: string[];
  onClose: () => void;
}) {
  const create = useCreateTable();
  const update = useUpdateTable();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tableInputSchema),
    defaultValues: { name: '', zone: '', active: true },
  });

  useEffect(() => {
    if (open)
      reset(
        table
          ? { name: table.name, zone: table.zone ?? '', active: table.active }
          : { name: '', zone: '', active: true },
      );
  }, [open, table, reset]);

  const onSubmit = handleSubmit((values) => {
    const opts = {
      onSuccess: () => {
        toast.success(table ? 'Mesa actualizada.' : `${values.name} creada.`);
        onClose();
      },
      onError: (err: unknown) => handleFormError(err, setError),
    };
    if (table) update.mutate({ id: table.id, input: values }, opts);
    else create.mutate(values, opts);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={table ? `Editar ${table.name}` : 'Nueva mesa'}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="table-form"
            size="lg"
            className="flex-1"
            loading={create.isPending || update.isPending}
          >
            {table ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <form id="table-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nombre" error={errors.name?.message}>
          {(a) => (
            <Input {...a} {...register('name')} autoComplete="off" placeholder="Ej. Mesa 1" />
          )}
        </Field>
        <Field
          label="Zona (opcional)"
          error={errors.zone?.message}
          hint="Agrupa las mesas en el POS. Ej. Salón, Terraza, Barra."
        >
          {(a) => <Input {...a} {...register('zone')} autoComplete="off" list="table-zones" />}
        </Field>
        <ZoneOptions id="table-zones" zones={zones} />
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

function BulkTablesModal({
  open,
  zones,
  onClose,
}: {
  open: boolean;
  zones: string[];
  onClose: () => void;
}) {
  const bulk = useCreateTables();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tableBulkSchema),
    defaultValues: { prefix: 'Mesa', start: 1, count: 6, zone: '' },
  });

  useEffect(() => {
    if (open) reset({ prefix: 'Mesa', start: 1, count: 6, zone: '' });
  }, [open, reset]);

  const [prefix, start, count] = watch(['prefix', 'start', 'count']);
  const valid = prefix?.trim() && Number.isInteger(start) && Number.isInteger(count) && count > 0;
  const preview = valid
    ? `${prefix.trim()} ${start}${count > 1 ? ` … ${prefix.trim()} ${start + count - 1}` : ''}`
    : '—';

  const onSubmit = handleSubmit((values) =>
    bulk.mutate(values, {
      onSuccess: ({ created, skipped }) => {
        if (created.length)
          toast.success(
            `${created.length} mesa${created.length === 1 ? '' : 's'} creada${created.length === 1 ? '' : 's'}.` +
              (skipped.length ? ` Ya existían: ${skipped.join(', ')}.` : ''),
          );
        else toast.error(`Todas esas mesas ya existían: ${skipped.join(', ')}.`);
        onClose();
      },
      onError: (err) => handleFormError(err, setError),
    }),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar varias mesas"
      description="Crea mesas numeradas en un solo paso. Las que ya existan se saltan."
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="bulk-form"
            size="lg"
            className="flex-1"
            loading={bulk.isPending}
          >
            Crear
          </Button>
        </>
      }
    >
      <form id="bulk-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nombre" error={errors.prefix?.message}>
          {(a) => <Input {...a} {...register('prefix')} autoComplete="off" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde el número" error={errors.start?.message}>
            {(a) => (
              <Input
                {...a}
                {...register('start', { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min={1}
              />
            )}
          </Field>
          <Field label="Cuántas" error={errors.count?.message}>
            {(a) => (
              <Input
                {...a}
                {...register('count', { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
              />
            )}
          </Field>
        </div>
        <Field label="Zona (opcional)" error={errors.zone?.message}>
          {(a) => <Input {...a} {...register('zone')} autoComplete="off" list="bulk-zones" />}
        </Field>
        <ZoneOptions id="bulk-zones" zones={zones} />
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
          Se crearán: <strong>{preview}</strong>
        </p>
      </form>
    </Modal>
  );
}

export function TablesPage() {
  const tables = useTables();
  const update = useUpdateTable();
  const reorder = useReorderTables();
  const remove = useDeleteTable();
  const [editing, setEditing] = useState<DiningTableDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DiningTableDto | null>(null);
  const zones = useMemo(
    () =>
      [...new Set((tables.data ?? []).map((t) => t.zone).filter((z): z is string => !!z))].sort(
        (a, b) => a.localeCompare(b, 'es'),
      ),
    [tables.data],
  );

  const header = (
    <PageHeader
      title="Mesas"
      subtitle="Las mesas del punto de venta. El orden de esta lista es el orden en el POS."
      actions={
        <>
          <Button variant="outline" size="lg" onClick={() => setBulkOpen(true)}>
            <Rows3 aria-hidden="true" className="size-5" />
            Agregar varias
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="size-5" />
            Nueva mesa
          </Button>
        </>
      }
    />
  );

  const modals = (
    <>
      <TableFormModal
        open={formOpen}
        table={editing}
        zones={zones}
        onClose={() => setFormOpen(false)}
      />
      <BulkTablesModal open={bulkOpen} zones={zones} onClose={() => setBulkOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title={`¿Borrar ${toDelete?.name ?? ''}?`}
        message="Se quita del punto de venta. Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(`${toDelete.name} borrada.`);
              setToDelete(null);
            },
            onError: (e) => {
              toast.error(errorMessage(e));
              setToDelete(null);
            },
          })
        }
        onClose={() => setToDelete(null)}
      />
    </>
  );

  if (tables.isPending)
    return (
      <>
        {header}
        <LoadingState />
      </>
    );
  if (tables.error)
    return (
      <>
        {header}
        <ErrorState error={tables.error} onRetry={() => void tables.refetch()} />
      </>
    );
  const list = tables.data;

  const move = (t: DiningTableDto, dir: -1 | 1) => {
    const ids = moveId(
      list.map((x) => x.id),
      t.id,
      dir,
    );
    if (ids) reorder.mutate(ids, { onError: (e) => toast.error(errorMessage(e)) });
  };

  return (
    <div className="flex flex-col">
      {header}
      {list.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid aria-hidden="true" className="size-8 text-muted" />}
          title="Aún no hay mesas."
        >
          Usa <strong>Agregar varias</strong> para crear, por ejemplo, de la Mesa 1 a la Mesa 12 en
          un solo paso. Mientras tanto, en el POS puedes atender clientes sin mesa.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((t, index) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-3 border-t border-surface-2 px-4 py-3 first:border-t-0"
            >
              <div className={cn('min-w-36 flex-1', !t.active && 'opacity-60')}>
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {t.name}
                  {t.openTabs > 0 ? (
                    <Badge tone="warning">
                      {t.openTabs} cuenta{t.openTabs === 1 ? '' : 's'} abierta
                      {t.openTabs === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                  {!t.active ? <Badge>Oculta en el POS</Badge> : null}
                </p>
                <p className="text-sm text-muted">{t.zone ?? 'Sin zona'}</p>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  checked={t.active}
                  onChange={(active) =>
                    update.mutate(
                      { id: t.id, input: { active } },
                      { onError: (e) => toast.error(errorMessage(e)) },
                    )
                  }
                  label={`${t.name} visible en el POS`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(t, -1)}
                  disabled={index === 0 || reorder.isPending}
                  aria-label={`Subir ${t.name}`}
                  title="Subir"
                >
                  <ArrowUp aria-hidden="true" className="size-[18px]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(t, 1)}
                  disabled={index === list.length - 1 || reorder.isPending}
                  aria-label={`Bajar ${t.name}`}
                  title="Bajar"
                >
                  <ArrowDown aria-hidden="true" className="size-[18px]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(t);
                    setFormOpen(true);
                  }}
                  aria-label={`Editar ${t.name}`}
                  title="Editar"
                >
                  <Pencil aria-hidden="true" className="size-[18px]" />
                </Button>
                {/* Con historial no se borra (las cuentas cobradas la necesitan): solo se oculta. */}
                {!t.hasHistory ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setToDelete(t)}
                    aria-label={`Borrar ${t.name}`}
                    title="Borrar"
                  >
                    <Trash2 aria-hidden="true" className="size-[18px]" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.some((t) => t.hasHistory) ? (
        <p className="mt-3 text-[13px] text-muted">
          Las mesas que ya tuvieron cuentas no se borran, porque el historial y los reportes las
          usan. Apágalas para ocultarlas del POS.
        </p>
      ) : null}
      {modals}
    </div>
  );
}
