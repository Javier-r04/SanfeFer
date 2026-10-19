import { describe, expect, it } from 'vitest';
import { createUserSchema } from './users';

describe('createUserSchema', () => {
  it('exige PIN al vendedor', () => {
    const r = createUserSchema.safeParse({ name: 'Luis', username: 'luis', role: 'SELLER' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('El vendedor necesita un PIN para entrar');
  });

  it('rechaza PIN con letras o de largo inválido', () => {
    for (const pin of ['12a4', '123', '1234567']) {
      const r = createUserSchema.safeParse({ name: 'Luis', username: 'luis', role: 'SELLER', pin });
      expect(r.success).toBe(false);
    }
  });

  it('normaliza el usuario a minúsculas', () => {
    const r = createUserSchema.parse({
      name: 'Ana',
      username: '  ANA.M ',
      role: 'SELLER',
      pin: '1234',
    });
    expect(r.username).toBe('ana.m');
  });

  it('exige contraseña al administrador', () => {
    const r = createUserSchema.safeParse({
      name: 'Fer',
      username: 'fer',
      role: 'ADMIN',
      pin: '1234',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['password']);
  });
});
