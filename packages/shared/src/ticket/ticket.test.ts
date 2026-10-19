import { describe, expect, it } from 'vitest';
import { layoutTicket, type TicketDocument } from './document';
import { encodeEscPos, encodeText } from './escpos';

const doc: TicketDocument = {
  kind: 'COMPROBANTE',
  businessName: 'SanfeFer',
  headerLines: ['Zona 1, Guatemala'],
  meta: [
    ['Folio', '#542'],
    ['Mesa', 'Mesa 4 · Andrea'],
  ],
  items: [{ quantity: 1, name: 'Michelada clásica', details: ['+ Corona, Tajín'], amount: 43 }],
  totals: [
    { label: 'Subtotal', amount: 43 },
    { label: 'TOTAL', amount: 43, strong: true },
  ],
  payments: [{ label: 'Efectivo', amount: 50 }],
  footer: ['¡Gracias por su visita!'],
};

describe('layoutTicket', () => {
  it('ninguna línea pasa del ancho del papel', () => {
    for (const cols of [32, 48]) {
      const lines = layoutTicket(doc, cols);
      for (const l of lines) if (l.kind === 'text') expect(l.text.length).toBeLessThanOrEqual(cols);
    }
  });

  it('alinea el monto a la derecha y marca que no es factura', () => {
    const texts = layoutTicket(doc, 32).flatMap((l) => (l.kind === 'text' ? [l.text] : []));
    expect(texts).toContain('NO ES FACTURA');
    expect(texts).toContain('1 Michelada clásica        43.00');
  });
});

describe('encodeEscPos', () => {
  it('codifica tildes y eñes en PC858', () => {
    expect(encodeText('Limón ñ ¡')).toEqual([76, 105, 109, 0xa2, 110, 32, 0xa4, 32, 0xad]);
  });

  it('inicia la impresora y termina con corte de papel', () => {
    const bytes = encodeEscPos(layoutTicket(doc, 32), 32);
    expect([...bytes.slice(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 19]);
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
});
