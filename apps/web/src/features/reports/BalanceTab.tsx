import { REPORT_GROUP_LABELS, REPORT_GROUPS, type ReportGroupBy } from '@sanfefer/shared';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatMoney, formatQty } from '@/lib/format';
import { useBalanceReport, type ReportRange } from './api';
import { BarList, ChartCard, ChartLegend, ColumnChart, type ColumnDatum } from './charts';
import { downloadReportPdf } from './pdf-export';
import { Delta, KpiCard, PdfButton, Refreshing } from './ReportParts';
import { balancePdf } from './report-pdfs';
import { compactMoney, periodLabel, periodTitle } from './report-format';

const SERIES = { primary: 'Ventas', secondary: 'Compras' };
const TITLES: Record<ReportGroupBy, string> = {
  day: 'Ventas y compras por día',
  week: 'Ventas y compras por semana',
  month: 'Ventas y compras por mes',
};

const signed = (v: number) => (v < 0 ? `−${formatMoney(-v)}` : formatMoney(v));

/** Balance de compras y ventas: lo cobrado contra lo comprado en el periodo. */
export function BalanceTab({
  range,
  groupBy,
  onGroupBy,
}: {
  range: ReportRange;
  groupBy: ReportGroupBy;
  onGroupBy: (g: ReportGroupBy) => void;
}) {
  const report = useBalanceReport(range, groupBy);
  const r = report.data;
  if (report.isPending) return <LoadingState />;
  if (report.error || !r)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const data: ColumnDatum[] = r.series.map((s) => ({
    key: s.period,
    label: periodLabel(s.period, r.groupBy, r.series.length <= 7),
    title: periodTitle(s.period, r.groupBy),
    value: s.sales,
    secondary: s.purchases,
    details: [{ label: 'Diferencia', value: signed(s.difference) }],
  }));
  const groupPicker = (className: string) => (
    <Segmented
      label="Agrupar por"
      value={groupBy}
      onChange={onGroupBy}
      options={REPORT_GROUPS.map((g) => ({ value: g, label: REPORT_GROUP_LABELS[g] }))}
      className={className}
    />
  );

  return (
    <Refreshing active={report.isPlaceholderData}>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total vendido"
          value={formatMoney(r.sales.total)}
          footer={<Delta current={r.sales.total} previous={r.previous.sales} />}
        />
        <KpiCard
          label="Total comprado"
          value={formatMoney(r.purchases.total)}
          footer={
            <span className="text-muted">
              {r.purchases.count} compra{r.purchases.count === 1 ? '' : 's'} · antes{' '}
              {formatMoney(r.previous.purchases)}
            </span>
          }
        />
        <KpiCard
          label="Diferencia"
          value={
            <span className={cn(r.difference < 0 && 'text-danger-ink')}>
              {signed(r.difference)}
            </span>
          }
          footer={<span className="text-muted">Vendido − comprado</span>}
        />
        <KpiCard
          label="Utilidad bruta"
          value={formatMoney(r.sales.grossProfit)}
          footer={<span className="text-muted">Ventas netas − costo de lo vendido</span>}
        />
      </div>

      <ChartCard
        title={TITLES[r.groupBy]}
        subtitle="Ventas por fecha de cobro; compras recibidas por fecha de compra"
        actions={
          <>
            {groupPicker('hidden sm:flex')}
            <PdfButton
              disabled={report.isPlaceholderData}
              onExport={() => downloadReportPdf('balance', balancePdf(r))}
            />
          </>
        }
        chart={
          <div className="flex flex-col gap-3">
            {groupPicker('sm:hidden')}
            <ChartLegend series={SERIES} />
            <ColumnChart
              data={data}
              label={TITLES[r.groupBy]}
              formatValue={formatMoney}
              formatTick={compactMoney}
              series={SERIES}
            />
          </div>
        }
        table={
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 font-bold">Periodo</th>
                <th className="py-1.5 text-right font-bold">Ventas</th>
                <th className="py-1.5 text-right font-bold">Compras</th>
                <th className="py-1.5 text-right font-bold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {r.series.map((s) => (
                <tr key={s.period} className="border-t border-surface-2">
                  <td className="py-2">{periodTitle(s.period, r.groupBy)}</td>
                  <td className="py-2 text-right">{formatMoney(s.sales)}</td>
                  <td className="py-2 text-right">{formatMoney(s.purchases)}</td>
                  <td
                    className={cn(
                      'py-2 text-right font-bold',
                      s.difference < 0 && 'text-danger-ink',
                    )}
                  >
                    {signed(s.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Compras por proveedor"
          subtitle="Total comprado en el periodo"
          chart={
            <BarList
              items={r.bySupplier.map((s) => ({
                key: s.supplierId,
                label: s.name,
                value: s.total,
                note: `${s.count} compra${s.count === 1 ? '' : 's'}`,
              }))}
              formatValue={formatMoney}
              empty="Sin compras en el periodo."
            />
          }
        />
        <ChartCard
          title="Artículos comprados"
          subtitle="Los de mayor gasto"
          chart={
            <BarList
              items={r.byItem.slice(0, 8).map((i) => ({
                key: i.id,
                label: i.name,
                value: i.total,
                note: formatQty(i.quantity, i.unit),
              }))}
              formatValue={formatMoney}
              empty="Sin compras en el periodo."
            />
          }
        />
      </div>
      <p className="text-[13px] text-muted">
        La diferencia no es la ganancia: lo que compraste puede seguir en el inventario. La ganancia
        de lo vendido es la utilidad bruta.
      </p>
    </Refreshing>
  );
}
