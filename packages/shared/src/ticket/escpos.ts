import type { TicketLine } from './document';

/**
 * Codificador ESC/POS mínimo y compatible con la mayoría de impresoras térmicas
 * (Epson, Xprinter, 3nStar…). Usa la página de códigos PC858 para tildes y eñes.
 */
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Caracteres del español en la página de códigos PC850/858. */
const CP858: Record<string, number> = {
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  ü: 0x81,
  Ü: 0x9a,
  Á: 0xb5,
  É: 0x90,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  '¿': 0xa8,
  '¡': 0xad,
  '°': 0xf8,
  '·': 0xfa,
};

export function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) bytes.push(code);
    else bytes.push(CP858[ch] ?? 0x3f); // "?" para lo que la impresora no puede mostrar
  }
  return bytes;
}

export function encodeEscPos(lines: TicketLine[], columns: number): Uint8Array<ArrayBuffer> {
  const out: number[] = [ESC, 0x40, ESC, 0x74, 19]; // inicializar + página de códigos PC858
  for (const line of lines) {
    if (line.kind === 'rule') {
      out.push(ESC, 0x61, 0, ...encodeText('-'.repeat(columns)), LF);
    } else if (line.kind === 'feed') {
      out.push(LF, LF, LF);
    } else {
      out.push(ESC, 0x61, line.align === 'center' ? 1 : 0);
      out.push(ESC, 0x45, line.bold ? 1 : 0);
      out.push(GS, 0x21, line.size === 'large' ? 0x11 : 0x00);
      out.push(...encodeText(line.text), LF);
    }
  }
  out.push(ESC, 0x45, 0, GS, 0x21, 0, GS, 0x56, 0x42, 0x00); // restablecer y corte parcial
  return Uint8Array.from(out);
}
