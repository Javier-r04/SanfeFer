import type { OrderItemDto, TabDto } from '@sanfefer/shared';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useFloor, useMoveItems } from './api';
import { Stepper } from './components';

type Destination = { kind: 'new' } | { kind: 'tab'; id: number };

/**
 * Mover productos a otra cuenta, o "dividir": pasarlos a una cuenta nueva de la misma mesa.
 * Se puede mover solo una parte de una línea (1 de 3 cervezas).
 */
export function MoveItemsModal({
  tab,
  mode,
  onClose,
}: {
  tab: TabDto;
  mode: 'move' | 'split' | null;
  onClose: () => void;
}) {
  const floor = useFloor();
  const move = useMoveItems();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    setSelected(new Map());
    setDestination(mode === 'split' ? { kind: 'new' } : null);
  }, [mode]);

  const items = useMemo(
    () => tab.orders.flatMap((o) => o.items).filter((i) => i.status !== 'CANCELLED'),
    [tab.orders],
  );
  const otherTabs = useMemo(() => {
    const all = [
      ...(floor.data?.tables.flatMap((t) => t.tabs.map((x) => ({ ...x, place: t.name }))) ?? []),
      ...(floor.data?.walkIns.map((x) => ({ ...x, place: 'Sin mesa' })) ?? []),
    ];
    // Primero las cuentas de la misma mesa.
    return all
      .filter((x) => x.id !== tab.id)
      .sort((a, b) => Number(b.tableId === tab.tableId) - Number(a.tableId === tab.tableId));
  }, [floor.data, tab.id, tab.tableId]);

  if (!mode) return null;

  const toggle = (item: OrderItemDto) =>
    setSelected((m) => {
      const next = new Map(m);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.quantity);
      return next;
    });
  const movedTotal = items.reduce(
    (s, i) => s + (selected.has(i.id) ? (i.lineTotal / i.quantity) * selected.get(i.id)! : 0),
    0,
  );

  const submit = () => {
    if (!selected.size) return toast.error('Elige al menos un producto.');
    if (!destination) return toast.error('Elige a qué cuenta moverlos.');
    move.mutate(
      {
        items: [...selected].map(([id, quantity]) => ({ id, quantity })),
        ...(destination.kind === 'tab'
          ? { targetTabId: destination.id }
          : {
              newTab: {
                tableId: tab.tableId,
                customerName: tab.tableId ? undefined : `${tab.customerName} (2)`,
              },
            }),
      },
      {
        onSuccess: ({ target }) => {
          toast.success(`Productos movidos a ${target.customerName}.`);
          onClose();
          if (mode === 'split') navigate(`/pos/cuentas/${target.id}`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'split' ? 'Dividir cuenta' : 'Mover productos'}
      description={
        mode === 'split'
          ? 'Elige lo que pasa a una cuenta nueva. Para pagar en partes iguales usa «Cobrar».'
          : 'Elige los productos y la cuenta de destino.'
      }
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={submit}
            loading={move.isPending}
            disabled={!selected.size || !destination}
          >
            Mover {selected.size ? formatMoney(movedTotal) : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2">
          {items.map((i) => {
            const on = selected.has(i.id);
            return (
              <li
                key={i.id}
                className={cn(
                  'flex flex-col gap-2 rounded-2xl border-[1.5px] p-3',
                  on ? 'border-primary bg-primary-soft/40' : 'border-border',
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(i)}
                  className="flex items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2',
                      on ? 'border-primary bg-primary text-on-primary' : 'border-border-strong',
                    )}
                  >
                    {on ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {i.quantity}× {i.productName}
                    </span>
                    {i.modifiers.length ? (
                      <span className="block text-[13px] text-muted">
                        {i.modifiers.map((m) => m.optionName).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular font-bold">{formatMoney(i.lineTotal)}</span>
                </button>
                {on && i.quantity > 1 ? (
                  <div className="flex items-center justify-between pl-9">
                    <span className="text-sm text-muted">¿Cuántos?</span>
                    <Stepper
                      value={selected.get(i.id)!}
                      max={i.quantity}
                      label={`Cantidad de ${i.productName} a mover`}
                      size="md"
                      onChange={(q) => setSelected((m) => new Map(m).set(i.id, q))}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-extrabold">Mover a</legend>
          <button
            type="button"
            role="radio"
            aria-checked={destination?.kind === 'new'}
            onClick={() => setDestination({ kind: 'new' })}
            className={cn(
              'min-h-12 rounded-2xl border-[1.5px] px-4 py-2 text-left font-bold',
              destination?.kind === 'new'
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border',
            )}
          >
            {tab.table ? `Cuenta nueva en ${tab.table.name}` : 'Cuenta nueva sin mesa'}
          </button>
          {otherTabs.map((x) => {
            const on = destination?.kind === 'tab' && destination.id === x.id;
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDestination({ kind: 'tab', id: x.id })}
                className={cn(
                  'flex min-h-12 items-center justify-between rounded-2xl border-[1.5px] px-4 py-2 text-left',
                  on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-border',
                )}
              >
                <span className="font-bold">
                  {x.customerName} <span className="font-semibold text-muted">· {x.place}</span>
                </span>
                <span className="tabular text-sm font-bold">{formatMoney(x.subtotal)}</span>
              </button>
            );
          })}
        </fieldset>
      </div>
    </Modal>
  );
}
