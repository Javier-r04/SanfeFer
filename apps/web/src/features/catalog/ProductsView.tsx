import type { ProductDto } from '@sanfefer/shared';
import { ArrowDown, ArrowUp, CupSoda, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/format';
import { toast } from '@/stores/toast';
import {
  useCategories,
  useDeleteProduct,
  useProducts,
  useReorderProducts,
  useUpdateProduct,
} from './api';
import { CATEGORY_DOT, moveId } from './catalog-utils';
import { ProductFormModal } from './ProductFormModal';

function Availability({ p }: { p: ProductDto }) {
  if (p.stockStatus === null)
    return <span className="text-sm text-muted">Sin control de stock</span>;
  if (p.stockStatus === 'OUT') return <Badge tone="danger">Agotado</Badge>;
  return (
    <Badge tone={p.stockStatus === 'LOW' ? 'warning' : 'primary'}>
      {p.stockStatus === 'LOW' ? `Stock bajo · para ${p.available}` : `Alcanza para ${p.available}`}
    </Badge>
  );
}

export function ProductsView() {
  const categories = useCategories();
  const products = useProducts();
  const update = useUpdateProduct();
  const reorder = useReorderProducts();
  const remove = useDeleteProduct();
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<ProductDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProductDto | null>(null);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (categories.data ?? [])
      .filter((c) => categoryId === 'all' || c.id === categoryId)
      .map((c) => ({
        category: c,
        // Todos los productos de la categoría, para reordenar sin perder los ocultos por el filtro.
        all: (products.data ?? []).filter((p) => p.categoryId === c.id),
        visible: (products.data ?? []).filter(
          (p) =>
            p.categoryId === c.id &&
            (showInactive || p.active) &&
            (!q || p.name.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.visible.length > 0 || (!q && categoryId !== 'all'));
  }, [categories.data, products.data, categoryId, search, showInactive]);

  const toggle = (p: ProductDto) =>
    update.mutate(
      { id: p.id, input: { active: !p.active } },
      {
        onSuccess: () =>
          toast.success(
            p.active ? `${p.name} ya no aparece en el POS.` : `${p.name} disponible en el POS.`,
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const move = (all: ProductDto[], p: ProductDto, dir: -1 | 1) => {
    const ids = moveId(
      all.map((x) => x.id),
      p.id,
      dir,
    );
    if (ids) reorder.mutate(ids, { onError: (e) => toast.error(errorMessage(e)) });
  };

  const openForm = (p?: ProductDto) => {
    setEditing(p);
    setFormOpen(true);
  };

  if (categories.isPending || products.isPending) return <LoadingState label="Cargando menú…" />;
  if (categories.error || products.error) {
    return (
      <ErrorState
        error={categories.error ?? products.error}
        onRetry={() => void products.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label="Buscar producto"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
        <Switch
          checked={showInactive}
          onChange={setShowInactive}
          label="Ver no disponibles"
          showLabel
        />
        <Button size="lg" onClick={() => openForm()} disabled={!categories.data.length}>
          <Plus aria-hidden="true" className="size-5" />
          Nuevo producto
        </Button>
      </div>

      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="radiogroup"
        aria-label="Categoría"
      >
        {[{ id: 'all' as const, name: 'Todas', color: null }, ...categories.data].map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold',
                active ? 'bg-text text-bg' : 'border-[1.5px] border-border bg-surface',
              )}
            >
              {c.color ? (
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 rounded-full', CATEGORY_DOT[c.color])}
                />
              ) : null}
              {c.name}
            </button>
          );
        })}
      </div>

      {!categories.data.length ? (
        <EmptyState
          icon={<CupSoda aria-hidden="true" className="size-8 text-muted" />}
          title="Primero crea una categoría."
        >
          Ve a la pestaña Categorías.
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CupSoda aria-hidden="true" className="size-8 text-muted" />}
          title="No hay productos con ese filtro."
        />
      ) : (
        groups.map(({ category, all, visible }) => (
          <section key={category.id} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <span
                aria-hidden="true"
                className={cn('size-3 rounded-full', CATEGORY_DOT[category.color])}
              />
              {category.name}
              <span className="text-sm font-semibold text-muted">{all.length}</span>
            </h2>
            {visible.length === 0 ? (
              <p className="text-sm text-muted">Sin productos.</p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {visible.map((p) => {
                  const index = all.findIndex((x) => x.id === p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-2 px-4 py-3 first:border-t-0"
                    >
                      <div className={cn('min-w-48 flex-1', !p.active && 'opacity-60')}>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-sm text-muted">
                          {p.description ??
                            (p.recipe.length
                              ? p.recipe.map((l) => l.name).join(', ')
                              : 'Sin receta')}
                          {p.modifierGroupIds.length
                            ? ` · ${p.modifierGroupIds.length} grupo${p.modifierGroupIds.length === 1 ? '' : 's'} de extras`
                            : ''}
                        </p>
                      </div>
                      <div className="w-28 text-right">
                        <p className="tabular font-extrabold">{formatMoney(p.price)}</p>
                        <p className="tabular text-xs text-muted">
                          costo {formatMoney(p.cost)}
                          {p.margin !== null && p.cost > 0 ? ` · ${formatPercent(p.margin)}` : ''}
                        </p>
                      </div>
                      <div className="w-48">
                        <Availability p={p} />
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <Switch
                          checked={p.active}
                          onChange={() => toggle(p)}
                          label={`${p.name} disponible`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(all, p, -1)}
                          disabled={index === 0 || reorder.isPending}
                          aria-label={`Subir ${p.name}`}
                          title="Subir"
                        >
                          <ArrowUp aria-hidden="true" className="size-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(all, p, 1)}
                          disabled={index === all.length - 1 || reorder.isPending}
                          aria-label={`Bajar ${p.name}`}
                          title="Bajar"
                        >
                          <ArrowDown aria-hidden="true" className="size-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openForm(p)}
                          aria-label={`Editar ${p.name}`}
                          title="Editar"
                        >
                          <Pencil aria-hidden="true" className="size-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger-ink"
                          onClick={() => setToDelete(p)}
                          aria-label={`Eliminar ${p.name}`}
                          title="Eliminar"
                        >
                          <Trash2 aria-hidden="true" className="size-[18px]" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        defaultCategoryId={categoryId === 'all' ? undefined : categoryId}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        tone="danger"
        title="Eliminar producto"
        confirmLabel="Eliminar"
        loading={remove.isPending}
        message={`¿Eliminar ${toDelete?.name ?? ''}? Si ya tiene ventas no se podrá; en ese caso apágalo para que no aparezca en el POS.`}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success(`${toDelete.name} eliminado.`),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </div>
  );
}
