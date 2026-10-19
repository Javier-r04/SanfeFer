import { describe, expect, it } from 'vitest';
import { getBusinessDate } from '../business-date';
import { purchaseInputSchema, supplierInputSchema, unitCostFromLine } from './purchases';

const base = {
  supplierId: 1,
  purchasedAt: '2026-10-15',
  items: [{ inventoryItemId: 1, quantity: 24, lineTotal: 180 }],
};

describe('purchaseInputSchema', () => {
  it('acepta una compra válida y normaliza textos vacíos', () => {
    expect(purchaseInputSchema.parse({ ...base, invoiceNumber: '  ', notes: '' })).toMatchObject({
      invoiceNumber: null,
      notes: null,
    });
  });

  it('rechaza fechas futuras', () => {
    const tomorrow = new Date(Date.now() + 2 * 86400000);
    const r = purchaseInputSchema.safeParse({ ...base, purchasedAt: getBusinessDate(tomorrow) });
    expect(r.error?.issues[0]?.message).toBe('La fecha de la compra no puede ser futura');
  });

  it('exige al menos una línea y no repetir artículos', () => {
    expect(purchaseInputSchema.safeParse({ ...base, items: [] }).error?.issues[0]?.message).toBe(
      'Agrega al menos un artículo',
    );
    const dup = purchaseInputSchema.safeParse({ ...base, items: [base.items[0], base.items[0]] });
    expect(dup.error?.issues[0]?.path).toEqual(['items', 1, 'inventoryItemId']);
  });
});

describe('supplierInputSchema', () => {
  it('valida correo y teléfono', () => {
    const r = supplierInputSchema.safeParse({
      name: 'Proveedor',
      email: 'no-es-correo',
      phone: 'abc',
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'El teléfono solo puede tener números, espacios y + ( ) -',
      'El correo no es válido',
    ]);
  });
});

describe('unitCostFromLine', () => {
  it('deriva el costo por unidad con 4 decimales', () => {
    expect(unitCostFromLine(180, 24)).toBe(7.5);
    expect(unitCostFromLine(90, 3785)).toBe(0.0238);
    expect(unitCostFromLine(10, 0)).toBe(0);
  });
});
