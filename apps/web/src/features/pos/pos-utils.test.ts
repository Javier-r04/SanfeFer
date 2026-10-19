import type { BarOrderDto } from '@sanfefer/shared';
import { describe, expect, it } from 'vitest';
import { barColumn, timeAgo } from './pos-utils';

describe('timeAgo', () => {
  const now = Date.parse('2026-10-18T22:00:00Z');
  it('describe el tiempo transcurrido', () => {
    expect(timeAgo('2026-10-18T21:59:40Z', now)).toBe('ahora');
    expect(timeAgo('2026-10-18T21:55:00Z', now)).toBe('hace 5 min');
    expect(timeAgo('2026-10-18T20:50:00Z', now)).toBe('hace 1 h 10 min');
    expect(timeAgo('2026-10-18T20:00:00Z', now)).toBe('hace 2 h');
  });
});

describe('barColumn', () => {
  const order = (statuses: string[]) =>
    ({ items: statuses.map((status) => ({ status })) }) as unknown as BarOrderDto;
  it('ubica la comanda según lo menos avanzado', () => {
    expect(barColumn(order(['DELIVERED', 'PENDING']))).toBe('PENDING');
    expect(barColumn(order(['PREPARING', 'DELIVERED']))).toBe('PREPARING');
    expect(barColumn(order(['DELIVERED']))).toBe('DELIVERED');
  });
});
