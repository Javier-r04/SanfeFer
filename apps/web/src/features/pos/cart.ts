import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  key: string;
  productId: number;
  name: string;
  /** Precio por unidad con extras. */
  unitPrice: number;
  quantity: number;
  note: string;
  modifierOptionIds: number[];
  /** Texto de los extras para mostrar ("Corona · Tajín"). */
  modifiersLabel: string;
}

interface CartState {
  carts: Record<number, CartLine[]>;
  add: (tabId: number, line: Omit<CartLine, 'key'>) => void;
  setQuantity: (tabId: number, key: string, quantity: number) => void;
  setNote: (tabId: number, key: string, note: string) => void;
  remove: (tabId: number, key: string) => void;
  clear: (tabId: number) => void;
}

const sameLine = (a: Omit<CartLine, 'key'>, b: CartLine) =>
  a.productId === b.productId &&
  a.note === b.note &&
  a.modifierOptionIds.length === b.modifierOptionIds.length &&
  a.modifierOptionIds.every((id) => b.modifierOptionIds.includes(id));

/**
 * Orden en curso de cada cuenta, guardada en el dispositivo: si el celular se bloquea
 * o se recarga la página, lo tomado no se pierde.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => {
      const update = (tabId: number, fn: (lines: CartLine[]) => CartLine[]) =>
        set({ carts: { ...get().carts, [tabId]: fn(get().carts[tabId] ?? []) } });
      return {
        carts: {},
        add: (tabId, line) =>
          update(tabId, (lines) => {
            const existing = lines.find((l) => sameLine(line, l));
            if (existing)
              return lines.map((l) =>
                l === existing ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l,
              );
            return [...lines, { ...line, key: crypto.randomUUID() }];
          }),
        setQuantity: (tabId, key, quantity) =>
          update(tabId, (lines) =>
            quantity <= 0
              ? lines.filter((l) => l.key !== key)
              : lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, quantity) } : l)),
          ),
        setNote: (tabId, key, note) =>
          update(tabId, (lines) => lines.map((l) => (l.key === key ? { ...l, note } : l))),
        remove: (tabId, key) => update(tabId, (lines) => lines.filter((l) => l.key !== key)),
        clear: (tabId) => {
          const carts = { ...get().carts };
          delete carts[tabId];
          set({ carts });
        },
      };
    },
    { name: 'sanfefer-carts' },
  ),
);

const EMPTY: CartLine[] = [];
export const useTabCart = (tabId: number) => useCart((s) => s.carts[tabId] ?? EMPTY);

export const cartTotals = (lines: CartLine[]) => ({
  units: lines.reduce((s, l) => s + l.quantity, 0),
  total: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
});
