import {
  CSV_BOM,
  KIND_LABELS,
  ROLE_LABELS,
  STOCK_STATUS_LABELS,
  toCsv,
  UNIT_LABELS,
  type CsvColumn,
  type InventoryReportRowDto,
  type ProductReportRowDto,
  type SalesReportDto,
  type SellerReportRowDto,
  type TabReportRowDto,
} from '@sanfefer/shared';
import { downloadBlob } from '@/lib/download';
import { formatTime } from '@/lib/format';
import type { ReportRange } from './api';
import { periodTitle } from './report-format';

// Los montos van sin símbolo y con punto decimal para que Excel los tome como números.
const pct = (ratio: number | null) => (ratio === null ? null : Math.round(ratio * 1000) / 10);

/** El rango sale del propio reporte, para que el nombre del archivo y los datos coincidan siempre. */
export function downloadCsv<T>(
  name: string,
  range: ReportRange,
  columns: CsvColumn<T>[],
  rows: T[],
) {
  const csv = toCsv(columns, rows);
  const suffix = range.from === range.to ? range.from : `${range.from}_a_${range.to}`;
  downloadBlob(
    new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8' }),
    `sanfefer-${name}-${suffix}.csv`,
  );
}

type Period = SalesReportDto['series'][number];
export const salesColumns = (groupBy: SalesReportDto['groupBy']): CsvColumn<Period>[] => [
  { header: 'Periodo', value: (p) => periodTitle(p.period, groupBy) },
  { header: 'Fecha inicial', value: (p) => p.period },
  { header: 'Cuentas', value: (p) => p.tabs },
  { header: 'Ventas netas (Q)', value: (p) => p.netSales },
  { header: 'Costo (Q)', value: (p) => p.cost },
  { header: 'Utilidad bruta (Q)', value: (p) => p.grossProfit },
  { header: 'Total cobrado (Q)', value: (p) => p.total },
];

export const tabColumns: CsvColumn<TabReportRowDto>[] = [
  { header: 'Folio', value: (t) => t.id },
  { header: 'Fecha', value: (t) => t.businessDate },
  { header: 'Hora de cobro', value: (t) => formatTime(t.closedAt) },
  { header: 'Mesa', value: (t) => t.table ?? 'Sin mesa' },
  { header: 'Cliente', value: (t) => t.customerName },
  { header: 'Vendedor', value: (t) => t.seller },
  { header: 'Productos', value: (t) => t.units },
  { header: 'Subtotal (Q)', value: (t) => t.subtotal },
  { header: 'Descuento (Q)', value: (t) => t.discount },
  { header: 'Servicio (Q)', value: (t) => t.serviceCharge },
  { header: 'Total (Q)', value: (t) => t.total },
  { header: 'Efectivo (Q)', value: (t) => t.cash },
  { header: 'Tarjeta (Q)', value: (t) => t.card },
];

export const productColumns: CsvColumn<ProductReportRowDto>[] = [
  { header: 'Producto', value: (p) => p.name },
  { header: 'Categoría', value: (p) => p.category },
  { header: 'Activo', value: (p) => (p.active ? 'Sí' : 'No') },
  { header: 'Unidades', value: (p) => p.units },
  { header: 'Ventas (Q)', value: (p) => p.sales },
  { header: 'Costo (Q)', value: (p) => p.cost },
  { header: 'Utilidad (Q)', value: (p) => p.profit },
  { header: 'Margen (%)', value: (p) => pct(p.margin) },
];

export const sellerColumns: CsvColumn<SellerReportRowDto>[] = [
  { header: 'Vendedor', value: (s) => s.name },
  { header: 'Rol', value: (s) => ROLE_LABELS[s.role] },
  { header: 'Cuentas', value: (s) => s.tabs },
  { header: 'Productos', value: (s) => s.units },
  { header: 'Total vendido (Q)', value: (s) => s.total },
  { header: 'Ticket promedio (Q)', value: (s) => s.averageTicket },
  { header: 'Descuentos (Q)', value: (s) => s.discounts },
  { header: 'Productos cancelados', value: (s) => s.cancelled.units },
  { header: 'Monto cancelado (Q)', value: (s) => s.cancelled.amount },
];

export const inventoryColumns: CsvColumn<InventoryReportRowDto>[] = [
  { header: 'Artículo', value: (i) => i.name },
  { header: 'Tipo', value: (i) => KIND_LABELS[i.kind] },
  { header: 'Unidad', value: (i) => UNIT_LABELS[i.unit] },
  { header: 'Existencia', value: (i) => i.stock },
  { header: 'Mínimo', value: (i) => i.minStock },
  { header: 'Estado', value: (i) => STOCK_STATUS_LABELS[i.status] },
  { header: 'Costo promedio (Q)', value: (i) => i.averageCost },
  { header: 'Valor (Q)', value: (i) => i.value },
  { header: 'Comprado en el periodo', value: (i) => i.purchased },
  { header: 'Vendido en el periodo', value: (i) => i.sold },
  { header: 'Merma en el periodo', value: (i) => i.wasted },
  { header: 'Costo de la merma (Q)', value: (i) => i.wasteCost },
  { header: 'Ajustes y entradas manuales', value: (i) => i.adjusted },
];
