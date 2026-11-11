import { describe, expect, it } from 'vitest';
import { reportPdf } from './pdf-export';

const text = async (blob: Blob) => new TextDecoder('latin1').decode(await blob.arrayBuffer());

describe('reportes en PDF', () => {
  it('arma un PDF con título, periodo, cifras clave y tablas', async () => {
    const pdf = await text(
      await reportPdf({
        title: 'Balance de compras y ventas',
        range: { from: '2026-11-01', to: '2026-11-10' },
        summary: [
          ['Total vendido', 'Q 1,250.00'],
          ['Total comprado', 'Q 980.50'],
        ],
        tables: [
          {
            title: 'Compras por proveedor',
            head: ['Proveedor', 'Compras', 'Total'],
            numeric: [1, 2],
            rows: [['Cervecería Centro Americana', 2, 'Q 980.50']],
            foot: ['Total', 2, 'Q 980.50'],
          },
        ],
      }),
    );
    expect(pdf.startsWith('%PDF-')).toBe(true);
    for (const s of [
      'Balance de compras y ventas',
      'Total vendido',
      'Q 980.50',
      'Cervecería Centro Americana',
      'Página 1 de 1',
    ]) {
      expect(pdf).toContain(s);
    }
  });

  it('pagina las tablas largas', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Producto ${i + 1}`, i]);
    const pdf = await text(
      await reportPdf({
        title: 'Reporte de productos',
        range: { from: '2026-11-10', to: '2026-11-10' },
        tables: [{ head: ['Producto', 'Unidades'], rows, numeric: [1] }],
      }),
    );
    expect(pdf).toMatch(/Página 1 de [2-9]/);
    expect(pdf).toContain('Producto 120');
  });
});
