import type { TicketDocument } from '@sanfefer/shared';
import { describe, expect, it } from 'vitest';
import { ticketPdf } from './print';

const doc: TicketDocument = {
  kind: 'COMPROBANTE',
  businessName: 'SanfeFer',
  headerLines: ['Zona 1, Guatemala'],
  meta: [
    ['Cuenta', '#42'],
    ['Mesa', 'Mesa 3 · Andrea'],
  ],
  items: [{ quantity: 2, name: 'Michelada clásica', details: ['Extra: camarón'], amount: 70 }],
  totals: [
    { label: 'Subtotal', amount: 70 },
    { label: 'TOTAL', amount: 70, strong: true },
  ],
  payments: [{ label: 'Efectivo', amount: 100 }],
  footer: ['¡Gracias por su visita!'],
};

const text = async (blob: Blob) => new TextDecoder('latin1').decode(await blob.arrayBuffer());

describe('ticket en PDF', () => {
  it('genera un PDF del ancho del papel con el contenido del ticket', async () => {
    const pdf = await text(await ticketPdf(doc, 80));
    expect(pdf.startsWith('%PDF-')).toBe(true);
    // 80 mm = 226.77 pt de ancho.
    expect(pdf).toMatch(/\/MediaBox \[0 0 226\.77/);
    for (const s of [
      'COMPROBANTE INTERNO',
      'NO ES FACTURA',
      'Michelada clásica',
      '¡Gracias por su visita!',
      '70.00',
    ]) {
      expect(pdf).toContain(s);
    }
  });

  it('respeta el papel de 58 mm', async () => {
    const pdf = await text(await ticketPdf(doc, 58));
    expect(pdf).toMatch(/\/MediaBox \[0 0 164\.4/);
  });
});
