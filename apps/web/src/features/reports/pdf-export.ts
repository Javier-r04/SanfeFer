import { downloadBlob } from '@/lib/download';
import { formatDateTime } from '@/lib/format';
import type { ReportRange } from './api';
import { rangeLabel } from './report-format';

/** Una tabla del reporte. Las columnas en `numeric` se alinean a la derecha. */
export interface PdfTable {
  title?: string;
  head: string[];
  rows: (string | number)[][];
  numeric?: number[];
  /** Fila de totales al pie. */
  foot?: (string | number)[];
}

export interface PdfReport {
  /** Ej. "Resumen de ventas". */
  title: string;
  range: ReportRange;
  /** Cifras clave arriba del reporte (etiqueta, valor). */
  summary?: [string, string][];
  tables: PdfTable[];
  /** Nota al pie del contenido (criterio de los datos). */
  note?: string;
  /** Hoja horizontal para tablas anchas. */
  landscape?: boolean;
}

const PRIMARY: [number, number, number] = [63, 115, 96];
const MUTED: [number, number, number] = [94, 90, 82];
const TEXT: [number, number, number] = [35, 39, 43];
const STRIPE: [number, number, number] = [246, 243, 236];

/** Las fuentes estándar del PDF no traen los espacios finos que usa Intl. */
const clean = (v: string | number) =>
  String(v)
    .replace(/[\u202f\u2009\u00a0]/g, ' ')
    .replace(/\u2212/g, '-');

/** Arma el PDF del reporte: encabezado, cifras clave y tablas paginadas. */
export async function reportPdf(report: PdfReport): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: report.landscape ? 'landscape' : 'portrait',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.setProperties({ title: `${report.title} · SanfeFer`, creator: 'SanfeFer' });

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.text('SANFEFER', margin, 16);
  doc.setFontSize(18);
  doc.setTextColor(...TEXT);
  doc.text(clean(report.title), margin, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(clean(`Periodo: ${rangeLabel(report.range.from, report.range.to)}`), margin, 30);
  doc.text(clean(`Generado: ${formatDateTime(new Date())}`), pageWidth - margin, 30, {
    align: 'right',
  });
  let y = 36;

  // Cifras clave en una cuadrícula de hasta 4 por fila
  if (report.summary?.length) {
    const perRow = Math.min(4, report.summary.length);
    const gap = 3;
    const boxWidth = (pageWidth - margin * 2 - gap * (perRow - 1)) / perRow;
    report.summary.forEach(([label, value], i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = margin + col * (boxWidth + gap);
      const top = y + row * 19;
      doc.setDrawColor(221, 212, 194);
      doc.setFillColor(...STRIPE);
      doc.roundedRect(x, top, boxWidth, 16, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(clean(label), x + 3, top + 5.5, { maxWidth: boxWidth - 6 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...TEXT);
      doc.text(clean(value), x + 3, top + 12.5, { maxWidth: boxWidth - 6 });
    });
    y += Math.ceil(report.summary.length / perRow) * 19 + 2;
  }

  for (const table of report.tables) {
    if (table.title) {
      // Si el título quedaría solo al pie de la hoja, la tabla empieza en la siguiente.
      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 16;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...TEXT);
      doc.text(clean(table.title), margin, y + 5);
      y += 7;
    }
    const numeric = new Set(table.numeric ?? []);
    const align = Object.fromEntries([...numeric].map((i) => [i, { halign: 'right' as const }]));
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 16 },
      head: [table.head.map(clean)],
      body: table.rows.map((r) => r.map(clean)),
      foot: table.foot ? [table.foot.map(clean)] : undefined,
      showFoot: 'lastPage',
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: TEXT },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [236, 230, 216], textColor: TEXT, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: align,
      didParseCell: (data) => {
        // Los encabezados y totales de columnas numéricas también a la derecha.
        if (numeric.has(data.column.index)) data.cell.styles.halign = 'right';
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (report.note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(clean(report.note), margin, y, { maxWidth: pageWidth - margin * 2 });
  }

  // Pie de página en todas las hojas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const bottom = doc.internal.pageSize.getHeight() - 8;
    doc.text('SanfeFer · documento interno, no es factura', margin, bottom);
    doc.text(`Página ${p} de ${pages}`, pageWidth - margin, bottom, { align: 'right' });
  }
  return doc.output('blob');
}

/** Descarga el reporte. El nombre lleva el periodo del propio reporte. */
export async function downloadReportPdf(name: string, report: PdfReport) {
  const { from, to } = report.range;
  const suffix = from === to ? from : `${from}_a_${to}`;
  downloadBlob(await reportPdf(report), `sanfefer-${name}-${suffix}.pdf`);
}
