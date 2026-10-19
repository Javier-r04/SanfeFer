import { describe, expect, it } from 'vitest';
import { modifierGroupInputSchema, productInputSchema, productUpdateSchema } from './catalog';
import { movementInputSchema } from './inventory';

describe('productInputSchema', () => {
  const base = { name: 'Michelada', categoryId: 1, price: 35 };

  it('aplica valores por defecto al crear', () => {
    expect(productInputSchema.parse(base)).toMatchObject({
      active: true,
      recipe: [],
      modifierGroupIds: [],
    });
  });

  it('rechaza precios con más de 2 decimales y vacíos', () => {
    expect(productInputSchema.safeParse({ ...base, price: 35.555 }).error?.issues[0]?.message).toBe(
      'El precio admite máximo 2 decimales',
    );
    expect(
      productInputSchema.safeParse({ ...base, price: Number.NaN }).error?.issues[0]?.message,
    ).toBe('El precio: escribe un número');
  });

  it('rechaza insumos repetidos en la receta', () => {
    const r = productInputSchema.safeParse({
      ...base,
      recipe: [
        { inventoryItemId: 3, quantity: 1 },
        { inventoryItemId: 3, quantity: 2 },
      ],
    });
    expect(r.error?.issues[0]?.path).toEqual(['recipe', 1, 'inventoryItemId']);
  });

  it('al editar no rellena la receta con valores por defecto', () => {
    expect(productUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });
});

describe('modifierGroupInputSchema', () => {
  it('no permite exigir más opciones de las que hay', () => {
    const r = modifierGroupInputSchema.safeParse({
      name: 'Cerveza',
      minSelect: 2,
      maxSelect: 2,
      options: [{ name: 'Gallo', priceDelta: 0 }],
    });
    expect(r.error?.issues[0]?.message).toBe('Hay 1 opciones activas; no se pueden exigir 2');
  });

  it('detecta opciones con el mismo nombre', () => {
    const r = modifierGroupInputSchema.safeParse({
      name: 'Escarchado',
      minSelect: 0,
      maxSelect: 1,
      options: [
        { name: 'Tajín', priceDelta: 3 },
        { name: 'tajín ', priceDelta: 3 },
      ],
    });
    expect(r.error?.issues[0]?.path).toEqual(['options', 1, 'name']);
  });
});

describe('movementInputSchema', () => {
  it('la merma exige motivo', () => {
    const r = movementInputSchema.safeParse({ type: 'WASTE', quantity: 2, reason: '' });
    expect(r.error?.issues[0]?.message).toMatch(/motivo/);
  });

  it('el ajuste usa el conteo físico', () => {
    expect(movementInputSchema.parse({ type: 'ADJUSTMENT', countedStock: 0 })).toEqual({
      type: 'ADJUSTMENT',
      countedStock: 0,
    });
  });
});
