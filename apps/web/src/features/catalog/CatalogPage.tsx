import { Tabs, useTab } from '@/components/ui/Tabs';
import { PageHeader } from '@/features/common/ComingSoon';
import { CategoriesView } from './CategoriesView';
import { ModifierGroupsView } from './ModifierGroupsView';
import { ProductsView } from './ProductsView';

const TABS = ['products', 'categories', 'extras'] as const;

export function CatalogPage() {
  const [tab, setTab] = useTab(TABS, 'products');
  return (
    <div>
      <PageHeader
        title="Productos y menú"
        subtitle="Lo que se vende en el POS, con su receta y sus extras."
      />
      <Tabs
        label="Secciones del menú"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'products', label: 'Productos' },
          { value: 'categories', label: 'Categorías' },
          { value: 'extras', label: 'Extras' },
        ]}
      />
      {tab === 'products' ? (
        <ProductsView />
      ) : tab === 'categories' ? (
        <CategoriesView />
      ) : (
        <ModifierGroupsView />
      )}
    </div>
  );
}
