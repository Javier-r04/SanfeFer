import type { ProductReportRowDto } from '@sanfefer/shared';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useProductsReport, type ReportRange } from './api';
import { BarList, ChartCard } from './charts';
import { downloadCsv, productColumns } from './csv-export';
import { CsvButton, DataTable, Refreshing, td, tdNum } from './ReportParts';

const SORTS = {
  top: { label: 'Más vendidos', fn: (a: Row, b: Row) => b.units - a.units || b.sales - a.sales },
  bottom: {
    label: 'Menos vendidos',
    fn: (a: Row, b: Row) => a.units - b.units || a.sales - b.sales,
  },
  sales: { label: 'Mayor venta (Q)', fn: (a: Row, b: Row) => b.sales - a.sales },
  profit: { label: 'Mayor utilidad', fn: (a: Row, b: Row) => b.profit - a.profit },
  margin: {
    label: 'Menor margen',
    fn: (a: Row, b: Row) => (a.margin ?? Infinity) - (b.margin ?? Infinity),
  },
} as const;
type Row = ProductReportRowDto;
type SortKey = keyof typeof SORTS;

const sumCents = (rows: Row[], key: 'sales' | 'cost' | 'profit') =>
  rows.reduce((s, r) => s + Math.round(r[key] * 100), 0) / 100;

export function ProductsTab({ range }: { range: ReportRange }) {
  const report = useProductsReport(range);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('top');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return (report.data?.products ?? [])
      .filter(
        (p) =>
          (!category || p.category === category) &&
          (!q || p.name.toLocaleLowerCase('es').includes(q)),
      )
      .sort((a, b) => SORTS[sort].fn(a, b) || a.name.localeCompare(b.name, 'es'));
  }, [report.data, category, sort, query]);

  if (report.isPending) return <LoadingState />;
  if (report.error || !report.data)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const units = rows.reduce((s, r) => s + r.units, 0);
  const sales = sumCents(rows, 'sales');
  const profit = sumCents(rows, 'profit');

  return (
    <Refreshing active={report.isPlaceholderData}>
      <ChartCard
        title="Ventas por categoría"
        subtitle="A precio de carta, antes de descuentos de cuenta"
        chart={
          <BarList
            items={[...data.categories]
              .sort((a, b) => b.sales - a.sales)
              .map((c) => ({ key: c.name, label: c.name, value: c.sales, note: `${c.units} u` }))}
            formatValue={formatMoney}
            empty="No hay categorías."
          />
        }
        table={
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 font-bold">Categoría</th>
                <th className="py-1.5 text-right font-bold">Unidades</th>
                <th className="py-1.5 text-right font-bold">Ventas</th>
                <th className="py-1.5 text-right font-bold">Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.name} className="border-t border-surface-2">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right">{c.units}</td>
                  <td className="py-2 text-right">{formatMoney(c.sales)}</td>
                  <td className="py-2 text-right font-bold">{formatMoney(c.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Field label="Buscar" className="col-span-2 sm:w-64">
          {(a) => (
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
              />
              <Input
                {...a}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Producto"
                className="pl-10"
              />
            </span>
          )}
        </Field>
        <Field label="Categoría" className="sm:w-48">
          {(a) => (
            <Select {...a} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {data.categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ordenar" className="sm:w-48">
          {(a) => (
            <Select {...a} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="col-span-2 sm:ml-auto">
          <CsvButton
            label="Exportar CSV"
            disabled={!rows.length || report.isPlaceholderData}
            onExport={() => downloadCsv('productos', data, productColumns, rows)}
          />
        </div>
      </div>

      {rows.length ? (
        <DataTable
          minWidth={680}
          head={[
            { label: 'Producto' },
            { label: 'Unidades', numeric: true },
            { label: 'Ventas', numeric: true },
            { label: 'Costo', numeric: true },
            { label: 'Utilidad', numeric: true },
            { label: 'Margen', numeric: true },
          ]}
          foot={
            <tr>
              <td className="px-4 py-3">Total ({rows.length})</td>
              <td className="px-4 py-3 text-right">{units}</td>
              <td className="px-4 py-3 text-right">{formatMoney(sales)}</td>
              <td className="px-4 py-3 text-right">{formatMoney(sumCents(rows, 'cost'))}</td>
              <td className="px-4 py-3 text-right">{formatMoney(profit)}</td>
              <td className="px-4 py-3 text-right">
                {sales > 0 ? formatPercent(profit / sales) : '—'}
              </td>
            </tr>
          }
        >
          {rows.map((p) => (
            <tr key={p.productId} className={cn(p.units === 0 && 'text-muted')}>
              <td className={td}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-text">{p.name}</span>
                  {!p.active ? <Badge>Inactivo</Badge> : null}
                </span>
                <span className="text-[13px] text-muted">{p.category}</span>
              </td>
              <td className={tdNum}>{p.units}</td>
              <td className={tdNum}>{formatMoney(p.sales)}</td>
              <td className={tdNum}>{formatMoney(p.cost)}</td>
              <td className={cn(tdNum, 'font-bold', p.profit < 0 && 'text-danger-ink')}>
                {formatMoney(p.profit)}
              </td>
              <td className={tdNum}>{p.margin === null ? '—' : formatPercent(p.margin)}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyState title="Ningún producto coincide con el filtro." />
      )}
      <p className="text-[13px] text-muted">
        Las ventas son a precio de carta (con extras); los descuentos a la cuenta completa aparecen
        en el resumen. El costo es el de la receta al momento de vender.
      </p>
    </Refreshing>
  );
}
