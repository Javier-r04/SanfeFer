import {
  columnsFor,
  encodeEscPos,
  layoutTicket,
  type TicketDocument,
  type TicketLine,
} from '@sanfefer/shared';
import { downloadBlob } from '@/lib/download';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML del ticket: las mismas líneas que recibe la impresora térmica, en letra monoespaciada. */
export function ticketHtml(lines: TicketLine[], paperWidth: 58 | 80) {
  const body = lines
    .map((l) => {
      if (l.kind === 'rule') return '<div class="rule"></div>';
      if (l.kind === 'feed') return '<div class="feed"></div>';
      const cls = [
        l.align === 'center' ? 'c' : '',
        l.bold ? 'b' : '',
        l.size === 'large' ? 'l' : '',
      ].join(' ');
      return `<div class="${cls}">${escape(l.text) || '&nbsp;'}</div>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket</title><style>
    @page { size: ${paperWidth}mm auto; margin: 0; }
    body { margin: 0; padding: 3mm; width: ${paperWidth - 6}mm; font: 11px/1.35 ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace; color: #000; }
    div { white-space: pre; }
    .c { text-align: center; } .b { font-weight: 700; } .l { font-size: 15px; }
    .rule { border-top: 1px dashed #000; margin: 3px 0; } .feed { height: 10px; }
  </style></head><body>${body}</body></html>`;
}

/** Imprime con el diálogo del navegador (impresora normal o térmica instalada en la PC). */
export function printInBrowser(doc: TicketDocument, paperWidth: 58 | 80) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentDocument!;
  frameDoc.open();
  frameDoc.write(ticketHtml(layoutTicket(doc, columnsFor(paperWidth)), paperWidth));
  frameDoc.close();
  iframe.contentWindow!.focus();
  iframe.contentWindow!.print();
  setTimeout(() => iframe.remove(), 1000);
}

// ───── PDF (descargable) ─────

const PT_PER_MM = 72 / 25.4;
/** Ancho de un carácter de Courier respecto al tamaño de la letra. */
const COURIER_ADVANCE = 0.6;

/**
 * Arma el PDF del ticket con las mismas líneas que la vista previa y la impresora, en Courier,
 * sobre una hoja del ancho del papel (58 u 80 mm) y del largo exacto del ticket.
 */
export async function ticketPdf(doc: TicketDocument, paperWidth: 58 | 80): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const columns = columnsFor(paperWidth);
  const lines = layoutTicket(doc, columns);
  const margin = 4; // mm
  const usable = paperWidth - margin * 2;
  // Tamaño de letra para que quepan justo las columnas del ticket.
  const fontPt = (usable * PT_PER_MM) / (columns * COURIER_ADVANCE);
  const lineMm = (pt: number) => (pt * 1.35) / PT_PER_MM;
  const heightOf = (l: TicketLine) =>
    l.kind === 'rule'
      ? 2.5
      : l.kind === 'feed'
        ? 3
        : lineMm(l.kind === 'text' && l.size === 'large' ? fontPt * 2 : fontPt);
  const height = Math.max(
    paperWidth + 1, // jsPDF pone la hoja horizontal si es más ancha que alta
    margin * 2 + lines.reduce((sum, l) => sum + heightOf(l), 0),
  );

  const pdf = new jsPDF({ unit: 'mm', format: [paperWidth, height], orientation: 'portrait' });
  pdf.setProperties({
    title:
      doc.kind === 'PRECUENTA' ? 'Pre-cuenta' : doc.kind === 'CIERRE' ? 'Cierre' : 'Comprobante',
    subject: 'Comprobante interno, no es factura',
    creator: doc.businessName,
  });
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([1, 0.8], 0);

  let y = margin;
  for (const l of lines) {
    const h = heightOf(l);
    if (l.kind === 'rule') {
      pdf.line(margin, y + h / 2, paperWidth - margin, y + h / 2);
    } else if (l.kind === 'text' && l.text) {
      const pt = l.size === 'large' ? fontPt * 2 : fontPt;
      pdf.setFont('courier', l.bold ? 'bold' : 'normal');
      pdf.setFontSize(pt);
      const baseline = y + h * 0.78;
      if (l.align === 'center') pdf.text(l.text, paperWidth / 2, baseline, { align: 'center' });
      else pdf.text(l.text, margin, baseline);
    }
    y += h;
  }
  return pdf.output('blob');
}

/** Descarga el ticket en PDF. */
export async function downloadPdf(doc: TicketDocument, paperWidth: 58 | 80, name: string) {
  downloadBlob(await ticketPdf(doc, paperWidth), `${name}.pdf`);
}

export const escPosBytes = (doc: TicketDocument, paperWidth: 58 | 80) => {
  const columns = columnsFor(paperWidth);
  return encodeEscPos(layoutTicket(doc, columns), columns);
};

// ───── Impresora térmica directa (Web Serial: Chrome/Edge en PC) ─────

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

const serial = () => (navigator as Navigator & { serial?: SerialLike }).serial;

export const canPrintSerial = () => typeof navigator !== 'undefined' && !!serial();

/**
 * Envía el ticket como ESC/POS a una impresora térmica conectada por USB-serie o Bluetooth-serie.
 * El navegador pide elegir el puerto la primera vez.
 */
export async function printSerial(doc: TicketDocument, paperWidth: 58 | 80, baudRate = 9600) {
  const api = serial();
  if (!api)
    throw new Error(
      'Este navegador no permite conectar impresoras directamente. Usa Chrome o Edge en una PC.',
    );
  const port = await api.requestPort();
  await port.open({ baudRate });
  try {
    const writer = port.writable!.getWriter();
    await writer.write(escPosBytes(doc, paperWidth));
    writer.releaseLock();
  } finally {
    await port.close();
  }
}
