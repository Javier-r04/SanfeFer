import type { User } from '@prisma/client';
import {
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  type LoginTileUser,
  type PasswordLoginInput,
  type PinLoginInput,
} from '@sanfefer/shared';
import { AppError, unauthorized } from '../../lib/errors';
import { verifySecret } from '../../lib/hash';
import { prisma } from '../../lib/prisma';
import { initials } from '../users/users.mapper';

function assertNotLocked(user: User) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(
      423,
      'USER_LOCKED',
      `Usuario bloqueado por varios intentos fallidos. Intenta de nuevo en ${minutes} min o pide al administrador que lo desbloquee.`,
    );
  }
}

async function registerFailure(user: User, what: 'PIN' | 'Contraseña'): Promise<never> {
  // Si el bloqueo anterior ya venció, se empieza a contar de nuevo.
  const previous = user.lockedUntil && user.lockedUntil <= new Date() ? 0 : user.failedLogins;
  const failed = previous + 1;
  const lock = failed >= MAX_FAILED_LOGINS;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins: lock ? 0 : failed,
      lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
    },
  });
  if (lock) {
    throw new AppError(
      423,
      'USER_LOCKED',
      `Demasiados intentos fallidos. El usuario quedó bloqueado por ${LOCK_MINUTES} minutos.`,
    );
  }
  const left = MAX_FAILED_LOGINS - failed;
  throw unauthorized(
    `${what} incorrect${what === 'PIN' ? 'o' : 'a'}. Te quedan ${left} intento${left === 1 ? '' : 's'}.`,
  );
}

async function registerSuccess(user: User) {
  if (user.failedLogins === 0 && !user.lockedUntil) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });
}

export async function loginWithPin({ username, pin }: PinLoginInput) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !user.pinHash) throw unauthorized('Usuario o PIN incorrecto.');
  assertNotLocked(user);
  if (!(await verifySecret(pin, user.pinHash))) return registerFailure(user, 'PIN');
  return registerSuccess(user);
}

export async function loginWithPassword({ username, password }: PasswordLoginInput) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !user.passwordHash || user.role !== 'ADMIN') {
    throw unauthorized('Usuario o contraseña incorrectos.');
  }
  assertNotLocked(user);
  if (!(await verifySecret(password, user.passwordHash)))
    return registerFailure(user, 'Contraseña');
  return registerSuccess(user);
}

/** Usuarios que pueden entrar con PIN, para la pantalla de ingreso rápido. */
export async function listLoginTiles(): Promise<LoginTileUser[]> {
  const users = await prisma.user.findMany({
    where: { active: true, pinHash: { not: null } },
    select: { id: true, name: true, username: true },
    orderBy: { name: 'asc' },
  });
  return users.map((u) => ({ ...u, initials: initials(u.name) }));
}
