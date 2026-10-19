import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

/** Valida y normaliza req.body; los errores llegan al manejador central como ZodError. */
export const validateBody =
  <T extends z.ZodType>(schema: T) =>
  (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
