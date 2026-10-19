import type { Role } from '@sanfefer/shared';
import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { clearSessionCookie, readSessionToken, SESSION_COOKIE } from '../lib/session';

/** Exige una sesión válida y carga el usuario en req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === 'string' ? readSessionToken(token) : null;
  if (!session) {
    clearSessionCookie(res);
    throw unauthorized();
  }

  // Se consulta la BD en cada petición para que desactivar un usuario o cambiar su PIN
  // cierre sus sesiones al instante.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, username: true, role: true, active: true, tokenVersion: true },
  });
  if (!user || !user.active || user.tokenVersion !== session.tokenVersion) {
    clearSessionCookie(res);
    throw unauthorized();
  }

  req.user = { id: user.id, name: user.name, username: user.username, role: user.role };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role))
      throw forbidden('Esta sección es solo para administradores.');
    next();
  };

/** Usuario autenticado; usar solo en rutas protegidas por requireAuth. */
export function currentUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}
