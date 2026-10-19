import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@sanfefer/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const FIELD_LABELS: Record<string, string> = {
  username: 'ese usuario',
  name: 'ese nombre',
};

function send(res: Response, status: number, body: ApiErrorBody['error']) {
  res.status(status).json({ error: body } satisfies ApiErrorBody);
}

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, {
    code: 'ROUTE_NOT_FOUND',
    message: `La ruta ${req.method} ${req.path} no existe.`,
  });
}

// Express reconoce el manejador de errores por sus 4 parámetros.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(res, err.status, { code: err.code, message: err.message, fields: err.fields });
  }

  if (err instanceof ZodError) {
    const fields = zodFields(err);
    const first = err.issues[0]?.message ?? 'Revisa los datos ingresados.';
    return send(res, 400, { code: 'VALIDATION_ERROR', message: first, fields });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.[0];
      const label = (target && FIELD_LABELS[target]) ?? 'esos datos';
      return send(res, 409, {
        code: 'DUPLICATE',
        message: `Ya existe un registro con ${label}.`,
        fields: target ? { [target]: `Ya existe un registro con ${label}.` } : undefined,
      });
    }
    if (err.code === 'P2025') {
      return send(res, 404, { code: 'NOT_FOUND', message: 'No se encontró el registro.' });
    }
    if (err.code === 'P2003') {
      return send(res, 409, {
        code: 'IN_USE',
        message: 'El registro está siendo usado por otros datos y no se puede eliminar.',
      });
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(err);
    return send(res, 503, {
      code: 'DB_UNAVAILABLE',
      message: 'No se pudo conectar a la base de datos. Intenta de nuevo en unos segundos.',
    });
  }

  // Errores de body-parser (JSON mal formado, cuerpo demasiado grande).
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    return send(res, 400, {
      code: 'INVALID_JSON',
      message: 'El cuerpo de la solicitud no es JSON válido.',
    });
  }
  if (type === 'entity.too.large') {
    return send(res, 413, {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La solicitud es demasiado grande.',
    });
  }

  if (env.NODE_ENV !== 'test') console.error(err);
  return send(res, 500, {
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error inesperado. Si se repite, avisa al administrador.',
  });
}
