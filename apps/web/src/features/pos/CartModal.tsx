import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { formatMoney } from '@/lib/format';
import { cartTotals, useCart, useTabCart } from './cart';
import { Stepper } from './components';

/** Revisión de la orden antes de enviarla: cantidades, notas y quitar líneas. */
export function CartModal({
  tabId,
  open,
  onClose,
  onSend,
  sending,
}: {
  tabId: number;
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  const lines = useTabCart(tabId);
  const { setQuantity, setNote, remove } = useCart();
  const { units, total } = cartTotals(lines);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Orden por enviar"
      description={`${units} producto${units === 1 ? '' : 's'} · ${formatMoney(total)}`}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Seguir agregando
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={onSend}
            loading={sending}
            disabled={!lines.length}
          >
            Enviar a barra
          </Button>
        </>
      }
    >
      {lines.length === 0 ? (
        <p className="py-6 text-center text-muted">La orden está vacía.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.key} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{l.name}</p>
                  {l.modifiersLabel ? (
                    <p className="text-[13px] text-muted">{l.modifiersLabel}</p>
                  ) : null}
                </div>
                <span className="tabular font-extrabold">
                  {formatMoney(l.unitPrice * l.quantity)}
                </span>
              </div>
              <Input
                aria-label={`Nota para ${l.name}`}
                value={l.note}
                maxLength={120}
                placeholder="Nota (opcional)"
                className="h-11"
                onChange={(e) => setNote(tabId, l.key, e.target.value)}
              />
              <div className="flex items-center justify-between">
                <Stepper
                  value={l.quantity}
                  onChange={(q) => setQuantity(tabId, l.key, q)}
                  min={1}
                  label={`Cantidad de ${l.name}`}
                  size="md"
                />
                <Button
                  variant="ghost"
                  className="text-danger-ink"
                  onClick={() => remove(tabId, l.key)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
