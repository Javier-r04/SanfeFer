import { Tabs, useTab } from '@/components/ui/Tabs';
import { PageHeader } from '@/features/common/ComingSoon';
import { InventoryTab } from './InventoryTab';
import { PeriodPicker, useReportRange } from './PeriodPicker';
import { ProductsTab } from './ProductsTab';
import { rangeLabel } from './report-format';
import { SellersTab } from './SellersTab';
import { SummaryTab } from './SummaryTab';

const TABS = ['resumen', 'productos', 'vendedores', 'inventario'] as const;

export function ReportsPage() {
  const [tab, setTab] = useTab(TABS, 'resumen');
  const { range, groupBy, setRange, setGroupBy } = useReportRange();
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Reportes"
        subtitle="Cuentas cobradas según la fecha de cobro (día calendario, hora de Guatemala)."
      />
      {/* Un solo filtro de periodo arriba: todo lo de abajo usa el mismo rango. */}
      <div className="mb-5 flex flex-col gap-2">
        <PeriodPicker range={range} onChange={setRange} />
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {rangeLabel(range.from, range.to)}
        </p>
      </div>
      <Tabs
        label="Reportes"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'resumen', label: 'Resumen' },
          { value: 'productos', label: 'Productos' },
          { value: 'vendedores', label: 'Vendedores' },
          { value: 'inventario', label: 'Inventario' },
        ]}
      />
      {tab === 'resumen' ? (
        <SummaryTab range={range} groupBy={groupBy} onGroupBy={setGroupBy} />
      ) : null}
      {tab === 'productos' ? <ProductsTab range={range} /> : null}
      {tab === 'vendedores' ? <SellersTab range={range} /> : null}
      {tab === 'inventario' ? <InventoryTab range={range} /> : null}
    </div>
  );
}
