import {
  nameSchema,
  passwordSchema,
  pinSchema,
  roleSchema,
  usernameSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserDto,
} from '@sanfefer/shared';
import { z } from 'zod';

/** Campo opcional en el formulario: vacío = no se envía / no se cambia. */
const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(''), schema]);

export const makeUserFormSchema = (existing?: UserDto) =>
  z
    .object({
      name: nameSchema,
      username: usernameSchema,
      role: roleSchema,
      pin: optional(pinSchema),
      password: optional(passwordSchema),
      removePin: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const hasPin = v.removePin ? false : v.pin !== '' || !!existing?.hasPin;
      if (v.role === 'SELLER' && !hasPin) {
        ctx.addIssue({
          code: 'custom',
          path: ['pin'],
          message: 'El vendedor necesita un PIN para entrar',
        });
      }
      // Al convertir un vendedor en admin, o al crear un admin, la contraseña es obligatoria.
      const hasPassword = v.password !== '' || (existing?.role === 'ADMIN' && existing.hasPassword);
      if (v.role === 'ADMIN' && !hasPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'El administrador necesita una contraseña',
        });
      }
    });

export type UserFormValues = z.input<ReturnType<typeof makeUserFormSchema>>;

export const emptyUserForm = (existing?: UserDto): UserFormValues => ({
  name: existing?.name ?? '',
  username: existing?.username ?? '',
  role: existing?.role ?? 'SELLER',
  pin: '',
  password: '',
  removePin: false,
});

export function toCreatePayload(v: UserFormValues): CreateUserInput {
  return {
    name: v.name.trim(),
    username: v.username.trim().toLowerCase(),
    role: v.role,
    pin: v.pin || undefined,
    password: v.role === 'ADMIN' ? v.password || undefined : undefined,
  };
}

/** Solo los campos que cambiaron. */
export function toUpdatePayload(v: UserFormValues, existing: UserDto): UpdateUserInput {
  const out: UpdateUserInput = {};
  const name = v.name.trim();
  const username = v.username.trim().toLowerCase();
  if (name !== existing.name) out.name = name;
  if (username !== existing.username) out.username = username;
  if (v.role !== existing.role) out.role = v.role;
  if (v.removePin && v.role === 'ADMIN') out.pin = null;
  else if (v.pin) out.pin = v.pin;
  if (v.role === 'ADMIN' && v.password) out.password = v.password;
  return out;
}
