import { ROLE_LABELS } from '@sanfefer/shared';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useSellersReport, type ReportRange } from './api';
import { BarList, ChartCard } from './charts';
import { downloadCsv, sellerColumns } from './csv-export';
import { CsvButton, DataTable, Refreshing, td, tdNum } from './ReportParts';

export function SellersTab({ range }: { range: ReportRange }) {
  const report = useSellersReport(range);
  if (report.isPending) return <LoadingState />;
  if (report.error || !report.data)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const sellers = report.data.sellers;
  if (!sellers.length) return <EmptyState title="No hay vendedores activos." />;

  return (
    <Refreshing active={report.isPlaceholderData}>
      <ChartCard
        title="Total por vendedor"
        subtitle="Cuentas cobradas que abrió cada quien"
        actions={
          <CsvButton
            disabled={report.isPlaceholderData}
            onExport={() => downloadCsv('vendedores', report.data, sellerColumns, sellers)}
          />
        }
        chart={
          <BarList
            items={sellers.map((s) => ({
              key: s.id,
              label: s.name,
              value: s.total,
              note: `${s.tabs} cuenta${s.tabs === 1 ? '' : 's'}`,
            }))}
            formatValue={formatMoney}
            empty="Sin ventas en el periodo."
          />
        }
      />
      <DataTable
        label="Ventas por vendedor"
        minWidth={760}
        head={[
          { label: 'Vendedor' },
          { label: 'Cuentas', numeric: true },
          { label: 'Productos', numeric: true },
          { label: 'Total', numeric: true },
          { label: 'Ticket promedio', numeric: true },
          { label: 'Descuentos', numeric: true },
          { label: 'Cancelado', numeric: true },
        ]}
      >
        {sellers.map((s) => (
          <tr key={s.id} className={cn(s.tabs === 0 && 'text-muted')}>
            <td className={td}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-text">{s.name}</span>
                {s.role === 'ADMIN' ? <Badge tone="highlight">{ROLE_LABELS.ADMIN}</Badge> : null}
                {!s.active ? <Badge>Inactivo</Badge> : null}
              </span>
            </td>
            <td className={tdNum}>{s.tabs}</td>
            <td className={tdNum}>{s.units}</td>
            <td className={cn(tdNum, 'font-bold text-text')}>{formatMoney(s.total)}</td>
            <td className={tdNum}>{formatMoney(s.averageTicket)}</td>
            <td className={tdNum}>
              {s.discounts ? `−${formatMoney(s.discounts)}` : formatMoney(0)}
            </td>
            <td className={cn(tdNum, s.cancelled.units > 0 && 'text-warning-ink')}>
              {s.cancelled.units} u · {formatMoney(s.cancelled.amount)}
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="text-[13px] text-muted">
        Cada cuenta cuenta para quien la abrió. "Cancelado" son los productos que cada quien canceló
        en el periodo.
      </p>
    </Refreshing>
  );
}
