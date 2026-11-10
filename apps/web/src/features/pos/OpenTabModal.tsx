import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { errorMessage } from '@/lib/api';
import { useFloor, useOpenTab } from './api';

/**
 * Abrir una cuenta: el vendedor elige la mesa (o "Sin mesa") y el nombre de la persona.
 * - Mesa libre: el nombre es opcional (queda "Cliente 1").
 * - Mesa con cuentas abiertas: es una cuenta separada y pide el nombre de quien paga aparte.
 * - Sin mesa: el nombre es obligatorio.
 */
export function OpenTabModal({
  open,
  onClose,
  tableId: presetTable,
}: {
  open: boolean;
  onClose: () => void;
  /** Mesa preseleccionada; null = cliente sin mesa. */
  tableId: number | null;
}) {
  const floor = useFloor();
  const openTab = useOpenTab();
  const navigate = useNavigate();
  const [tableId, setTableId] = useState<string>('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTableId(presetTable ? String(presetTable) : '');
    setName('');
    setError(null);
  }, [open, presetTable]);

  const tables = floor.data?.tables ?? [];
  const table = tables.find((t) => String(t.id) === tableId) ?? null;
  const openCount = table?.tabs.length ?? 0;
  const separate = openCount > 0;
  const nameRequired = !table || separate;
  const takenNames = new Set(table?.tabs.map((t) => t.customerName.toLowerCase()) ?? []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (nameRequired && !trimmed) {
      return setError(
        separate ? 'Escribe el nombre de quien paga aparte' : 'Escribe el nombre del cliente',
      );
    }
    if (trimmed && takenNames.has(trimmed.toLowerCase())) {
      return setError('Ya hay una cuenta con ese nombre en esta mesa');
    }
    openTab.mutate(
      { tableId: table?.id ?? null, ...(trimmed ? { customerName: trimmed } : {}) },
      {
        onSuccess: ({ tab }) => {
          onClose();
          navigate(`/pos/cuentas/${tab.id}/orden`);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  const title = table
    ? separate
      ? `Cuenta separada · ${table.name}`
      : table.name
    : 'Cliente sin mesa';
  const description = table
    ? separate
      ? `Ya ${openCount === 1 ? 'hay 1 cuenta' : `hay ${openCount} cuentas`} en esta mesa: ${table.tabs.map((t) => t.customerName).join(', ')}.`
      : 'Abre la cuenta de la mesa. Si van a pagar por separado, escribe el nombre de la persona.'
    : 'Una cuenta a nombre del cliente, por ejemplo quien pide en la barra o espera de pie.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="open-tab-form"
            size="lg"
            className="flex-1"
            loading={openTab.isPending}
          >
            Abrir cuenta
          </Button>
        </>
      }
    >
      <form id="open-tab-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Mesa">
          {(a) => (
            <Select
              {...a}
              value={tableId}
              onChange={(e) => {
                setTableId(e.target.value);
                setError(null);
              }}
            >
              <option value="">Sin mesa</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.zone ? ` · ${t.zone}` : ''}
                  {t.tabs.length
                    ? ` (${t.tabs.length} cuenta${t.tabs.length === 1 ? '' : 's'})`
                    : ' (libre)'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={nameRequired ? 'Nombre del cliente' : 'Nombre del cliente (opcional)'}
          error={error ?? undefined}
          hint={
            nameRequired
              ? separate
                ? 'Cada persona que paga aparte tiene su propia cuenta.'
                : undefined
              : 'Si lo dejas vacío, la cuenta queda como "Cliente 1".'
          }
        >
          {(a) => (
            <Input
              {...a}
              value={name}
              autoFocus={nameRequired}
              autoComplete="off"
              maxLength={40}
              placeholder={separate ? 'Ej. Andrea' : 'Ej. Don Beto'}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
