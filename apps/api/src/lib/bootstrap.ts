import { createUserSchema } from '@sanfefer/shared';
import { hashSecret } from './hash';
import { prisma } from './prisma';

/**
 * Primer arranque en producción: si todavía no existe ningún administrador, lo crea con
 * ADMIN_NAME, ADMIN_USERNAME, ADMIN_PASSWORD y ADMIN_PIN (opcional). Si ya hay uno, no hace nada,
 * así que las variables pueden quedarse puestas; conviene borrarlas después del primer ingreso.
 */
export async function ensureFirstAdmin(vars: NodeJS.ProcessEnv = process.env) {
  if ((await prisma.user.count({ where: { role: 'ADMIN' } })) > 0) return null;
  if (!vars.ADMIN_USERNAME || !vars.ADMIN_PASSWORD) {
    console.warn(
      '⚠ No hay ningún administrador. Define ADMIN_USERNAME y ADMIN_PASSWORD (y opcionalmente ADMIN_NAME y ADMIN_PIN) para crearlo al arrancar.',
    );
    return null;
  }
  const parsed = createUserSchema.safeParse({
    name: vars.ADMIN_NAME || 'Administrador',
    username: vars.ADMIN_USERNAME,
    role: 'ADMIN',
    password: vars.ADMIN_PASSWORD,
    pin: vars.ADMIN_PIN || undefined,
  });
  if (!parsed.success) {
    console.error('❌ No se creó el administrador inicial:');
    for (const issue of parsed.error.issues)
      console.error(`  - ADMIN_${String(issue.path[0]).toUpperCase()}: ${issue.message}`);
    return null;
  }
  const data = parsed.data;
  const admin = await prisma.user.create({
    data: {
      name: data.name,
      username: data.username,
      role: 'ADMIN',
      passwordHash: await hashSecret(data.password!),
      pinHash: data.pin ? await hashSecret(data.pin) : null,
    },
  });
  console.log(
    `✅ Administrador inicial creado: "${admin.username}". Ya puedes entrar y borrar ADMIN_PASSWORD.`,
  );
  return admin;
}
