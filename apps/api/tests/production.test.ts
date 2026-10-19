// Lo que importa al publicar: administrador inicial y respuestas sin caché.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureFirstAdmin } from '../src/lib/bootstrap';
import { prisma } from '../src/lib/prisma';
import { app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const vars = {
  ADMIN_NAME: 'Fernanda Sandoval',
  ADMIN_USERNAME: 'Fernanda',
  ADMIN_PASSWORD: 'Una-clave-segura-2026',
  ADMIN_PIN: '9999',
};

describe('administrador inicial', () => {
  it('lo crea con las variables de entorno y puede entrar', async () => {
    const admin = await ensureFirstAdmin(vars);
    expect(admin).toMatchObject({ username: 'fernanda', role: 'ADMIN', active: true });
    await request(app)
      .post('/api/auth/login/password')
      .send({ username: 'fernanda', password: vars.ADMIN_PASSWORD })
      .expect(200);
  });

  it('no hace nada si ya existe un administrador', async () => {
    await createUser({ username: 'jefa', role: 'ADMIN', password: 'Sanfefer2026' });
    expect(await ensureFirstAdmin(vars)).toBeNull();
    expect(await prisma.user.count()).toBe(1);
  });

  it('sin variables, o con datos inválidos, avisa y no crea nada', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await ensureFirstAdmin({})).toBeNull();
    expect(await ensureFirstAdmin({ ...vars, ADMIN_PASSWORD: 'corta' })).toBeNull();
    expect(await prisma.user.count()).toBe(0);
    expect(error.mock.calls.flat().join(' ')).toContain('al menos 8 caracteres');
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('respuestas de la API', () => {
  it('nunca se guardan en caché (Vercel reenvía /api y no debe compartir respuestas)', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.headers['cache-control']).toBe('no-store');
    const denied = await request(app).get('/api/auth/me').expect(401);
    expect(denied.headers['cache-control']).toBe('no-store');
  });
});
