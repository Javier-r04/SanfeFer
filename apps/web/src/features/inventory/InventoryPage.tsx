import { Tabs, useTab } from '@/components/ui/Tabs';
import { PageHeader } from '@/features/common/ComingSoon';
import { useInventorySummary } from './api';
import { ItemsView } from './ItemsView';
import { MovementsView } from './MovementsView';

const TABS = ['items', 'movements'] as const;

export function InventoryPage() {
  const [tab, setTab] = useTab(TABS, 'items');
  const summary = useInventorySummary();
  const alerts = (summary.data?.lowCount ?? 0) + (summary.data?.outCount ?? 0);
  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Insumos y productos de reventa. Cada venta descontará stock según la receta."
      />
      <Tabs
        label="Vistas de inventario"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'items', label: 'Artículos', badge: alerts },
          { value: 'movements', label: 'Movimientos' },
        ]}
      />
      {tab === 'items' ? <ItemsView /> : <MovementsView />}
    </div>
  );
}
