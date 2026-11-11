import {
  KIND_LABELS,
  ROLE_LABELS,
  STOCK_STATUS_LABELS,
  UNIT_LABELS,
  type BalanceReportDto,
  type InventoryReportRowDto,
  type InventoryReportDto,
  type ProductReportRowDto,
  type ProductsReportDto,
  type SalesReportDto,
  type SellersReportDto,
  type TabReportRowDto,
} from '@sanfefer/shared';
import { formatMoney, formatPercent, formatQty, formatTime, formatUnitCost } from '@/lib/format';
import type { ReportRange } from './api';
import type { PdfReport } from './pdf-export';
import { periodTitle, WEEKDAYS, hourLabel } from './report-format';

// Cada función arma el contenido del PDF a partir del mismo reporte que se ve en pantalla.

const pct = (ratio: number | null) => (ratio === null ? '—' : formatPercent(ratio));
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

export function summaryPdf(r: SalesReportDto): PdfReport {
  const t = r.totals;
  return {
    title: 'Resumen de ventas',
    range: r,
    summary: [
      ['Total vendido', formatMoney(t.total)],
      ['Cuentas cobradas', String(t.tabs)],
      ['Ticket promedio', formatMoney(t.averageTicket)],
      ['Utilidad bruta', formatMoney(t.grossProfit)],
      ['Compras del periodo', formatMoney(sum(r.series, (s) => s.purchases))],
      ['Efectivo', formatMoney(t.cash)],
      ['Tarjeta', formatMoney(t.card)],
      ['Margen', pct(t.margin)],
    ],
    tables: [
      {
        title: 'Utilidad',
        head: ['Concepto', 'Monto'],
        numeric: [1],
        rows: [
          ['Ventas de productos', formatMoney(t.subtotal)],
          ['Descuentos', `- ${formatMoney(t.discounts)}`],
          ['Ventas netas', formatMoney(t.netSales)],
          ['Costo de lo vendido', `- ${formatMoney(t.cost)}`],
          ['Utilidad bruta', formatMoney(t.grossProfit)],
          ['Mermas (costo)', `- ${formatMoney(t.wasteCost)}`],
          ['Utilidad después de mermas', formatMoney(t.profitAfterWaste)],
          ['Servicio cobrado', formatMoney(t.serviceCharges)],
          [`Productos cancelados (${t.cancelled.units})`, formatMoney(t.cancelled.amount)],
        ],
      },
      {
        title: 'Ventas y compras por periodo',
        head: ['Periodo', 'Cuentas', 'Ventas', 'Utilidad bruta', 'Compras'],
        numeric: [1, 2, 3, 4],
        rows: r.series.map((s) => [
          periodTitle(s.period, r.groupBy),
          s.tabs,
          formatMoney(s.total),
          formatMoney(s.grossProfit),
          formatMoney(s.purchases),
        ]),
        foot: [
          'Total',
          t.tabs,
          formatMoney(t.total),
          formatMoney(t.grossProfit),
          formatMoney(sum(r.series, (s) => s.purchases)),
        ],
      },
      {
        title: 'Días de la semana',
        head: ['Día', 'Cuentas', 'Total'],
        numeric: [1, 2],
        rows: r.byWeekday.map((w) => [WEEKDAYS[w.weekday - 1]!, w.tabs, formatMoney(w.total)]),
      },
      {
        title: 'Horas con ventas',
        head: ['Hora', 'Cuentas', 'Total'],
        numeric: [1, 2],
        rows: r.byHour
          .filter((h) => h.tabs > 0)
          .map((h) => [hourLabel(h.hour), h.tabs, formatMoney(h.total)]),
      },
    ],
    note: 'Ventas: cuentas cobradas según la fecha de cobro. Compras: compras recibidas (no anuladas) según su fecha.',
  };
}

export function tabsPdf(range: ReportRange, tabs: TabReportRowDto[]): PdfReport {
  return {
    title: 'Detalle de cuentas cobradas',
    range,
    landscape: true,
    summary: [
      ['Cuentas', String(tabs.length)],
      ['Total cobrado', formatMoney(sum(tabs, (t) => t.total))],
      ['Efectivo', formatMoney(sum(tabs, (t) => t.cash))],
      ['Tarjeta', formatMoney(sum(tabs, (t) => t.card))],
    ],
    tables: [
      {
        head: [
          'Folio',
          'Fecha',
          'Hora',
          'Mesa',
          'Cliente',
          'Vendedor',
          'Prod.',
          'Subtotal',
          'Desc.',
          'Servicio',
          'Total',
          'Efectivo',
          'Tarjeta',
        ],
        numeric: [0, 6, 7, 8, 9, 10, 11, 12],
        rows: tabs.map((t) => [
          t.id,
          t.businessDate,
          formatTime(t.closedAt),
          t.table ?? 'Sin mesa',
          t.customerName,
          t.seller,
          t.units,
          formatMoney(t.subtotal),
          formatMoney(t.discount),
          formatMoney(t.serviceCharge),
          formatMoney(t.total),
          formatMoney(t.cash),
          formatMoney(t.card),
        ]),
        foot: [
          'Total',
          '',
          '',
          '',
          '',
          '',
          sum(tabs, (t) => t.units),
          formatMoney(sum(tabs, (t) => t.subtotal)),
          formatMoney(sum(tabs, (t) => t.discount)),
          formatMoney(sum(tabs, (t) => t.serviceCharge)),
          formatMoney(sum(tabs, (t) => t.total)),
          formatMoney(sum(tabs, (t) => t.cash)),
          formatMoney(sum(tabs, (t) => t.card)),
        ],
      },
    ],
  };
}

export function productsPdf(data: ProductsReportDto, rows: ProductReportRowDto[]): PdfReport {
  const sales = sum(rows, (p) => p.sales);
  const profit = sum(rows, (p) => p.profit);
  return {
    title: 'Reporte de productos',
    range: data,
    summary: [
      ['Unidades vendidas', String(sum(rows, (p) => p.units))],
      ['Ventas', formatMoney(sales)],
      ['Costo', formatMoney(sum(rows, (p) => p.cost))],
      ['Utilidad', formatMoney(profit)],
    ],
    tables: [
      {
        title: 'Por producto',
        head: ['Producto', 'Categoría', 'Unidades', 'Ventas', 'Costo', 'Utilidad', 'Margen'],
        numeric: [2, 3, 4, 5, 6],
        rows: rows.map((p) => [
          p.active ? p.name : `${p.name} (inactivo)`,
          p.category,
          p.units,
          formatMoney(p.sales),
          formatMoney(p.cost),
          formatMoney(p.profit),
          pct(p.margin),
        ]),
        foot: [
          'Total',
          '',
          sum(rows, (p) => p.units),
          formatMoney(sales),
          formatMoney(sum(rows, (p) => p.cost)),
          formatMoney(profit),
          pct(sales > 0 ? profit / sales : null),
        ],
      },
      {
        title: 'Por categoría',
        head: ['Categoría', 'Unidades', 'Ventas', 'Costo', 'Utilidad'],
        numeric: [1, 2, 3, 4],
        rows: data.categories.map((c) => [
          c.name,
          c.units,
          formatMoney(c.sales),
          formatMoney(c.cost),
          formatMoney(c.profit),
        ]),
      },
    ],
    note: 'Ventas a precio de carta, sin repartir los descuentos aplicados a la cuenta.',
  };
}

export function sellersPdf(data: SellersReportDto): PdfReport {
  const s = data.sellers;
  return {
    title: 'Reporte de vendedores',
    range: data,
    tables: [
      {
        head: [
          'Vendedor',
          'Rol',
          'Cuentas',
          'Productos',
          'Total vendido',
          'Ticket prom.',
          'Descuentos',
          'Cancelados',
          'Monto cancelado',
        ],
        numeric: [2, 3, 4, 5, 6, 7, 8],
        rows: s.map((x) => [
          x.name,
          ROLE_LABELS[x.role],
          x.tabs,
          x.units,
          formatMoney(x.total),
          formatMoney(x.averageTicket),
          formatMoney(x.discounts),
          x.cancelled.units,
          formatMoney(x.cancelled.amount),
        ]),
        foot: [
          'Total',
          '',
          sum(s, (x) => x.tabs),
          sum(s, (x) => x.units),
          formatMoney(sum(s, (x) => x.total)),
          '',
          formatMoney(sum(s, (x) => x.discounts)),
          sum(s, (x) => x.cancelled.units),
          formatMoney(sum(s, (x) => x.cancelled.amount)),
        ],
      },
    ],
    landscape: true,
    note: 'Cuentas cobradas en el periodo, según quién las abrió.',
  };
}

export function inventoryPdf(r: InventoryReportDto, rows: InventoryReportRowDto[]): PdfReport {
  const qty = (v: number, unit: InventoryReportRowDto['unit']) => (v ? formatQty(v, unit) : '—');
  return {
    title: 'Reporte de inventario',
    range: r,
    landscape: true,
    summary: [
      ['Valor del inventario', formatMoney(r.totalValue)],
      ['Stock bajo', String(r.lowCount)],
      ['Agotados', String(r.outCount)],
      ['Mermas del periodo', formatMoney(r.wasteCost)],
    ],
    tables: [
      {
        head: [
          'Artículo',
          'Tipo',
          'Existencia',
          'Estado',
          'Costo de compra',
          'Valor',
          'Comprado',
          'Vendido',
          'Merma',
          'Costo merma',
        ],
        numeric: [2, 4, 5, 6, 7, 8, 9],
        rows: rows.map((i) => [
          i.active ? i.name : `${i.name} (inactivo)`,
          KIND_LABELS[i.kind],
          formatQty(i.stock, i.unit),
          STOCK_STATUS_LABELS[i.status],
          `${formatUnitCost(i.purchaseCost)} / ${UNIT_LABELS[i.unit]}`,
          formatMoney(i.value),
          qty(i.purchased, i.unit),
          qty(i.sold, i.unit),
          qty(i.wasted, i.unit),
          i.wasteCost ? formatMoney(i.wasteCost) : '—',
        ]),
      },
    ],
    note: 'Existencia, estado y valor son del momento de la descarga. Comprado, vendido y merma corresponden al periodo.',
  };
}

export function balancePdf(r: BalanceReportDto): PdfReport {
  return {
    title: 'Balance de compras y ventas',
    range: r,
    summary: [
      ['Total vendido', formatMoney(r.sales.total)],
      ['Total comprado', formatMoney(r.purchases.total)],
      ['Diferencia', formatMoney(r.difference)],
      ['Utilidad bruta', formatMoney(r.sales.grossProfit)],
    ],
    tables: [
      {
        title: 'Por periodo',
        head: ['Periodo', 'Ventas', 'Compras', 'Diferencia'],
        numeric: [1, 2, 3],
        rows: r.series.map((s) => [
          periodTitle(s.period, r.groupBy),
          formatMoney(s.sales),
          formatMoney(s.purchases),
          formatMoney(s.difference),
        ]),
        foot: [
          'Total',
          formatMoney(r.sales.total),
          formatMoney(r.purchases.total),
          formatMoney(r.difference),
        ],
      },
      {
        title: 'Ventas',
        head: ['Concepto', 'Monto'],
        numeric: [1],
        rows: [
          ['Cuentas cobradas', String(r.sales.tabs)],
          ['Total cobrado', formatMoney(r.sales.total)],
          ['Ventas netas', formatMoney(r.sales.netSales)],
          ['Costo de lo vendido', formatMoney(r.sales.cost)],
          ['Utilidad bruta', formatMoney(r.sales.grossProfit)],
        ],
      },
      {
        title: 'Compras por proveedor',
        head: ['Proveedor', 'Compras', 'Total'],
        numeric: [1, 2],
        rows: r.bySupplier.map((s) => [s.name, s.count, formatMoney(s.total)]),
        foot: ['Total', r.purchases.count, formatMoney(r.purchases.total)],
      },
      {
        title: 'Artículos comprados',
        head: ['Artículo', 'Cantidad', 'Total'],
        numeric: [1, 2],
        rows: r.byItem.map((i) => [i.name, formatQty(i.quantity, i.unit), formatMoney(i.total)]),
      },
    ],
    note: 'Ventas: total cobrado según la fecha de cobro. Compras: compras recibidas (no anuladas) según su fecha. La diferencia no es la utilidad: lo comprado puede seguir en inventario.',
  };
}
