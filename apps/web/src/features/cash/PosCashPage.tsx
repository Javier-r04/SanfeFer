import type { CashSessionDto } from '@sanfefer/shared';
import { ArrowDownToLine, ArrowUpFromLine, Lock, Printer, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useFloor } from '@/features/pos/api';
import { PosHeader } from '@/features/pos/components';
import { useSettings } from '@/features/settings/api';
import { errorMessage } from '@/lib/api';
import { formatMoney, formatTime } from '@/lib/format';
import { printInBrowser } from '@/printing/print';
import { toast } from '@/stores/toast';
import { useCurrentCash, useOpenCash } from './api';
import { CloseCashDialog, MovementDialog } from './CashDialogs';
import { CashSummary } from './CashSummary';
import { cashCloseDocument } from './close-documents';

function OpenCashForm() {
  const openCash = useOpenCash();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || !(Number(amount) >= 0))
      return setError('Escribe el fondo inicial (puede ser 0)');
    openCash.mutate(
      { openingAmount: Number(amount) },
      {
        onSuccess: () => toast.success('Caja abierta. ¡Buen turno!'),
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning-ink">
          <Lock aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold">La caja está cerrada</h2>
          <p className="text-sm text-muted">
            Ábrela con el efectivo de cambio para empezar a cobrar.
          </p>
        </div>
      </div>
      <Field label="Fondo inicial (Q)" error={error ?? undefined}>
        {(a) => (
          <Input
            {...a}
            value={amount}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder="Ej. 300"
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
          />
        )}
      </Field>
      <Button type="submit" size="xl" loading={openCash.isPending}>
        Abrir caja
      </Button>
    </form>
  );
}

export function PosCashPage() {
  const cash = useCurrentCash();
  const floor = useFloor();
  const settings = useSettings();
  const [movement, setMovement] = useState<'IN' | 'OUT' | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<CashSessionDto | null>(null);
  const openTabs =
    (floor.data?.tables.reduce((s, t) => s + t.tabs.length, 0) ?? 0) +
    (floor.data?.walkIns.length ?? 0);

  return (
    <div className="flex flex-col">
      <PosHeader
        title="Caja"
        subtitle={
          cash.data
            ? `Abierta por ${cash.data.openedBy.name.split(' ')[0]} a las ${formatTime(cash.data.openedAt)}`
            : 'Apertura, movimientos y cierre'
        }
      />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {cash.isPending ? (
          <LoadingState />
        ) : cash.error ? (
          <ErrorState error={cash.error} onRetry={() => void cash.refetch()} />
        ) : closed ? (
          <>
            <div className="flex items-center gap-3">
              <Wallet aria-hidden="true" className="size-6 text-primary" />
              <h2 className="text-lg font-extrabold">Caja #{closed.id} cerrada</h2>
            </div>
            <CashSummary session={closed} />
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() =>
                  printInBrowser(
                    cashCloseDocument(closed, settings.data),
                    settings.data?.paperWidth ?? 80,
                  )
                }
              >
                <Printer aria-hidden="true" className="size-5" />
                Imprimir cierre
              </Button>
              <Button size="lg" className="flex-1" onClick={() => setClosed(null)}>
                Listo
              </Button>
            </div>
          </>
        ) : !cash.data ? (
          <OpenCashForm />
        ) : (
          <>
            <CashSummary session={cash.data} />
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" size="lg" onClick={() => setMovement('IN')}>
                <ArrowDownToLine aria-hidden="true" className="size-5" />
                Entrada
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setMovement('OUT')}>
                <ArrowUpFromLine aria-hidden="true" className="size-5" />
                Salida
              </Button>
            </div>
            <Button size="xl" onClick={() => setClosing(true)}>
              Cerrar caja · contar {formatMoney(cash.data.expectedCash)}
            </Button>
            <CloseCashDialog
              session={cash.data}
              openTabs={openTabs}
              open={closing}
              onClose={() => setClosing(false)}
              onClosed={(s) => {
                setClosing(false);
                setClosed(s);
              }}
            />
          </>
        )}
      </div>
      <MovementDialog type={movement} onClose={() => setMovement(null)} />
    </div>
  );
}
