import { z } from 'zod';
import { nameSchema, passwordSchema, pinSchema, roleSchema, usernameSchema } from './common';

export const createUserSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    role: roleSchema,
    pin: pinSchema.optional(),
    password: passwordSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'SELLER' && !data.pin) {
      ctx.addIssue({
        code: 'custom',
        path: ['pin'],
        message: 'El vendedor necesita un PIN para entrar',
      });
    }
    if (data.role === 'ADMIN' && !data.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'El administrador necesita una contraseña',
      });
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    role: roleSchema,
    /** null quita el PIN (solo administradores). */
    pin: pinSchema.nullable(),
    password: passwordSchema,
    active: z.boolean({ error: 'El estado debe ser verdadero o falso' }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios para guardar' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
