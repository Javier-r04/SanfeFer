import { Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney, formatQty, formatUnitCost } from '@/lib/format';
import { toast } from '@/stores/toast';
import { usePurchase, useVoidPurchase } from './api';
import { formatBusinessDate } from './dates';

export function PurchaseDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const purchase = usePurchase(id);
  const voidPurchase = useVoidPurchase();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    setVoiding(false);
    setReason('');
    setReasonError(null);
  }, [id]);

  const p = purchase.data;

  const confirmVoid = () => {
    if (reason.trim().length < 3) return setReasonError('Indica el motivo de la anulación');
    if (!p) return;
    voidPurchase.mutate(
      { id: p.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Compra #${p.id} anulada; el inventario se ajustó.`);
          setVoiding(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      size="lg"
      title={p ? `Compra #${p.id}` : 'Compra'}
      description={
        p
          ? `${p.supplier.name} · ${formatBusinessDate(p.purchasedAt)}${p.invoiceNumber ? ` · factura ${p.invoiceNumber}` : ''}`
          : undefined
      }
      footer={
        p && p.status === 'RECEIVED' ? (
          voiding ? (
            <>
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setVoiding(false)}
              >
                No anular
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                loading={voidPurchase.isPending}
                onClick={confirmVoid}
              >
                Confirmar anulación
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 text-danger-ink"
                onClick={() => setVoiding(true)}
              >
                <Ban aria-hidden="true" className="size-5" />
                Anular compra
              </Button>
            </>
          )
        ) : undefined
      }
    >
      {purchase.isPending ? (
        <LoadingState />
      ) : purchase.error ? (
        <ErrorState error={purchase.error} onRetry={() => void purchase.refetch()} />
      ) : p ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {p.status === 'VOIDED' ? (
              <Badge tone="danger">Anulada</Badge>
            ) : (
              <Badge tone="primary">Recibida</Badge>
            )}
            <span>
              Registró {p.createdBy.name} el {formatDateTime(p.createdAt)}
            </span>
          </div>
          {p.status === 'VOIDED' ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-ink">
              Anulada por {p.voidedBy?.name} el {p.voidedAt ? formatDateTime(p.voidedAt) : ''}:{' '}
              {p.voidReason}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2/50 text-left text-muted">
                  <th className="px-3 py-2.5 font-bold">Artículo</th>
                  <th className="px-3 py-2.5 text-right font-bold">Cantidad</th>
                  <th className="px-3 py-2.5 text-right font-bold">Costo u.</th>
                  <th className="px-3 py-2.5 text-right font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((l) => (
                  <tr key={l.id} className="border-t border-surface-2">
                    <td className="px-3 py-2.5 font-bold">{l.name}</td>
                    <td className="tabular px-3 py-2.5 text-right">
                      {formatQty(l.quantity, l.unit)}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">
                      {formatUnitCost(l.unitCost)}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-bold">
                      {formatMoney(l.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="px-3 py-3 text-right font-bold">
                    Total
                  </td>
                  <td className="tabular px-3 py-3 text-right text-lg font-extrabold">
                    {formatMoney(p.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {p.notes ? <p className="text-sm text-muted">Notas: {p.notes}</p> : null}

          {voiding ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-danger bg-danger-soft/40 p-4">
              <p className="text-sm font-semibold">
                Se descontará del inventario todo lo que entró con esta compra. Si ya se usó parte,
                no se podrá anular.
              </p>
              <Field label="Motivo de la anulación" error={reasonError ?? undefined}>
                {(a) => (
                  <Input
                    {...a}
                    value={reason}
                    autoFocus
                    onChange={(e) => {
                      setReason(e.target.value);
                      setReasonError(null);
                    }}
                    placeholder="Ej. factura registrada dos veces"
                  />
                )}
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
