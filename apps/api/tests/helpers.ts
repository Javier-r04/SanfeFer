import type { Role } from '@sanfefer/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function createUser(opts: {
  username: string;
  role?: Role;
  pin?: string;
  password?: string;
  active?: boolean;
}) {
  return prisma.user.create({
    data: {
      name: opts.username.charAt(0).toUpperCase() + opts.username.slice(1),
      username: opts.username,
      role: opts.role ?? 'SELLER',
      pinHash: opts.pin ? await bcrypt.hash(opts.pin, 4) : null,
      passwordHash: opts.password ? await bcrypt.hash(opts.password, 4) : null,
      active: opts.active ?? true,
    },
  });
}

/** Agente con la cookie de sesión de un admin ya iniciada. */
export async function adminAgent() {
  await createUser({ username: 'admin', role: 'ADMIN', password: 'Sanfefer2026' });
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login/password')
    .send({ username: 'admin', password: 'Sanfefer2026' })
    .expect(200);
  return agent;
}
