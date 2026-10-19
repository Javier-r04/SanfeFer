import type { Request } from 'express';
import type { z } from 'zod';
import { idParamSchema } from '@sanfefer/shared';

/** Valida req.query (en Express 5 es de solo lectura, por eso se devuelve). */
export const parseQuery = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> =>
  schema.parse(req.query);

export const parseId = (req: Request) => idParamSchema.parse(req.params).id;
