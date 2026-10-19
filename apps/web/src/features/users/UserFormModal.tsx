import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABELS, type UserDto } from '@sanfefer/shared';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { ApiError, errorMessage } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useCreateUser, useUpdateUser } from './api';
import {
  emptyUserForm,
  makeUserFormSchema,
  toCreatePayload,
  toUpdatePayload,
  type UserFormValues,
} from './user-form';

export function UserFormModal({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user?: UserDto;
  onClose: () => void;
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const schema = useMemo(() => makeUserFormSchema(user), [user]);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyUserForm(user),
  });

  useEffect(() => {
    if (open) reset(emptyUserForm(user));
  }, [open, user, reset]);

  const role = watch('role');
  const removePin = watch('removePin');
  const editing = !!user;
  const saving = create.isPending || update.isPending;

  const onError = (err: unknown) => {
    // Errores por campo del servidor (p. ej. usuario repetido) se muestran junto al campo.
    if (err instanceof ApiError && err.fields) {
      for (const [field, message] of Object.entries(err.fields)) {
        if (field in emptyUserForm()) setError(field as keyof UserFormValues, { message });
      }
    }
    toast.error(errorMessage(err));
  };

  const onSubmit = handleSubmit((values) => {
    if (!user) {
      create.mutate(toCreatePayload(values), {
        onSuccess: ({ user: created }) => {
          toast.success(`Usuario ${created.username} creado.`);
          onClose();
        },
        onError,
      });
      return;
    }
    const input = toUpdatePayload(values, user);
    if (Object.keys(input).length === 0) return onClose();
    update.mutate(
      { id: user.id, input },
      {
        onSuccess: () => {
          toast.success('Cambios guardados.');
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar usuario' : 'Nuevo usuario'}
      description={
        editing
          ? `@${user.username}`
          : 'Los vendedores entran con su PIN; los administradores con contraseña.'
      }
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="user-form"
            size="lg"
            className="flex-1"
            loading={saving}
            disabled={editing && !isDirty}
          >
            {editing ? 'Guardar' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nombre" error={errors.name?.message}>
          {(a) => (
            <Input {...a} {...register('name')} autoComplete="off" placeholder="Ej. Luis García" />
          )}
        </Field>
        <Field
          label="Usuario"
          error={errors.username?.message}
          hint="Minúsculas, sin espacios. Ej. luis"
        >
          {(a) => (
            <Input
              {...a}
              {...register('username')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Rol</span>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Segmented
                label="Rol"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'SELLER', label: ROLE_LABELS.SELLER },
                  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
                ]}
              />
            )}
          />
          <p className="text-sm text-muted">
            {role === 'SELLER'
              ? 'Solo puede usar el punto de venta.'
              : 'Acceso total, incluidos reportes y usuarios.'}
          </p>
        </div>

        <Field
          label={role === 'ADMIN' ? 'PIN (opcional)' : 'PIN'}
          error={errors.pin?.message}
          hint={
            editing && user.hasPin
              ? 'Déjalo vacío para conservar el PIN actual.'
              : role === 'ADMIN'
                ? 'Le permite entrar rápido al POS y autorizar descuentos.'
                : 'De 4 a 6 dígitos.'
          }
        >
          {(a) => (
            <Input
              {...a}
              {...register('pin')}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              disabled={removePin}
              placeholder={editing && user.hasPin ? '••••' : ''}
            />
          )}
        </Field>
        {editing && user.hasPin && role === 'ADMIN' ? (
          <label className="-mt-2 flex items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              {...register('removePin')}
              className="size-5 accent-[var(--danger)]"
            />
            Quitar el PIN de este administrador
          </label>
        ) : null}

        {role === 'ADMIN' ? (
          <Field
            label="Contraseña"
            error={errors.password?.message}
            hint={
              editing && user.hasPassword
                ? 'Déjala vacía para conservar la actual.'
                : 'Mínimo 8 caracteres.'
            }
          >
            {(a) => (
              <Input {...a} {...register('password')} type="password" autoComplete="new-password" />
            )}
          </Field>
        ) : null}

        {editing && (role !== user.role || watch('pin') || watch('password')) ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning-ink">
            Al guardar se cerrarán las sesiones abiertas de este usuario.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
