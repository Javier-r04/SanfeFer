import type { UserDto } from '@sanfefer/shared';
import { describe, expect, it } from 'vitest';
import { emptyUserForm, makeUserFormSchema, toCreatePayload, toUpdatePayload } from './user-form';

const seller: UserDto = {
  id: 2,
  name: 'Luis García',
  username: 'luis',
  role: 'SELLER',
  active: true,
  hasPin: true,
  hasPassword: false,
  lockedUntil: null,
  createdAt: '',
  updatedAt: '',
};

describe('formulario de usuario', () => {
  it('al crear un vendedor exige PIN', () => {
    const r = makeUserFormSchema().safeParse({ ...emptyUserForm(), name: 'Ana', username: 'ana' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['pin']);
  });

  it('al editar, el PIN vacío significa "no cambiar"', () => {
    const values = { ...emptyUserForm(seller), name: 'Luis G.' };
    expect(makeUserFormSchema(seller).safeParse(values).success).toBe(true);
    expect(toUpdatePayload(values, seller)).toEqual({ name: 'Luis G.' });
  });

  it('convertir vendedor en admin exige contraseña y la envía', () => {
    const values = { ...emptyUserForm(seller), role: 'ADMIN' as const };
    expect(makeUserFormSchema(seller).safeParse(values).success).toBe(false);
    const withPassword = { ...values, password: 'ClaveLuis2026' };
    expect(makeUserFormSchema(seller).safeParse(withPassword).success).toBe(true);
    expect(toUpdatePayload(withPassword, seller)).toEqual({
      role: 'ADMIN',
      password: 'ClaveLuis2026',
    });
  });

  it('no envía contraseña al crear un vendedor', () => {
    const payload = toCreatePayload({
      ...emptyUserForm(),
      name: 'Ana',
      username: 'ANA',
      pin: '1234',
      password: 'x',
    });
    expect(payload).toEqual({
      name: 'Ana',
      username: 'ana',
      role: 'SELLER',
      pin: '1234',
      password: undefined,
    });
  });
});
