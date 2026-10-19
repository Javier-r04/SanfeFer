import { zodResolver } from '@hookform/resolvers/zod';
import { supplierInputSchema, type SupplierDto, type SupplierInput } from '@sanfefer/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { handleFormError } from '@/lib/forms';
import { toast } from '@/stores/toast';
import { useCreateSupplier, useUpdateSupplier } from './api';

const empty: SupplierInput = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  taxId: '',
  notes: '',
};

export function SupplierFormModal({
  open,
  supplier,
  onClose,
  onCreated,
}: {
  open: boolean;
  supplier?: SupplierDto;
  onClose: () => void;
  onCreated?: (supplier: SupplierDto) => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierInputSchema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      supplier
        ? {
            name: supplier.name,
            contactName: supplier.contactName ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            taxId: supplier.taxId ?? '',
            notes: supplier.notes ?? '',
          }
        : empty,
    );
  }, [open, supplier, reset]);

  const onSubmit = handleSubmit((values) => {
    const onError = (err: unknown) => handleFormError(err, setError);
    if (supplier) {
      update.mutate(
        { id: supplier.id, input: values },
        {
          onSuccess: () => {
            toast.success('Proveedor actualizado.');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: ({ supplier: created }) => {
          toast.success(`Proveedor ${created.name} creado.`);
          onCreated?.(created);
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
      title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="supplier-form"
            size="lg"
            className="flex-1"
            loading={create.isPending || update.isPending}
          >
            {supplier ? 'Guardar' : 'Crear proveedor'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={errors.name?.message} className="sm:col-span-2">
          {(a) => (
            <Input
              {...a}
              {...register('name')}
              autoComplete="off"
              placeholder="Ej. Distribuidora La Fragua"
            />
          )}
        </Field>
        <Field label="Contacto (opcional)" error={errors.contactName?.message}>
          {(a) => <Input {...a} {...register('contactName')} autoComplete="off" />}
        </Field>
        <Field label="Teléfono (opcional)" error={errors.phone?.message}>
          {(a) => (
            <Input
              {...a}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="Ej. 5512-3344"
            />
          )}
        </Field>
        <Field label="Correo (opcional)" error={errors.email?.message}>
          {(a) => (
            <Input
              {...a}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="NIT (opcional)" error={errors.taxId?.message}>
          {(a) => <Input {...a} {...register('taxId')} autoComplete="off" />}
        </Field>
        <Field label="Notas (opcional)" error={errors.notes?.message} className="sm:col-span-2">
          {(a) => (
            <Textarea
              {...a}
              {...register('notes')}
              rows={2}
              placeholder="Ej. Entrega martes y viernes, pedido mínimo 5 cajas"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
