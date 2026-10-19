import { Prisma } from '@prisma/client';
import {
  BUSINESS_TIMEZONE,
  businessDayRange,
  fromCents,
  isoWeekday,
  periodKey,
  periodKeys,
  previousRange,
  stockStatus,
  toCents,
  type InventoryReportDto,
  type ProductsReportDto,
  type ReportRangeQuery,
  type SalesReportDto,
  type SalesReportQuery,
  type SalesTotalsDto,
  type SellersReportDto,
  type TabReportRowDto,
} from '@sanfefer/shared';
import { prisma } from '../../lib/prisma';
import { lineTotal } from '../pos/pos.mapper';

// Criterio común (el mismo del cierre del día): cuentas cobradas por la fecha de cobro,
// sin productos cancelados. Los montos se suman en centavos para no arrastrar decimales.

type Num = Prisma.Decimal | number | null;
const cents = (v: Num) => toCents(Number(v ?? 0));
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const dateRange = (r: ReportRangeQuery) => ({ gte: day(r.from), lte: day(r.to) });
const ratio = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : null;
const average = (totalCents: number, count: number) =>
  count ? fromCents(Math.round(totalCents / count)) : 0;

/** Rango de instantes [inicio del primer día, fin del último) en hora del negocio. */
function instantRange(r: ReportRangeQuery) {
  return { gte: businessDayRange(r.from).start, lt: businessDayRange(r.to).end };
}

interface DayRow {
  date: string;
  tabs: number;
  units: number;
  subtotal: Num;
  discounts: Num;
  service: Num;
  total: Num;
  cost: Num;
}

/** Totales por día de cobro, con unidades y costo de lo vendido. */
function dayRows(r: ReportRangeQuery) {
  return prisma.$queryRaw<DayRow[]>`
    SELECT to_char(t."businessDate", 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS tabs,
           COALESCE(SUM(i.units), 0)::int AS units,
           SUM(t.subtotal) AS subtotal,
           SUM(t."discountTotal") AS discounts,
           SUM(t."serviceCharge") AS service,
           SUM(t.total) AS total,
           COALESCE(SUM(i.cost), 0) AS cost
    FROM "Tab" t
    LEFT JOIN LATERAL (
      SELECT SUM(oi.quantity) AS units, SUM(oi.quantity * oi."unitCost") AS cost
      FROM "OrderItem" oi
      WHERE oi."tabId" = t.id AND oi.status <> 'CANCELLED'
    ) i ON true
    WHERE t.status = 'PAID' AND t."businessDate" BETWEEN ${r.from}::date AND ${r.to}::date
    GROUP BY t."businessDate"
    ORDER BY t."businessDate"`;
}

/** Acumulador en centavos de filas diarias. */
function sumRows(rows: DayRow[]) {
  const acc = { tabs: 0, units: 0, subtotal: 0, discounts: 0, service: 0, total: 0, cost: 0 };
  for (const row of rows) {
    acc.tabs += row.tabs;
    acc.units += row.units;
    acc.subtotal += cents(row.subtotal);
    acc.discounts += cents(row.discounts);
    acc.service += cents(row.service);
    acc.total += cents(row.total);
    acc.cost += cents(row.cost);
  }
  return acc;
}

function toTotals(acc: ReturnType<typeof sumRows>): SalesTotalsDto {
  const net = acc.subtotal - acc.discounts;
  return {
    tabs: acc.tabs,
    units: acc.units,
    subtotal: fromCents(acc.subtotal),
    discounts: fromCents(acc.discounts),
    serviceCharges: fromCents(acc.service),
    total: fromCents(acc.total),
    netSales: fromCents(net),
    cost: fromCents(acc.cost),
    grossProfit: fromCents(net - acc.cost),
    margin: ratio(net - acc.cost, net),
    averageTicket: average(acc.total, acc.tabs),
  };
}

/** Costo de las mermas (salidas manuales y productos ya preparados que se cancelaron). */
async function wasteCostCents(r: ReportRangeQuery) {
  const rows = await prisma.inventoryMovement.findMany({
    where: { type: 'WASTE', createdAt: instantRange(r) },
    select: { inventoryItemId: true, quantity: true, unitCost: true },
  });
  const byItem = new Map<number, number>();
  for (const m of rows) {
    const cost = toCents(-Number(m.quantity) * Number(m.unitCost ?? 0));
    byItem.set(m.inventoryItemId, (byItem.get(m.inventoryItemId) ?? 0) + cost);
  }
  return byItem;
}

export async function salesReport(q: SalesReportQuery): Promise<SalesReportDto> {
  const prev = previousRange(q.from, q.to);
  const [rows, prevRows, payments, hours, waste, cancelled] = await Promise.all([
    dayRows(q),
    dayRows(prev),
    prisma.payment.groupBy({
      by: ['method'],
      where: { businessDate: dateRange(q) },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ hour: number; tabs: number; total: Num }[]>`
      SELECT EXTRACT(HOUR FROM (t."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIMEZONE})::int AS hour,
             COUNT(*)::int AS tabs,
             SUM(t.total) AS total
      FROM "Tab" t
      WHERE t.status = 'PAID' AND t."closedAt" IS NOT NULL
        AND t."businessDate" BETWEEN ${q.from}::date AND ${q.to}::date
      GROUP BY 1`,
    wasteCostCents(q),
    prisma.orderItem.findMany({
      where: { status: 'CANCELLED', statusChangedAt: instantRange(q) },
      select: { quantity: true, unitPrice: true, discountAmount: true, status: true },
    }),
  ]);

  const acc = sumRows(rows);
  const totals = toTotals(acc);
  const wasteCost = [...waste.values()].reduce((s, v) => s + v, 0);
  const paid = (method: 'CASH' | 'CARD') =>
    fromCents(cents(payments.find((p) => p.method === method)?._sum.amount ?? 0));

  // Serie sin huecos: los periodos sin ventas salen en cero.
  const series = new Map(
    periodKeys(q.from, q.to, q.groupBy).map((period) => [
      period,
      { period, tabs: 0, total: 0, net: 0, cost: 0 },
    ]),
  );
  const weekdays = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, tabs: 0, total: 0 }));
  for (const row of rows) {
    const p = series.get(periodKey(row.date, q.groupBy))!;
    p.tabs += row.tabs;
    p.total += cents(row.total);
    p.net += cents(row.subtotal) - cents(row.discounts);
    p.cost += cents(row.cost);
    const w = weekdays[isoWeekday(row.date) - 1]!;
    w.tabs += row.tabs;
    w.total += cents(row.total);
  }
  const prevTotals = toTotals(sumRows(prevRows));

  return {
    from: q.from,
    to: q.to,
    groupBy: q.groupBy,
    totals: {
      ...totals,
      cash: paid('CASH'),
      card: paid('CARD'),
      wasteCost: fromCents(wasteCost),
      profitAfterWaste: fromCents(acc.subtotal - acc.discounts - acc.cost - wasteCost),
      cancelled: {
        units: cancelled.reduce((s, i) => s + i.quantity, 0),
        amount: fromCents(cancelled.reduce((s, i) => s + toCents(lineTotal(i)), 0)),
      },
    },
    previous: {
      ...prev,
      tabs: prevTotals.tabs,
      total: prevTotals.total,
      grossProfit: prevTotals.grossProfit,
      averageTicket: prevTotals.averageTicket,
    },
    series: [...series.values()].map((p) => ({
      period: p.period,
      tabs: p.tabs,
      total: fromCents(p.total),
      netSales: fromCents(p.net),
      cost: fromCents(p.cost),
      grossProfit: fromCents(p.net - p.cost),
    })),
    byHour: Array.from({ length: 24 }, (_, hour) => {
      const h = hours.find((x) => x.hour === hour);
      return { hour, tabs: h?.tabs ?? 0, total: fromCents(cents(h?.total ?? 0)) };
    }),
    byWeekday: weekdays.map((w) => ({ ...w, total: fromCents(w.total) })),
  };
}

export async function productsReport(q: ReportRangeQuery): Promise<ProductsReportDto> {
  const [sold, products] = await Promise.all([
    prisma.$queryRaw<{ productId: number; units: number; sales: Num; cost: Num }[]>`
      SELECT oi."productId" AS "productId",
             SUM(oi.quantity)::int AS units,
             SUM(oi.quantity * oi."unitPrice" - oi."discountAmount") AS sales,
             SUM(oi.quantity * oi."unitCost") AS cost
      FROM "OrderItem" oi
      JOIN "Tab" t ON t.id = oi."tabId"
      WHERE t.status = 'PAID' AND oi.status <> 'CANCELLED'
        AND t."businessDate" BETWEEN ${q.from}::date AND ${q.to}::date
      GROUP BY oi."productId"`,
    prisma.product.findMany({
      include: { category: { select: { name: true, sortOrder: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const byId = new Map(sold.map((s) => [s.productId, s]));
  const categories = new Map<
    string,
    { name: string; units: number; sales: number; cost: number }
  >();
  const rows = products
    // Los inactivos solo aparecen si vendieron algo en el rango.
    .filter((p) => p.active || byId.has(p.id))
    .map((p) => {
      const s = byId.get(p.id);
      const sales = cents(s?.sales ?? 0);
      const cost = cents(s?.cost ?? 0);
      const units = s?.units ?? 0;
      const c = categories.get(p.category.name) ?? {
        name: p.category.name,
        units: 0,
        sales: 0,
        cost: 0,
      };
      c.units += units;
      c.sales += sales;
      c.cost += cost;
      categories.set(p.category.name, c);
      return {
        productId: p.id,
        name: p.name,
        category: p.category.name,
        active: p.active,
        units,
        sales: fromCents(sales),
        cost: fromCents(cost),
        profit: fromCents(sales - cost),
        margin: ratio(sales - cost, sales),
      };
    });

  return {
    from: q.from,
    to: q.to,
    products: rows,
    categories: [...categories.values()].map((c) => ({
      name: c.name,
      units: c.units,
      sales: fromCents(c.sales),
      cost: fromCents(c.cost),
      profit: fromCents(c.sales - c.cost),
    })),
  };
}

export async function sellersReport(q: ReportRangeQuery): Promise<SellersReportDto> {
  const [tabs, units, cancelled, users] = await Promise.all([
    prisma.tab.groupBy({
      by: ['openedById'],
      where: { status: 'PAID', businessDate: dateRange(q) },
      _count: { _all: true },
      _sum: { total: true, discountTotal: true },
    }),
    prisma.$queryRaw<{ userId: number; units: number }[]>`
      SELECT t."openedById" AS "userId", COALESCE(SUM(oi.quantity), 0)::int AS units
      FROM "OrderItem" oi
      JOIN "Tab" t ON t.id = oi."tabId"
      WHERE t.status = 'PAID' AND oi.status <> 'CANCELLED'
        AND t."businessDate" BETWEEN ${q.from}::date AND ${q.to}::date
      GROUP BY t."openedById"`,
    prisma.orderItem.findMany({
      where: { status: 'CANCELLED', statusChangedAt: instantRange(q) },
      select: {
        cancelledById: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        status: true,
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true, active: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const cancelledBy = new Map<number, { units: number; amount: number }>();
  for (const i of cancelled) {
    if (i.cancelledById === null) continue;
    const c = cancelledBy.get(i.cancelledById) ?? { units: 0, amount: 0 };
    c.units += i.quantity;
    c.amount += toCents(lineTotal(i));
    cancelledBy.set(i.cancelledById, c);
  }

  const sellers = users
    .map((u) => {
      const t = tabs.find((x) => x.openedById === u.id);
      const total = cents(t?._sum.total ?? 0);
      const count = t?._count._all ?? 0;
      const c = cancelledBy.get(u.id) ?? { units: 0, amount: 0 };
      return {
        ...u,
        tabs: count,
        units: units.find((x) => x.userId === u.id)?.units ?? 0,
        total: fromCents(total),
        averageTicket: average(total, count),
        discounts: fromCents(cents(t?._sum.discountTotal ?? 0)),
        cancelled: { units: c.units, amount: fromCents(c.amount) },
      };
    })
    // Vendedores activos siempre; el resto solo si tuvo movimiento en el rango.
    .filter((s) => (s.active && s.role === 'SELLER') || s.tabs > 0 || s.cancelled.units > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));

  return { from: q.from, to: q.to, sellers };
}

export async function inventoryReport(q: ReportRangeQuery): Promise<InventoryReportDto> {
  const [items, moves, waste] = await Promise.all([
    prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }),
    prisma.inventoryMovement.groupBy({
      by: ['inventoryItemId', 'type'],
      where: { createdAt: instantRange(q) },
      _sum: { quantity: true },
    }),
    wasteCostCents(q),
  ]);

  const qty = (id: number, ...types: string[]) =>
    moves
      .filter((m) => m.inventoryItemId === id && types.includes(m.type))
      .reduce((s, m) => s + Number(m._sum.quantity ?? 0), 0);
  const round3 = (n: number) => Math.round(n * 1000) / 1000 || 0;

  const rows = items
    .map((i) => {
      const stock = Number(i.stock);
      const minStock = Number(i.minStock);
      const averageCost = Number(i.averageCost);
      return {
        id: i.id,
        name: i.name,
        kind: i.kind,
        unit: i.unit,
        active: i.active,
        stock,
        minStock,
        averageCost,
        value: fromCents(toCents(Math.max(0, stock) * averageCost)),
        status: stockStatus(stock, minStock),
        purchased: round3(qty(i.id, 'PURCHASE', 'PURCHASE_VOID')),
        sold: round3(-qty(i.id, 'SALE', 'SALE_VOID')),
        wasted: round3(-qty(i.id, 'WASTE')),
        wasteCost: fromCents(waste.get(i.id) ?? 0),
        adjusted: round3(qty(i.id, 'ADJUSTMENT', 'MANUAL_IN', 'INITIAL')),
      };
    })
    .filter((r) => r.active || r.stock !== 0 || r.sold || r.purchased || r.wasted || r.adjusted);

  const active = rows.filter((r) => r.active);
  return {
    from: q.from,
    to: q.to,
    totalValue: fromCents(rows.reduce((s, r) => s + toCents(r.value), 0)),
    lowCount: active.filter((r) => r.status === 'LOW').length,
    outCount: active.filter((r) => r.status === 'OUT').length,
    wasteCost: fromCents([...waste.values()].reduce((s, v) => s + v, 0)),
    items: rows,
  };
}

/** Detalle de cuentas cobradas, para exportar. */
export async function tabsReport(q: ReportRangeQuery): Promise<TabReportRowDto[]> {
  const tabs = await prisma.tab.findMany({
    where: { status: 'PAID', businessDate: dateRange(q) },
    select: {
      id: true,
      businessDate: true,
      closedAt: true,
      customerName: true,
      subtotal: true,
      discountTotal: true,
      serviceCharge: true,
      total: true,
      table: { select: { name: true } },
      openedBy: { select: { name: true } },
      payments: { select: { method: true, amount: true } },
      items: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } },
    },
    orderBy: [{ closedAt: 'asc' }, { id: 'asc' }],
  });
  const byMethod = (t: (typeof tabs)[number], method: 'CASH' | 'CARD') =>
    fromCents(
      t.payments.filter((p) => p.method === method).reduce((s, p) => s + cents(p.amount), 0),
    );
  return tabs.map((t) => ({
    id: t.id,
    businessDate: t.businessDate!.toISOString().slice(0, 10),
    closedAt: t.closedAt!.toISOString(),
    table: t.table?.name ?? null,
    customerName: t.customerName,
    seller: t.openedBy.name,
    units: t.items.reduce((s, i) => s + i.quantity, 0),
    subtotal: Number(t.subtotal),
    discount: Number(t.discountTotal),
    serviceCharge: Number(t.serviceCharge),
    total: Number(t.total),
    cash: byMethod(t, 'CASH'),
    card: byMethod(t, 'CARD'),
  }));
}
