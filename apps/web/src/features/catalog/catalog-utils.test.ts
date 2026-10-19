import type { InventoryItemDto } from '@sanfefer/shared';
import { describe, expect, it } from 'vitest';
import { moveId, recipeCost, selectionRule } from './catalog-utils';

describe('selectionRule', () => {
  it('describe la regla de selección en español', () => {
    expect(selectionRule(1, 1)).toBe('Obligatorio · elige 1');
    expect(selectionRule(0, 1)).toBe('Opcional · elige 1');
    expect(selectionRule(0, 3)).toBe('Opcional · hasta 3');
    expect(selectionRule(1, 2)).toBe('Obligatorio · elige de 1 a 2');
  });
});

describe('recipeCost', () => {
  const items = [
    { id: 1, averageCost: 0.025 },
    { id: 2, averageCost: 0.5 },
  ] as InventoryItemDto[];

  it('suma cantidad × costo promedio e ignora líneas incompletas', () => {
    expect(
      recipeCost(
        [
          { inventoryItemId: 1, quantity: 240 },
          { inventoryItemId: 2, quantity: 2 },
          { inventoryItemId: 2, quantity: Number.NaN },
          { quantity: 5 },
        ],
        items,
      ),
    ).toBeCloseTo(7);
  });
});

describe('moveId', () => {
  it('intercambia con el vecino y respeta los extremos', () => {
    expect(moveId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 3, 1)).toBeNull();
  });
});
