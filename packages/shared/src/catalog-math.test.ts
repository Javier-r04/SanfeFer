import { describe, expect, it } from 'vitest';
import { marginOf, requiredExtrasBase } from './catalog-math';

const beer = {
  active: true,
  minSelect: 1,
  options: [
    { active: true, priceDelta: 5, cost: 11 },
    { active: true, priceDelta: 0, cost: 7.5 },
    { active: false, priceDelta: 0, cost: 1 },
  ],
};
const rim = { active: true, minSelect: 0, options: [{ active: true, priceDelta: 3, cost: 0.9 }] };

describe('requiredExtrasBase', () => {
  it('suma la opción más barata de cada grupo obligatorio e ignora los opcionales', () => {
    expect(requiredExtrasBase([beer, rim])).toEqual({ priceDelta: 0, cost: 7.5 });
  });

  it('ignora grupos inactivos', () => {
    expect(requiredExtrasBase([{ ...beer, active: false }])).toEqual({ priceDelta: 0, cost: 0 });
  });
});

describe('marginOf', () => {
  it('calcula el margen sobre el precio', () => {
    expect(marginOf(35, 10)).toBeCloseTo(25 / 35);
    expect(marginOf(0, 1)).toBeNull();
  });
});
