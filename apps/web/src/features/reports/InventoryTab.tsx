import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StockBadge } from '@/features/inventory/StockBadge';
import { formatMoney, formatQty, formatUnitCost } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useInventoryReport, type ReportRange } from './api';
import { inventoryColumns, downloadCsv } from './csv-export';
import { CsvButton, DataTable, KpiCard, Refreshing, td, tdNum } from './ReportParts';

type Filter = 'all' | 'alerts' | 'moved';

export function InventoryTab({ range }: { range: ReportRange }) {
  const report = useInventoryReport(range);
  const [filter, setFilter] = useState<Filter>('all');
  if (report.isPending) return <LoadingState />;
  if (report.error || !report.data)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const r = report.data;
  const rows = r.items.filter((i) =>
    filter === 'alerts'
      ? i.active && i.status !== 'OK'
      : filter === 'moved'
        ? i.purchased || i.sold || i.wasted || i.adjusted
        : true,
  );
  const qty = (v: number, unit: (typeof rows)[number]['unit']) => (v ? formatQty(v, unit) : '—');

  return (
    <Refreshing active={report.isPlaceholderData}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Valor del inventario"
          value={formatMoney(r.totalValue)}
          footer={<span className="text-muted">Existencia × costo promedio, hoy</span>}
        />
        <KpiCard
          label="Stock bajo"
          value={<span className={cn(r.lowCount > 0 && 'text-warning-ink')}>{r.lowCount}</span>}
          footer={<span className="text-muted">En o bajo el mínimo</span>}
        />
        <KpiCard
          label="Agotados"
          value={<span className={cn(r.outCount > 0 && 'text-danger-ink')}>{r.outCount}</span>}
          footer={<span className="text-muted">Sin existencia</span>}
        />
        <KpiCard
          label="Mermas del periodo"
          value={formatMoney(r.wasteCost)}
          footer={<span className="text-muted">Al costo promedio</span>}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Mostrar"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'alerts', label: 'Con alerta' },
            { value: 'moved', label: 'Con movimiento' },
          ]}
          className="w-full sm:w-auto"
        />
        <CsvButton
          label="Exportar CSV"
          disabled={!rows.length || report.isPlaceholderData}
          onExport={() => downloadCsv('inventario', r, inventoryColumns, rows)}
        />
      </div>

      {rows.length ? (
        <DataTable
          minWidth={900}
          head={[
            { label: 'Artículo' },
            { label: 'Existencia', numeric: true },
            { label: 'Estado' },
            { label: 'Costo prom.', numeric: true },
            { label: 'Valor', numeric: true },
            { label: 'Comprado', numeric: true },
            { label: 'Vendido', numeric: true },
            { label: 'Merma', numeric: true },
          ]}
        >
          {rows.map((i) => (
            <tr key={i.id}>
              <td className={cn(td, 'font-bold')}>
                {i.name}
                {!i.active ? (
                  <span className="ml-2 text-[13px] font-semibold text-muted">(inactivo)</span>
                ) : null}
              </td>
              <td className={tdNum}>{formatQty(i.stock, i.unit)}</td>
              <td className={td}>
                <StockBadge status={i.status} />
              </td>
              <td className={tdNum}>{formatUnitCost(i.averageCost)}</td>
              <td className={cn(tdNum, 'font-bold')}>{formatMoney(i.value)}</td>
              <td className={tdNum}>{qty(i.purchased, i.unit)}</td>
              <td className={tdNum}>{qty(i.sold, i.unit)}</td>
              <td className={cn(tdNum, i.wasted > 0 && 'text-danger-ink')}>
                {qty(i.wasted, i.unit)}
                {i.wasteCost > 0 ? (
                  <span className="block text-[12px]">{formatMoney(i.wasteCost)}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyState
          title={
            filter === 'alerts'
              ? 'Ningún artículo tiene alerta. ¡Todo en orden!'
              : 'Sin artículos que mostrar.'
          }
        />
      )}
      <p className="text-[13px] text-muted">
        Existencia, estado y valor son de este momento. Comprado, vendido y merma corresponden al
        periodo elegido.
      </p>
    </Refreshing>
  );
}
