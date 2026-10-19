import type { Prisma, User } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput } from '@sanfefer/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { hashSecret } from '../../lib/hash';
import { prisma } from '../../lib/prisma';

export function listUsers() {
  return prisma.user.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
}

async function getUserOrThrow(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('El usuario no existe.');
  return user;
}

async function assertAnotherActiveAdmin(user: User) {
  const others = await prisma.user.count({
    where: { role: 'ADMIN', active: true, id: { not: user.id } },
  });
  if (others === 0) throw conflict('Debe quedar al menos un administrador activo.');
}

export async function createUser(input: CreateUserInput) {
  return prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      role: input.role,
      pinHash: input.pin ? await hashSecret(input.pin) : null,
      // Los vendedores entran solo con PIN.
      passwordHash:
        input.role === 'ADMIN' && input.password ? await hashSecret(input.password) : null,
    },
  });
}

export async function updateUser(id: number, input: UpdateUserInput, actorId: number) {
  const user = await getUserOrThrow(id);
  const isSelf = user.id === actorId;
  const nextRole = input.role ?? user.role;
  const data: Prisma.UserUpdateInput = {};
  let revokeSessions = false;

  if (input.name !== undefined) data.name = input.name;
  if (input.username !== undefined) data.username = input.username;

  if (input.role !== undefined && input.role !== user.role) {
    if (isSelf) throw conflict('No puedes cambiar tu propio rol.');
    if (user.role === 'ADMIN' && user.active) await assertAnotherActiveAdmin(user);
    data.role = input.role;
    revokeSessions = true;
  }

  if (input.active !== undefined && input.active !== user.active) {
    if (isSelf && !input.active) throw conflict('No puedes desactivar tu propio usuario.');
    if (!input.active && user.role === 'ADMIN') await assertAnotherActiveAdmin(user);
    data.active = input.active;
    if (!input.active) revokeSessions = true;
  }

  // PIN: obligatorio para vendedores, opcional para administradores.
  const willHavePin = input.pin === undefined ? user.pinHash !== null : input.pin !== null;
  if (nextRole === 'SELLER' && !willHavePin) {
    throw badRequest('El vendedor necesita un PIN para entrar.', {
      pin: 'El vendedor necesita un PIN para entrar',
    });
  }
  if (input.pin !== undefined) {
    data.pinHash = input.pin === null ? null : await hashSecret(input.pin);
    revokeSessions = true;
  }

  // Contraseña: obligatoria para administradores; los vendedores no la usan.
  if (nextRole === 'ADMIN') {
    if (!input.password && !user.passwordHash) {
      throw badRequest('El administrador necesita una contraseña.', {
        password: 'El administrador necesita una contraseña',
      });
    }
    if (input.password) {
      data.passwordHash = await hashSecret(input.password);
      revokeSessions = true;
    }
  } else if (user.passwordHash) {
    data.passwordHash = null;
  }

  if (input.pin !== undefined || input.password) {
    data.failedLogins = 0;
    data.lockedUntil = null;
  }
  if (revokeSessions) data.tokenVersion = { increment: 1 };

  return prisma.user.update({ where: { id }, data });
}

export async function unlockUser(id: number) {
  await getUserOrThrow(id);
  return prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
}

export async function deleteUser(id: number, actorId: number) {
  const user = await getUserOrThrow(id);
  if (user.id === actorId) throw conflict('No puedes eliminar tu propio usuario.');
  if (user.role === 'ADMIN' && user.active) await assertAnotherActiveAdmin(user);
  try {
    await prisma.user.delete({ where: { id } });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2003') {
      throw conflict(
        'Este usuario tiene historial (ventas, compras o movimientos). Desactívalo en lugar de eliminarlo.',
      );
    }
    throw err;
  }
}
