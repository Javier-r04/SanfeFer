import type { AuthUser } from '@sanfefer/shared';
import { AppError } from './errors';
import { verifySecret } from './hash';
import { prisma } from './prisma';

/**
 * Para acciones sensibles del POS (descuentos, cancelar algo ya preparado):
 * si quien actúa es admin, autoriza él mismo; si es vendedor, necesita el PIN de un admin.
 * Devuelve el admin que autorizó.
 */
export async function resolveAuthorizer(user: AuthUser, pin: string | undefined, action: string) {
  if (user.role === 'ADMIN') return { id: user.id, name: user.name };
  if (!pin) {
    throw new AppError(
      403,
      'AUTHORIZATION_REQUIRED',
      `${action}: un administrador debe autorizar con su PIN.`,
      {
        authorizationPin: 'Pide el PIN a un administrador',
      },
    );
  }
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true, pinHash: { not: null } },
  });
  for (const admin of admins) {
    if (await verifySecret(pin, admin.pinHash!)) return { id: admin.id, name: admin.name };
  }
  throw new AppError(403, 'AUTHORIZATION_INVALID', 'PIN de administrador incorrecto.', {
    authorizationPin: 'PIN incorrecto',
  });
}
