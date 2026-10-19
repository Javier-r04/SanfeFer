import {
  REPORT_GROUP_LABELS,
  REPORT_GROUPS,
  type ProductsReportDto,
  type ReportGroupBy,
  type SalesReportDto,
} from '@sanfefer/shared';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { fetchTabsReport, useProductsReport, useSalesReport, type ReportRange } from './api';
import { BarList, ChartCard, ColumnChart, type ColumnDatum } from './charts';
import { downloadCsv, salesColumns, tabColumns } from './csv-export';
import { CsvButton, Delta, KpiCard, Refreshing } from './ReportParts';
import { compactMoney, hourLabel, periodLabel, periodTitle, WEEKDAYS } from './report-format';

const GROUP_TITLES: Record<ReportGroupBy, string> = {
  day: 'Ventas por día',
  week: 'Ventas por semana',
  month: 'Ventas por mes',
};

function MoneyTable({
  rows,
}: {
  rows: { key: string; label: string; tabs: number; total: number }[];
}) {
  return (
    <table className="tabular w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1.5 font-bold">Periodo</th>
          <th className="py-1.5 text-right font-bold">Cuentas</th>
          <th className="py-1.5 text-right font-bold">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-surface-2">
            <td className="py-2">{r.label}</td>
            <td className="py-2 text-right">{r.tabs}</td>
            <td className="py-2 text-right font-bold">{formatMoney(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfitAndLoss({ t }: { t: SalesReportDto['totals'] }) {
  const rows: { label: string; value: number; minus?: boolean; strong?: boolean; note?: string }[] =
    [
      { label: 'Ventas de productos', value: t.subtotal },
      { label: 'Descuentos', value: t.discounts, minus: true },
      { label: 'Ventas netas', value: t.netSales, strong: true },
      { label: 'Costo de lo vendido', value: t.cost, minus: true },
      {
        label: 'Utilidad bruta',
        value: t.grossProfit,
        strong: true,
        note: t.margin === null ? undefined : `margen ${formatPercent(t.margin)}`,
      },
      { label: 'Mermas (costo)', value: t.wasteCost, minus: true },
      { label: 'Utilidad después de mermas', value: t.profitAfterWaste, strong: true },
    ];
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-extrabold">Utilidad</h2>
        <p className="text-sm text-muted">Costo según la receta y el costo promedio al vender.</p>
      </div>
      <dl className="tabular flex flex-col text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className={cn(
              'flex items-baseline justify-between gap-3 py-1.5',
              r.strong && 'border-t border-border font-extrabold',
            )}
          >
            <dt>
              {r.label}
              {r.note ? <span className="ml-1.5 font-semibold text-muted">· {r.note}</span> : null}
            </dt>
            <dd
              className={cn(
                r.minus && r.value > 0 && 'text-danger-ink',
                r.value < 0 && 'text-danger-ink',
              )}
            >
              {r.minus && r.value > 0 ? `−${formatMoney(r.value)}` : formatMoney(r.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
        Cargo por servicio cobrado:{' '}
        <strong className="text-text">{formatMoney(t.serviceCharges)}</strong>. No se cuenta como
        utilidad. Total cobrado: <strong className="text-text">{formatMoney(t.total)}</strong>.
      </p>
    </section>
  );
}

function Payments({ t }: { t: SalesReportDto['totals'] }) {
  const sum = t.cash + t.card;
  const rows = [
    { label: 'Efectivo', value: t.cash },
    { label: 'Tarjeta', value: t.card },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-extrabold">Formas de pago</h2>
        <p className="text-sm text-muted">Por la fecha de cada pago.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-col gap-1.5">
            <div className="tabular flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold">{r.label}</span>
              <span>
                <span className="text-muted">{sum ? formatPercent(r.value / sum) : '0 %'} · </span>
                <strong>{formatMoney(r.value)}</strong>
              </span>
            </div>
            <div className="h-2 rounded-[4px] bg-primary-soft" aria-hidden="true">
              {r.value > 0 ? (
                <div
                  className="h-full rounded-[4px] bg-primary"
                  style={{ width: `${(r.value / sum) * 100}%` }}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
        <p>
          <span className="block text-muted">Productos vendidos</span>
          <strong className="tabular">{t.units}</strong>
        </p>
        <p>
          <span className="block text-muted">Cancelado</span>
          <strong className={cn('tabular', t.cancelled.units > 0 && 'text-warning-ink')}>
            {t.cancelled.units} u · {formatMoney(t.cancelled.amount)}
          </strong>
        </p>
      </div>
    </section>
  );
}

function TopProducts({ data }: { data: ProductsReportDto | undefined }) {
  const products = data?.products ?? [];
  const top = [...products]
    .filter((p) => p.units > 0)
    .sort((a, b) => b.units - a.units || b.sales - a.sales)
    .slice(0, 5);
  // Menos vendidos: entre los productos activos de la carta, incluidos los que no vendieron nada.
  const bottom = [...products]
    .filter((p) => p.active)
    .sort((a, b) => a.units - b.units || a.sales - b.sales || a.name.localeCompare(b.name, 'es'))
    .slice(0, 5);
  const item = (p: (typeof products)[number]) => ({
    key: p.productId,
    label: p.name,
    value: p.units,
    note: formatMoney(p.sales),
  });
  const units = (v: number) => `${v} u`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Más vendidos"
        subtitle="Por unidades"
        chart={
          <BarList items={top.map(item)} formatValue={units} empty="Sin ventas en el periodo." />
        }
      />
      <ChartCard
        title="Menos vendidos"
        subtitle="Productos activos de la carta"
        chart={
          <BarList items={bottom.map(item)} formatValue={units} empty="No hay productos activos." />
        }
      />
    </div>
  );
}

export function SummaryTab({
  range,
  groupBy,
  onGroupBy,
}: {
  range: ReportRange;
  groupBy: ReportGroupBy;
  onGroupBy: (g: ReportGroupBy) => void;
}) {
  const sales = useSalesReport(range, groupBy);
  const products = useProductsReport(range);
  const r = sales.data;
  if (sales.isPending) return <LoadingState />;
  if (sales.error || !r)
    return <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />;

  const t = r.totals;
  const series: ColumnDatum[] = r.series.map((p) => ({
    key: p.period,
    label: periodLabel(p.period, r.groupBy, r.series.length <= 7),
    title: periodTitle(p.period, r.groupBy),
    value: p.total,
    details: [
      { label: 'Cuentas', value: String(p.tabs) },
      { label: 'Utilidad bruta', value: formatMoney(p.grossProfit) },
    ],
  }));
  // Horas: solo la franja con ventas (más una hora de margen a cada lado).
  const active = r.byHour.filter((h) => h.tabs > 0).map((h) => h.hour);
  const hours = active.length
    ? r.byHour.slice(Math.max(0, Math.min(...active) - 1), Math.min(24, Math.max(...active) + 2))
    : [];
  const hourData: ColumnDatum[] = hours.map((h) => ({
    key: String(h.hour),
    label: String(h.hour).padStart(2, '0'),
    title: `De ${hourLabel(h.hour)} a ${hourLabel((h.hour + 1) % 24)}`,
    value: h.total,
    details: [{ label: 'Cuentas', value: String(h.tabs) }],
  }));
  const weekdayData: ColumnDatum[] = r.byWeekday.map((w) => ({
    key: String(w.weekday),
    label: WEEKDAYS[w.weekday - 1]!.slice(0, 3),
    title: WEEKDAYS[w.weekday - 1]!,
    value: w.total,
    details: [{ label: 'Cuentas', value: String(w.tabs) }],
  }));
  const p = r.previous;

  return (
    <Refreshing active={sales.isPlaceholderData}>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total vendido"
          value={formatMoney(t.total)}
          footer={<Delta current={t.total} previous={p.total} />}
        />
        <KpiCard
          label="Cuentas cobradas"
          value={t.tabs}
          footer={<Delta current={t.tabs} previous={p.tabs} />}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatMoney(t.averageTicket)}
          footer={<Delta current={t.averageTicket} previous={p.averageTicket} />}
        />
        <KpiCard
          label={
            t.margin === null ? 'Utilidad bruta' : `Utilidad bruta · ${formatPercent(t.margin)}`
          }
          value={formatMoney(t.grossProfit)}
          footer={<Delta current={t.grossProfit} previous={p.grossProfit} />}
        />
      </div>

      <ChartCard
        title={GROUP_TITLES[r.groupBy]}
        subtitle="Total cobrado por fecha de cobro"
        actions={
          <>
            <Segmented
              label="Agrupar por"
              value={groupBy}
              onChange={onGroupBy}
              options={REPORT_GROUPS.map((g) => ({ value: g, label: REPORT_GROUP_LABELS[g] }))}
              className="hidden sm:flex"
            />
            <CsvButton
              disabled={sales.isPlaceholderData}
              onExport={() => downloadCsv('ventas', r, salesColumns(r.groupBy), r.series)}
            />
          </>
        }
        chart={
          <div className="flex flex-col gap-3">
            <Segmented
              label="Agrupar por"
              value={groupBy}
              onChange={onGroupBy}
              options={REPORT_GROUPS.map((g) => ({ value: g, label: REPORT_GROUP_LABELS[g] }))}
              className="sm:hidden"
            />
            <ColumnChart
              data={series}
              label={GROUP_TITLES[r.groupBy]}
              formatValue={formatMoney}
              formatTick={compactMoney}
            />
          </div>
        }
        table={
          <MoneyTable
            rows={r.series.map((s) => ({
              key: s.period,
              label: periodTitle(s.period, r.groupBy),
              tabs: s.tabs,
              total: s.total,
            }))}
          />
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ProfitAndLoss t={t} />
        <Payments t={t} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Horas de más venta"
          subtitle="Total cobrado según la hora del cobro"
          chart={
            hourData.length ? (
              <ColumnChart
                data={hourData}
                label="Ventas por hora"
                formatValue={formatMoney}
                formatTick={compactMoney}
              />
            ) : (
              <p className="text-sm text-muted">Sin ventas en el periodo.</p>
            )
          }
          table={
            hourData.length ? (
              <MoneyTable
                rows={hours.map((h) => ({
                  key: String(h.hour),
                  label: `${hourLabel(h.hour)} – ${hourLabel((h.hour + 1) % 24)}`,
                  tabs: h.tabs,
                  total: h.total,
                }))}
              />
            ) : undefined
          }
        />
        <ChartCard
          title="Días de la semana"
          subtitle="Total cobrado por día de la semana"
          chart={
            <ColumnChart
              data={weekdayData}
              label="Ventas por día de la semana"
              formatValue={formatMoney}
              formatTick={compactMoney}
            />
          }
          table={
            <MoneyTable
              rows={r.byWeekday.map((w) => ({
                key: String(w.weekday),
                label: WEEKDAYS[w.weekday - 1]!,
                tabs: w.tabs,
                total: w.total,
              }))}
            />
          }
        />
      </div>

      <TopProducts data={products.data} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm">
          <strong>Detalle de cuentas cobradas</strong>
          <span className="block text-muted">
            Una fila por cuenta: folio, mesa, vendedor, descuento, servicio y forma de pago.
          </span>
        </p>
        <CsvButton
          label="Exportar CSV"
          disabled={t.tabs === 0 || sales.isPlaceholderData}
          onExport={async () => downloadCsv('cuentas', r, tabColumns, await fetchTabsReport(r))}
        />
      </div>
    </Refreshing>
  );
}
