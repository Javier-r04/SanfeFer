import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('ingreso con PIN', () => {
  it('entra con el PIN correcto y /me devuelve el usuario', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const agent = request.agent(app);

    const login = await agent
      .post('/api/auth/login/pin')
      .send({ username: 'LUIS', pin: '1234' })
      .expect(200);
    expect(login.body.user).toMatchObject({ username: 'luis', role: 'SELLER' });
    expect(login.headers['set-cookie']?.[0]).toMatch(/sanfefer_session=.*HttpOnly/);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.username).toBe('luis');
  });

  it('rechaza un PIN con formato inválido con mensaje en español', async () => {
    const res = await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'luis', pin: '12' })
      .expect(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'El PIN debe tener de 4 a 6 dígitos',
    });
    expect(res.body.error.fields.pin).toBeDefined();
  });

  it('avisa los intentos restantes y bloquea al quinto fallo', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const attempt = () =>
      request(app).post('/api/auth/login/pin').send({ username: 'luis', pin: '0000' });

    const first = await attempt().expect(401);
    expect(first.body.error.message).toBe('PIN incorrecto. Te quedan 4 intentos.');
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const locked = await attempt().expect(423);
    expect(locked.body.error.code).toBe('USER_LOCKED');

    // Bloqueado: ni el PIN correcto entra.
    await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'luis', pin: '1234' })
      .expect(423);
  });

  it('no deja entrar a un usuario desactivado', async () => {
    await createUser({ username: 'luis', pin: '1234', active: false });
    await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'luis', pin: '1234' })
      .expect(401);
  });

  it('lista solo usuarios activos con PIN para la pantalla de ingreso', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    await createUser({ username: 'inactivo', pin: '1234', active: false });
    await createUser({ username: 'jefa', role: 'ADMIN', password: 'Sanfefer2026' });
    const res = await request(app).get('/api/auth/login-users').expect(200);
    expect(res.body.users.map((u: { username: string }) => u.username)).toEqual(['luis']);
    expect(res.body.users[0].initials).toBe('LU');
  });
});

describe('ingreso con contraseña', () => {
  it('solo acepta administradores', async () => {
    await createUser({ username: 'jefa', role: 'ADMIN', password: 'Sanfefer2026' });
    await request(app)
      .post('/api/auth/login/password')
      .send({ username: 'jefa', password: 'Sanfefer2026' })
      .expect(200);
    const bad = await request(app)
      .post('/api/auth/login/password')
      .send({ username: 'jefa', password: 'otra-cosa' })
      .expect(401);
    expect(bad.body.error.message).toBe('Contraseña incorrecta. Te quedan 4 intentos.');
  });
});

describe('sesión', () => {
  it('sin cookie responde 401', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    expect(res.body.error.message).toBe('Tu sesión expiró. Vuelve a ingresar.');
  });

  it('cerrar sesión borra la cookie', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('una ruta inexistente responde 404 en español', async () => {
    const res = await request(app).get('/api/no-existe').expect(404);
    expect(res.body.error.message).toBe('La ruta GET /api/no-existe no existe.');
  });

  it('JSON mal formado responde 400', async () => {
    const res = await request(app)
      .post('/api/auth/login/pin')
      .set('Content-Type', 'application/json')
      .send('{"username": ')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
