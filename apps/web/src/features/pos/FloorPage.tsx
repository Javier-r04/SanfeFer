import type { FloorTableDto, TabSummaryDto } from '@sanfefer/shared';
import { Plus, UserRound, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useSession } from '@/features/auth/api';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { useFloor } from './api';
import { PosHeader } from './components';
import { OpenTabModal } from './OpenTabModal';
import { timeAgo, useNow } from './pos-utils';

function tableTotals(t: FloorTableDto) {
  return {
    subtotal: t.tabs.reduce((s, x) => s + x.subtotal, 0),
    openedAt: t.tabs.map((x) => x.openedAt).sort()[0],
  };
}

/** Nombres de las cuentas de la mesa, sin los automáticos ("Cliente 1"). */
function tableLabel(t: FloorTableDto) {
  const names = t.tabs.map((x) => x.customerName).filter((n) => !/^cliente \d+$/i.test(n));
  return names.length ? names.join(', ') : null;
}

function WalkInRow({ tab, now, onOpen }: { tab: TabSummaryDto; now: number; onOpen: () => void }) {
  const initials = tab.customerName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-2 text-left"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary-soft text-sm font-extrabold text-secondary-ink"
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{tab.customerName}</span>
        <span className="block text-xs text-muted">
          {tab.itemCount} producto{tab.itemCount === 1 ? '' : 's'} · {timeAgo(tab.openedAt, now)}
        </span>
      </span>
      <span className="tabular font-extrabold">{formatMoney(tab.subtotal)}</span>
    </button>
  );
}

export function FloorPage() {
  const floor = useFloor();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const now = useNow();
  const [zone, setZone] = useState<string>('Todas');
  /** undefined = cerrado; null = cliente sin mesa; número = mesa elegida. */
  const [opening, setOpening] = useState<number | null | undefined>(undefined);

  const zones = useMemo(
    () => [
      'Todas',
      ...new Set((floor.data?.tables ?? []).map((t) => t.zone).filter((z): z is string => !!z)),
    ],
    [floor.data],
  );
  const tables = (floor.data?.tables ?? []).filter((t) => zone === 'Todas' || t.zone === zone);

  const onTable = (t: FloorTableDto) => {
    if (t.tabs.length > 0) return navigate(`/pos/cuentas/${t.tabs[0]!.id}`);
    // Mesa libre: se pregunta el nombre (opcional) y se va directo a tomar la orden.
    setOpening(t.id);
  };

  return (
    <div className="flex flex-col">
      <PosHeader title="Mesas" subtitle={`Hola, ${user?.name.split(' ')[0] ?? ''}`} />
      {floor.isPending ? (
        <LoadingState label="Cargando mesas…" />
      ) : floor.error ? (
        <ErrorState error={floor.error} onRetry={() => void floor.refetch()} />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 py-3 sm:px-4">
          {zones.length > 2 ? (
            <div
              role="radiogroup"
              aria-label="Zona"
              className="-mx-1 flex gap-2 overflow-x-auto px-1"
            >
              {zones.map((z) => (
                <button
                  key={z}
                  type="button"
                  role="radio"
                  aria-checked={zone === z}
                  onClick={() => setZone(z)}
                  className={cn(
                    'h-10 shrink-0 rounded-full px-4 text-sm font-bold',
                    zone === z ? 'bg-text text-bg' : 'border-[1.5px] border-border bg-surface',
                  )}
                >
                  {z}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {tables.map((t) => {
              const busy = t.tabs.length > 0;
              const { subtotal, openedAt } = tableTotals(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTable(t)}
                  aria-label={
                    busy
                      ? `${t.name}, ${t.tabs.length} cuenta${t.tabs.length === 1 ? '' : 's'}, ${formatMoney(subtotal)}`
                      : `${t.name}, libre`
                  }
                  className={cn(
                    'flex h-24 flex-col justify-between rounded-2xl p-2.5 text-left transition active:scale-[0.98]',
                    busy
                      ? 'border-2 border-primary bg-primary-soft text-primary-ink'
                      : 'border-[1.5px] border-border bg-surface',
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-1">
                    <span className="text-[15px] leading-tight font-extrabold">{t.name}</span>
                    {t.tabs.length > 1 ? (
                      <span
                        aria-hidden="true"
                        title={`${t.tabs.length} cuentas`}
                        className="tabular flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-on-primary"
                      >
                        <UsersRound className="size-3" strokeWidth={2.6} />
                        {t.tabs.length}
                      </span>
                    ) : null}
                  </span>
                  {busy ? (
                    <span className="flex flex-col">
                      <span className="tabular text-[13px] font-extrabold">
                        {formatMoney(subtotal)}
                      </span>
                      <span className="truncate text-[11px] font-semibold">
                        {tableLabel(t) ?? (openedAt ? timeAgo(openedAt, now) : '')}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Libre</span>
                  )}
                </button>
              );
            })}
          </div>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">Clientes sin mesa</h2>
              <span className="text-sm text-muted">{floor.data.walkIns.length} abiertas</span>
            </div>
            {floor.data.walkIns.map((tab) => (
              <WalkInRow
                key={tab.id}
                tab={tab}
                now={now}
                onOpen={() => navigate(`/pos/cuentas/${tab.id}`)}
              />
            ))}
            <button
              type="button"
              onClick={() => setOpening(null)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border-strong font-bold text-primary-ink"
            >
              <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
              Nuevo cliente sin mesa
            </button>
          </section>
          {floor.data.tables.length === 0 ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <UserRound aria-hidden="true" className="size-4" /> No hay mesas configuradas.
              {user?.role === 'ADMIN' ? (
                <Link to="/admin/mesas" className="font-bold text-primary-ink underline">
                  Crear mesas
                </Link>
              ) : (
                <span>El administrador las crea en Admin → Mesas.</span>
              )}
            </p>
          ) : null}
        </div>
      )}
      <OpenTabModal
        open={opening !== undefined}
        tableId={opening ?? null}
        onClose={() => setOpening(undefined)}
      />
    </div>
  );
}
