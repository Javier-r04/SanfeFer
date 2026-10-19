import { z } from 'zod';
import { PIN_REGEX, ROLES, USERNAME_REGEX } from '../constants';

export const idParamSchema = z.object({
  id: z.coerce
    .number({ error: 'El identificador no es válido' })
    .int()
    .positive('El identificador no es válido'),
});

export const nameSchema = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(60, 'El nombre no puede tener más de 60 caracteres');

export const usernameSchema = z
  .string({ error: 'El usuario es obligatorio' })
  .trim()
  .toLowerCase()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(30, 'El usuario no puede tener más de 30 caracteres')
  .regex(
    USERNAME_REGEX,
    'Usa solo letras minúsculas, números, punto, guion o guion bajo (sin espacios ni tildes)',
  );

export const pinSchema = z
  .string({ error: 'El PIN es obligatorio' })
  .regex(PIN_REGEX, 'El PIN debe tener de 4 a 6 dígitos');

export const passwordSchema = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede tener más de 72 caracteres');

export const roleSchema = z.enum(ROLES, { error: 'Selecciona un rol válido' });
