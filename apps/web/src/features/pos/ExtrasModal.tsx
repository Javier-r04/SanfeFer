import { validateModifierSelection, type MenuProduct } from '@sanfefer/shared';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { selectionRule } from '@/features/catalog/catalog-utils';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { Stepper } from './components';
import { QUICK_NOTES } from './pos-utils';

export interface ExtrasResult {
  quantity: number;
  note: string;
  modifierOptionIds: number[];
  modifiersLabel: string;
  unitPrice: number;
}

/** Hoja para elegir extras, nota y cantidad de un producto. */
export function ExtrasModal({
  product,
  onClose,
  onAdd,
}: {
  product: MenuProduct | null;
  onClose: () => void;
  onAdd: (result: ExtrasResult) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setSelected([]);
    setNote('');
    setQuantity(1);
    setShowErrors(false);
  }, [product]);

  const { errors } = useMemo(
    () => validateModifierSelection(product?.modifierGroups ?? [], selected),
    [product, selected],
  );
  if (!product) return null;

  const options = product.modifierGroups.flatMap((g) => g.options);
  const chosen = options.filter((o) => selected.includes(o.id));
  const unitPrice = product.price + chosen.reduce((s, o) => s + o.priceDelta, 0);

  const toggle = (groupId: number, optionId: number) => {
    const group = product.modifierGroups.find((g) => g.id === groupId)!;
    const groupIds = group.options.map((o) => o.id);
    setSelected((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      // Elección única: reemplaza la opción anterior del grupo.
      if (group.maxSelect === 1)
        return [...current.filter((id) => !groupIds.includes(id)), optionId];
      const inGroup = current.filter((id) => groupIds.includes(id)).length;
      return inGroup >= group.maxSelect ? current : [...current, optionId];
    });
  };

  const add = () => {
    if (Object.keys(errors).length) return setShowErrors(true);
    onAdd({
      quantity,
      note: note.trim(),
      modifierOptionIds: selected,
      modifiersLabel: chosen.map((o) => o.name).join(' · '),
      unitPrice,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      description={`${product.description ? `${product.description} · ` : ''}${formatMoney(product.price)}`}
      footer={
        <div className="flex w-full items-center gap-3">
          <Stepper value={quantity} onChange={setQuantity} label="Cantidad" />
          <Button size="xl" className="flex-1" onClick={add}>
            Agregar · {formatMoney(unitPrice * quantity)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {product.modifierGroups.map((g) => {
          const error = showErrors ? errors[g.id] : undefined;
          return (
            <fieldset key={g.id} className="flex flex-col gap-2">
              <legend className="mb-2 flex w-full items-center justify-between gap-2">
                <span className="text-base font-extrabold">{g.name}</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-extrabold',
                    g.minSelect > 0 ? 'bg-danger-soft text-danger-ink' : 'text-muted',
                  )}
                >
                  {selectionRule(g.minSelect, g.maxSelect)}
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {g.options.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role={g.maxSelect === 1 ? 'radio' : 'checkbox'}
                      aria-checked={on}
                      onClick={() => toggle(g.id, o.id)}
                      className={cn(
                        'flex min-h-13 items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-[15px] font-bold',
                        on
                          ? 'border-2 border-primary bg-primary-soft text-primary-ink'
                          : 'border-[1.5px] border-border',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {on ? (
                          <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} />
                        ) : null}
                        {o.name}
                      </span>
                      {o.priceDelta > 0 ? (
                        <span className="text-[13px] font-semibold">
                          +{formatMoney(o.priceDelta)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {error ? (
                <p role="alert" className="text-sm font-semibold text-danger-ink">
                  {error}
                </p>
              ) : null}
            </fieldset>
          );
        })}

        <div className="flex flex-col gap-2">
          <Field label="Nota para barra (opcional)">
            {(a) => (
              <Input
                {...a}
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. poco hielo"
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_NOTES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote((v) => (v ? `${v}, ${n.toLowerCase()}` : n))}
                className="min-h-9 rounded-full border border-border bg-bg px-3 text-[13px] font-semibold text-muted"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
