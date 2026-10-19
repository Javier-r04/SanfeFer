import type { ApiErrorBody } from '@sanfefer/shared';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Freno a intentos de ingreso por IP (además del bloqueo por usuario). */
export const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiados intentos de ingreso desde este dispositivo. Espera unos minutos.',
    },
  } satisfies ApiErrorBody,
});
