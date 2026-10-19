import { beforeEach, describe, expect, it, vi } from 'vitest';

// zustand/persist necesita localStorage; en Node se usa uno en memoria.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { cartTotals, useCart } = await import('./cart');

const line = {
  productId: 1,
  name: 'Michelada',
  unitPrice: 38,
  quantity: 1,
  note: '',
  modifierOptionIds: [2, 5],
  modifiersLabel: 'Gallo · Tajín',
};

describe('carrito por cuenta', () => {
  beforeEach(() => useCart.setState({ carts: {} }));

  it('suma cantidades cuando el producto, los extras y la nota son iguales', () => {
    useCart.getState().add(7, line);
    useCart.getState().add(7, { ...line, modifierOptionIds: [5, 2] });
    useCart.getState().add(7, { ...line, note: 'Sin hielo' });
    const lines = useCart.getState().carts[7]!;
    expect(lines.map((l) => l.quantity)).toEqual([2, 1]);
    expect(cartTotals(lines)).toEqual({ units: 3, total: 114 });
  });

  it('quitar con cantidad 0 elimina la línea y cada cuenta tiene su carrito', () => {
    useCart.getState().add(7, line);
    useCart.getState().add(8, line);
    const key = useCart.getState().carts[7]![0]!.key;
    useCart.getState().setQuantity(7, key, 0);
    expect(useCart.getState().carts[7]).toEqual([]);
    expect(useCart.getState().carts[8]).toHaveLength(1);
  });
});
