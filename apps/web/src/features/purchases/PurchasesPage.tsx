import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Tabs, useTab } from '@/components/ui/Tabs';
import { PageHeader } from '@/features/common/ComingSoon';
import { PurchasesView } from './PurchasesView';
import { SuppliersView } from './SuppliersView';

const TABS = ['purchases', 'suppliers'] as const;

export function PurchasesPage() {
  const [tab, setTab] = useTab(TABS, 'purchases');
  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Cada compra suma al inventario y actualiza el costo promedio."
        actions={
          <Link
            to="/admin/compras/nueva"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-on-primary hover:brightness-95"
          >
            <Plus aria-hidden="true" className="size-5" />
            Nueva compra
          </Link>
        }
      />
      <Tabs
        label="Secciones de compras"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'purchases', label: 'Compras' },
          { value: 'suppliers', label: 'Proveedores' },
        ]}
      />
      {tab === 'purchases' ? <PurchasesView /> : <SuppliersView />}
    </div>
  );
}
