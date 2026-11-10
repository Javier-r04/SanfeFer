import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminAgent, app, createUser, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('mesas', () => {
  it('solo el administrador las configura', async () => {
    await createUser({ username: 'luis', pin: '1234' });
    const seller = request.agent(app);
    await seller.post('/api/auth/login/pin').send({ username: 'luis', pin: '1234' }).expect(200);
    await seller.get('/api/tables').expect(403);
    await seller.post('/api/tables').send({ name: 'Mesa 1' }).expect(403);
  });

  it('crea, renombra, ordena y aparecen en el POS por zona', async () => {
    const admin = await adminAgent();
    const a = (await admin.post('/api/tables').send({ name: 'Mesa 1', zone: 'Salón' }).expect(201))
      .body.table;
    const b = (await admin.post('/api/tables').send({ name: ' Barra 1 ', zone: '' }).expect(201))
      .body.table;
    expect(a).toMatchObject({ name: 'Mesa 1', zone: 'Salón', active: true, openTabs: 0 });
    expect(b).toMatchObject({ name: 'Barra 1', zone: null, sortOrder: a.sortOrder + 1 });

    await admin.patch(`/api/tables/${b.id}`).send({ zone: 'Barra' }).expect(200);
    const reordered = (
      await admin
        .post('/api/tables/reorder')
        .send({ ids: [b.id, a.id] })
        .expect(200)
    ).body.tables;
    expect(reordered.map((t: { name: string }) => t.name)).toEqual(['Barra 1', 'Mesa 1']);

    const floor = (await admin.get('/api/pos/floor').expect(200)).body;
    expect(floor.tables.map((t: { name: string; zone: string }) => [t.name, t.zone])).toEqual([
      ['Barra 1', 'Barra'],
      ['Mesa 1', 'Salón'],
    ]);
  });

  it('no permite nombres repetidos (sin importar mayúsculas)', async () => {
    const admin = await adminAgent();
    await admin.post('/api/tables').send({ name: 'Mesa 1' }).expect(201);
    const dup = await admin.post('/api/tables').send({ name: 'mesa 1' }).expect(409);
    expect(dup.body.error).toMatchObject({
      message: 'Ya existe una mesa llamada Mesa 1.',
      fields: { name: 'Ya existe una mesa con ese nombre' },
    });
    const empty = await admin.post('/api/tables').send({ name: '  ' }).expect(400);
    expect(empty.body.error.fields.name).toBe('El nombre es obligatorio');
  });

  it('agrega varias de una vez y salta las que ya existen', async () => {
    const admin = await adminAgent();
    await admin.post('/api/tables').send({ name: 'Mesa 2' }).expect(201);
    const res = await admin
      .post('/api/tables/bulk')
      .send({ prefix: 'Mesa', start: 1, count: 4, zone: 'Salón' })
      .expect(201);
    expect(res.body).toEqual({ created: ['Mesa 1', 'Mesa 3', 'Mesa 4'], skipped: ['Mesa 2'] });
    const all = (await admin.get('/api/tables').expect(200)).body.tables;
    expect(all.map((t: { name: string }) => t.name)).toEqual([
      'Mesa 2',
      'Mesa 1',
      'Mesa 3',
      'Mesa 4',
    ]);
    const tooMany = await admin
      .post('/api/tables/bulk')
      .send({ prefix: 'Mesa', start: 1, count: 80 })
      .expect(400);
    expect(tooMany.body.error.fields.count).toBe('Máximo 50 mesas a la vez');
  });

  it('no desactiva una mesa con cuentas abiertas ni borra una con historial', async () => {
    const admin = await adminAgent();
    const table = (await admin.post('/api/tables').send({ name: 'Mesa 5' }).expect(201)).body.table;
    const tab = (await admin.post('/api/pos/tabs').send({ tableId: table.id }).expect(201)).body
      .tab;

    const busy = await admin.patch(`/api/tables/${table.id}`).send({ active: false }).expect(409);
    expect(busy.body.error.message).toMatch(/^Mesa 5 tiene 1 cuenta abierta/);
    expect((await admin.get('/api/tables').expect(200)).body.tables[0]).toMatchObject({
      openTabs: 1,
      hasHistory: true,
    });

    await admin
      .post(`/api/pos/tabs/${tab.id}/cancel`)
      .send({ reason: 'Se fue el cliente' })
      .expect(204);
    const kept = await admin.delete(`/api/tables/${table.id}`).expect(409);
    expect(kept.body.error.message).toMatch(/no se puede borrar\. Desactívala/);
    await admin.patch(`/api/tables/${table.id}`).send({ active: false }).expect(200);
    expect((await admin.get('/api/pos/floor').expect(200)).body.tables).toEqual([]);

    const unused = (await admin.post('/api/tables').send({ name: 'Mesa 6' }).expect(201)).body
      .table;
    await admin.delete(`/api/tables/${unused.id}`).expect(204);
  });
});
