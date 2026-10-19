import { describe, expect, it } from 'vitest';
import { validateModifierSelection } from '../catalog-math';
import { cancelItemSchema, openTabSchema, sendOrderSchema } from './pos';

describe('openTabSchema', () => {
  it('sin mesa exige nombre; con mesa no', () => {
    expect(openTabSchema.safeParse({}).error?.issues[0]?.message).toBe(
      'Escribe el nombre del cliente',
    );
    expect(openTabSchema.parse({ tableId: 3 })).toEqual({ tableId: 3 });
    expect(openTabSchema.parse({ customerName: ' Karla ' })).toEqual({
      tableId: null,
      customerName: 'Karla',
    });
  });
});

describe('sendOrderSchema', () => {
  it('rechaza órdenes vacías y cantidades inválidas', () => {
    expect(sendOrderSchema.safeParse({ items: [] }).error?.issues[0]?.message).toBe(
      'La orden está vacía',
    );
    const r = sendOrderSchema.safeParse({ items: [{ productId: 1, quantity: 0 }] });
    expect(r.error?.issues[0]?.message).toBe('La cantidad mínima es 1');
  });
});

describe('cancelItemSchema', () => {
  it('exige motivo', () => {
    expect(cancelItemSchema.safeParse({ reason: '' }).success).toBe(false);
  });
});

describe('validateModifierSelection', () => {
  const groups = [
    { id: 1, name: 'Cerveza', minSelect: 1, maxSelect: 1, options: [{ id: 10 }, { id: 11 }] },
    {
      id: 2,
      name: 'Extras',
      minSelect: 0,
      maxSelect: 2,
      options: [{ id: 20 }, { id: 21 }, { id: 22 }],
    },
  ];

  it('detecta grupos obligatorios sin elegir y excesos', () => {
    expect(validateModifierSelection(groups, [20, 21, 22]).errors).toEqual({
      1: 'Elige una opción de Cerveza',
      2: 'Máximo 2 opciones de Extras',
    });
  });

  it('acepta una selección válida y reporta opciones ajenas', () => {
    const r = validateModifierSelection(groups, [10, 20, 99]);
    expect(r.errors).toEqual({});
    expect(r.unknown).toEqual([99]);
  });
});
