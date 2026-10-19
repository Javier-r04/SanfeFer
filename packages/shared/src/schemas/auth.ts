import { z } from 'zod';
import { passwordSchema, pinSchema, usernameSchema } from './common';

export const pinLoginSchema = z.object({
  username: usernameSchema,
  pin: pinSchema,
});
export type PinLoginInput = z.infer<typeof pinLoginSchema>;

export const passwordLoginSchema = z.object({
  username: usernameSchema,
  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria'),
});
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;

// La contraseña nueva sí exige las reglas completas.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: passwordSchema,
});
