import { fromCents, toCents } from '../tab-totals';

/** Contenido de un ticket, independiente de cómo se imprima (HTML o ESC/POS). */
export interface TicketDocument {
  kind: 'PRECUENTA' | 'COMPROBANTE' | 'CIERRE';
  /** Título del cierre (p. ej. "CIERRE DE CAJA #12"); solo para kind CIERRE. */
  title?: string;
  businessName: string;
  headerLines: string[];
  meta: [string, string][];
  items: { quantity: number; name: string; details: string[]; amount: number }[];
  totals: { label: string; amount: number; strong?: boolean }[];
  payments: { label: string; amount: number }[];
  footer: string[];
}

export type TicketLine =
  | {
      kind: 'text';
      text: string;
      align?: 'left' | 'center';
      bold?: boolean;
      size?: 'normal' | 'large';
    }
  | { kind: 'rule' }
  | { kind: 'feed' };

/** Columnas de texto según el ancho del papel. */
export const columnsFor = (paperWidth: 58 | 80) => (paperWidth === 58 ? 32 : 48);

const money = (n: number) => fromCents(toCents(n)).toFixed(2);

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word.slice(0, width);
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word.slice(0, width);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** "Texto ...... valor" ajustado al ancho. */
function row(left: string, right: string, width: number): string[] {
  const space = width - right.length - 1;
  const lines = wrap(left, Math.max(8, space));
  const last = lines.pop()!;
  return [
    ...lines,
    `${last}${' '.repeat(Math.max(1, width - last.length - right.length))}${right}`,
  ];
}

/** Convierte el documento en líneas de texto fijo: la vista previa y la impresora usan exactamente lo mismo. */
export function layoutTicket(doc: TicketDocument, columns: number): TicketLine[] {
  const out: TicketLine[] = [];
  const text = (
    t: string,
    opts: Omit<Extract<TicketLine, { kind: 'text' }>, 'kind' | 'text'> = {},
  ) => out.push({ kind: 'text', text: t, ...opts });

  for (const l of wrap(doc.businessName.toUpperCase(), Math.floor(columns / 2)))
    text(l, { align: 'center', bold: true, size: 'large' });
  for (const h of doc.headerLines) for (const l of wrap(h, columns)) text(l, { align: 'center' });
  out.push({ kind: 'rule' });
  if (doc.kind === 'CIERRE') {
    text(doc.title ?? 'CIERRE', { align: 'center', bold: true });
  } else {
    text(doc.kind === 'PRECUENTA' ? 'PRE-CUENTA' : 'COMPROBANTE INTERNO', {
      align: 'center',
      bold: true,
    });
    text('NO ES FACTURA', { align: 'center', bold: true });
  }
  out.push({ kind: 'rule' });
  for (const [label, value] of doc.meta) for (const l of row(label, value, columns)) text(l);
  if (doc.items.length) out.push({ kind: 'rule' });
  for (const item of doc.items) {
    for (const l of row(`${item.quantity} ${item.name}`, money(item.amount), columns)) text(l);
    for (const d of item.details) for (const l of wrap(d, columns - 2)) text(`  ${l}`);
  }
  out.push({ kind: 'rule' });
  for (const t of doc.totals) {
    if (t.strong)
      for (const l of row(`${t.label} Q`, money(t.amount), Math.floor(columns / 2)))
        text(l, { bold: true, size: 'large' });
    else for (const l of row(t.label, money(t.amount), columns)) text(l);
  }
  if (doc.payments.length) {
    out.push({ kind: 'rule' });
    for (const p of doc.payments) for (const l of row(p.label, money(p.amount), columns)) text(l);
  }
  if (doc.footer.length) {
    out.push({ kind: 'rule' });
    for (const f of doc.footer) for (const l of wrap(f, columns)) text(l, { align: 'center' });
  }
  out.push({ kind: 'feed' });
  return out;
}
