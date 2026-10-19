import type { TabDto } from '@sanfefer/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { errorMessage } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useCancelTab, useFloor, useUpdateTab } from './api';

/** Cambiar el nombre, mover a otra mesa (o dejar sin mesa) o cancelar una cuenta vacía. */
export function TabOptionsModal({
  tab,
  open,
  onClose,
}: {
  tab: TabDto;
  open: boolean;
  onClose: () => void;
}) {
  const floor = useFloor();
  const update = useUpdateTab();
  const cancelTab = useCancelTab();
  const navigate = useNavigate();
  const [name, setName] = useState(tab.customerName);
  const [tableId, setTableId] = useState<string>(tab.tableId ? String(tab.tableId) : '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(tab.customerName);
    setTableId(tab.tableId ? String(tab.tableId) : '');
    setError(null);
  }, [open, tab]);

  const save = () => {
    const nextTable = tableId ? Number(tableId) : null;
    if (!name.trim()) return setError('Escribe el nombre del cliente');
    const input = {
      ...(name.trim() !== tab.customerName ? { customerName: name.trim() } : {}),
      ...(nextTable !== tab.tableId ? { tableId: nextTable } : {}),
    };
    if (Object.keys(input).length === 0) return onClose();
    update.mutate(
      { id: tab.id, input },
      {
        onSuccess: () => {
          toast.success('Cuenta actualizada.');
          onClose();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  const empty = tab.itemCount === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Opciones de la cuenta"
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="lg" className="flex-1" onClick={save} loading={update.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nombre del cliente" error={error ?? undefined}>
          {(a) => (
            <Input {...a} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label="Mesa" hint="Mueve la cuenta a otra mesa o déjala como cliente sin mesa.">
          {(a) => (
            <Select {...a} value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Sin mesa</option>
              {floor.data?.tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.tabs.length && t.id !== tab.tableId ? ` (ocupada: ${t.tabs.length})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="border-t border-border pt-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full text-danger-ink"
            disabled={!empty}
            loading={cancelTab.isPending}
            onClick={() =>
              cancelTab.mutate(tab.id, {
                onSuccess: () => {
                  toast.success('Cuenta cancelada.');
                  navigate('/pos');
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Cancelar cuenta (abierta por error)
          </Button>
          {!empty ? (
            <p className="mt-2 text-sm text-muted">
              Solo se puede cancelar una cuenta sin productos.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
