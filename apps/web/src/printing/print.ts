import {
  columnsFor,
  encodeEscPos,
  layoutTicket,
  type TicketDocument,
  type TicketLine,
} from '@sanfefer/shared';

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

/** Descarga los bytes ESC/POS (útil para probar con utilidades de la impresora). */
export function downloadEscPos(doc: TicketDocument, paperWidth: 58 | 80, name: string) {
  const blob = new Blob([escPosBytes(doc, paperWidth)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.bin` });
  a.click();
  URL.revokeObjectURL(url);
}
