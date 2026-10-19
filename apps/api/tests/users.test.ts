import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('permisos', () => {
  it('un vendedor no puede administrar usuarios', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    const res = await agent.get('/api/users').expect(403);
    expect(res.body.error.message).toBe('Esta sección es solo para administradores.');
  });
});

describe('CRUD de usuarios', () => {
  it('crea un vendedor que luego puede entrar con su PIN', async () => {
    const admin = await adminAgent();
    const res = await admin
      .post('/api/users')
      .send({
        name: 'Ana Morales',
        username: 'Ana',
        role: 'SELLER',
        pin: '2345',
        password: 'ignorada-123',
      })
      .expect(201);
    expect(res.body.user).toMatchObject({
      username: 'ana',
      hasPin: true,
      hasPassword: false,
      active: true,
    });
    expect(res.body.user.pinHash).toBeUndefined();

    await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'ana', pin: '2345' })
      .expect(200);
  });

  it('rechaza un usuario repetido con 409', async () => {
    const admin = await adminAgent();
    await admin
      .post('/api/users')
      .send({ name: 'Ana', username: 'ana', role: 'SELLER', pin: '2345' })
      .expect(201);
    const dup = await admin
      .post('/api/users')
      .send({ name: 'Otra Ana', username: 'ana', role: 'SELLER', pin: '1111' })
      .expect(409);
    expect(dup.body.error.fields.username).toBe('Ya existe un registro con ese usuario.');
  });

  it('cambiar el PIN cierra las sesiones abiertas del vendedor', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    const seller = request.agent(app);
    await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);

    await admin.patch(`/api/users/${luis.id}`).send({ pin: '5678' }).expect(200);

    await seller.get('/api/auth/me').expect(401);
    await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'luis', pin: '5678' })
      .expect(200);
  });

  it('desactivar a un vendedor le cierra la sesión', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    const seller = request.agent(app);
    await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    await admin.patch(`/api/users/${luis.id}`).send({ active: false }).expect(200);
    await seller.get('/api/auth/me').expect(401);
  });

  it('el admin no puede desactivarse ni quitarse el rol a sí mismo', async () => {
    const admin = await adminAgent();
    const me = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    const r1 = await admin.patch(`/api/users/${me.id}`).send({ active: false }).expect(409);
    expect(r1.body.error.message).toBe('No puedes desactivar tu propio usuario.');
    await admin.patch(`/api/users/${me.id}`).send({ role: 'SELLER', pin: '1234' }).expect(409);
  });

  it('el admin que cambia su propia contraseña sigue con sesión', async () => {
    const admin = await adminAgent();
    const me = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    await admin.patch(`/api/users/${me.id}`).send({ password: 'NuevaClave2026' }).expect(200);
    await admin.get('/api/auth/me').expect(200);
  });

  it('no permite quitarle el PIN a un vendedor', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    const res = await admin.patch(`/api/users/${luis.id}`).send({ pin: null }).expect(400);
    expect(res.body.error.fields.pin).toBe('El vendedor necesita un PIN para entrar');
  });

  it('convertir un vendedor en admin exige contraseña', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    await admin.patch(`/api/users/${luis.id}`).send({ role: 'ADMIN' }).expect(400);
    const ok = await admin
      .patch(`/api/users/${luis.id}`)
      .send({ role: 'ADMIN', password: 'ClaveLuis2026' })
      .expect(200);
    expect(ok.body.user).toMatchObject({ role: 'ADMIN', hasPassword: true, hasPin: true });
  });

  it('desbloquea un usuario bloqueado', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    await prisma.user.update({
      where: { id: luis.id },
      data: { lockedUntil: new Date(Date.now() + 60000) },
    });
    const list = await admin.get('/api/users').expect(200);
    expect(
      list.body.users.find((u: { id: number }) => u.id === luis.id).lockedUntil,
    ).not.toBeNull();
    await admin.post(`/api/users/${luis.id}/unlock`).expect(200);
    await request(app)
      .post('/api/auth/login/pin')
      .send({ username: 'luis', pin: '1234' })
      .expect(200);
  });

  it('elimina un usuario sin historial y valida el id', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    await admin.delete(`/api/users/${luis.id}`).expect(204);
    await admin.delete(`/api/users/${luis.id}`).expect(404);
    const bad = await admin.delete('/api/users/abc').expect(400);
    expect(bad.body.error.message).toBe('El identificador no es válido');
  });

  it('no elimina un usuario con historial', async () => {
    const admin = await adminAgent();
    const luis = await createUser({ username: 'luis', pin: '1234' });
    const item = await prisma.inventoryItem.create({
      data: { name: 'Limón', kind: 'SUPPLY', unit: 'UNIT' },
    });
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: 'MANUAL_IN',
        quantity: 1,
        stockAfter: 1,
        userId: luis.id,
      },
    });
    const res = await admin.delete(`/api/users/${luis.id}`).expect(409);
    expect(res.body.error.message).toMatch(/Desactívalo en lugar de eliminarlo/);
  });
});
