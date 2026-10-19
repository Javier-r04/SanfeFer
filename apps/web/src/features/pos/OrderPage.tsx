import type { MenuProduct } from '@sanfefer/shared';
import { ChevronUp, Search, Send, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { CATEGORY_DOT } from '@/features/catalog/catalog-utils';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useMenu, useSendOrder, useTab } from './api';
import { CartModal } from './CartModal';
import { cartTotals, useCart, useTabCart } from './cart';
import { PosHeader } from './components';
import { ExtrasModal } from './ExtrasModal';

function ProductTile({
  product,
  inCart,
  onTap,
}: {
  product: MenuProduct;
  inCart: number;
  onTap: () => void;
}) {
  const out = product.stockStatus === 'OUT';
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${product.name}, ${formatMoney(product.price)}${inCart ? `, ${inCart} en la orden` : ''}${out ? ', sin existencia' : ''}`}
      className={cn(
        'relative flex h-24 flex-col items-start justify-between rounded-2xl p-3 text-left transition active:scale-[0.98]',
        inCart ? 'border-2 border-primary bg-primary-soft/50' : 'border border-border bg-surface',
        out && 'opacity-70',
      )}
    >
      <span className="line-clamp-2 pr-7 text-[15px] leading-tight font-bold">{product.name}</span>
      <span className="flex w-full items-center justify-between gap-1">
        <span className="tabular text-[15px] font-extrabold">{formatMoney(product.price)}</span>
        {out ? (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-extrabold text-danger-ink">
            Sin stock
          </span>
        ) : product.stockStatus === 'LOW' ? (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-extrabold text-warning-ink">
            Stock bajo
          </span>
        ) : null}
      </span>
      {inCart ? (
        <span className="tabular absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-primary text-sm font-extrabold text-on-primary">
          {inCart}
        </span>
      ) : null}
    </button>
  );
}

export function OrderPage() {
  const tabId = Number(useParams().tabId);
  const tab = useTab(tabId);
  const menu = useMenu();
  const send = useSendOrder();
  const navigate = useNavigate();
  const lines = useTabCart(tabId);
  const { add, clear } = useCart();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [extrasFor, setExtrasFor] = useState<MenuProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const categories = useMemo(() => menu.data ?? [], [menu.data]);
  const activeCategory = categories.find((c) => c.id === categoryId) ?? categories[0];
  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (searching && q)
      return categories.flatMap((c) => c.products).filter((p) => p.name.toLowerCase().includes(q));
    return activeCategory?.products ?? [];
  }, [categories, activeCategory, searching, query]);

  const countByProduct = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
    return m;
  }, [lines]);
  const { units, total } = cartTotals(lines);

  const tap = (p: MenuProduct) => {
    if (p.modifierGroups.length) return setExtrasFor(p);
    // Sin extras: un toque agrega uno.
    add(tabId, {
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      quantity: 1,
      note: '',
      modifierOptionIds: [],
      modifiersLabel: '',
    });
    navigator.vibrate?.(10);
  };

  const sendOrder = () => {
    if (!lines.length) return;
    send.mutate(
      {
        tabId,
        input: {
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            note: l.note || null,
            modifierOptionIds: l.modifierOptionIds,
          })),
        },
      },
      {
        onSuccess: ({ orderId, stockWarnings }) => {
          clear(tabId);
          setCartOpen(false);
          toast.success(`Comanda #${orderId} enviada a barra.`);
          if (stockWarnings.length)
            toast.info(`Revisa el inventario: ${stockWarnings.join('; ')}.`);
          navigate(`/pos/cuentas/${tabId}`, { replace: true });
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const title = tab.data
    ? tab.data.table
      ? `${tab.data.table.name} · ${tab.data.customerName}`
      : tab.data.customerName
    : 'Orden';

  return (
    <div className="flex min-h-dvh flex-col">
      <PosHeader
        title={title}
        subtitle="Nueva comanda"
        backTo={`/pos/cuentas/${tabId}`}
        backLabel="Volver a la cuenta"
        actions={
          <Button
            variant="outline"
            size="icon"
            aria-label={searching ? 'Cerrar búsqueda' : 'Buscar producto'}
            onClick={() => {
              setSearching((s) => !s);
              setQuery('');
            }}
          >
            {searching ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Search aria-hidden="true" className="size-5" />
            )}
          </Button>
        }
      />

      {menu.isPending || tab.isPending ? (
        <LoadingState label="Cargando menú…" />
      ) : menu.error || tab.error ? (
        <ErrorState error={menu.error ?? tab.error} onRetry={() => void menu.refetch()} />
      ) : tab.data.status !== 'OPEN' ? (
        <ErrorState
          error={new Error('Esta cuenta ya está cerrada; no se le pueden agregar productos.')}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 pt-3 pb-40 sm:px-4">
          {searching ? (
            <Input
              type="search"
              autoFocus
              aria-label="Buscar producto"
              placeholder="Buscar en todo el menú…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : (
            <div
              role="tablist"
              aria-label="Categorías"
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            >
              {categories.map((c) => {
                const active = c.id === activeCategory?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold',
                      active
                        ? 'bg-primary text-on-primary'
                        : 'border-[1.5px] border-border bg-surface',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2.5 rounded-full',
                        active ? 'bg-on-primary' : CATEGORY_DOT[c.color],
                      )}
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {products.length === 0 ? (
            <p className="py-10 text-center text-muted">
              {searching ? 'Ningún producto coincide.' : 'No hay productos en esta categoría.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductTile
                  key={p.id}
                  product={p}
                  inCart={countByProduct.get(p.id) ?? 0}
                  onTap={() => tap(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            disabled={!units}
            className="flex h-11 items-center justify-between px-1 text-[15px] font-semibold disabled:text-muted"
          >
            <span className="flex items-center gap-2">
              <ChevronUp aria-hidden="true" className="size-5" />
              {units
                ? `Ver orden · ${units} producto${units === 1 ? '' : 's'}`
                : 'Toca un producto para agregarlo'}
            </span>
            <span className="tabular text-lg font-extrabold">{formatMoney(total)}</span>
          </button>
          <Button size="xl" onClick={sendOrder} disabled={!units} loading={send.isPending}>
            <Send aria-hidden="true" className="size-5" />
            Enviar a barra
          </Button>
        </div>
      </div>

      <ExtrasModal
        product={extrasFor}
        onClose={() => setExtrasFor(null)}
        onAdd={(r) => {
          add(tabId, { productId: extrasFor!.id, name: extrasFor!.name, ...r });
          setExtrasFor(null);
        }}
      />
      <CartModal
        tabId={tabId}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onSend={sendOrder}
        sending={send.isPending}
      />
    </div>
  );
}
