import type { CashSessionDto } from '@sanfefer/shared';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatTime } from '@/lib/format';

/** Desglose de una sesión de caja (abierta o cerrada). */
export function CashSummary({ session }: { session: CashSessionDto }) {
  const rows: [string, number, string?][] = [
    ['Fondo inicial', session.openingAmount],
    ['Ventas en efectivo', session.cashSales],
    ['Entradas', session.movementsIn],
    ['Salidas', -session.movementsOut],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <dl className="flex flex-col gap-1.5 text-[15px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular font-semibold">
                {value < 0 ? `−${formatMoney(-value)}` : formatMoney(value)}
              </dd>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
            <dt className="font-extrabold">Debe haber en caja</dt>
            <dd className="tabular text-2xl font-extrabold">{formatMoney(session.expectedCash)}</dd>
          </div>
          {session.countedCash !== null ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">Contado</dt>
                <dd className="tabular font-semibold">{formatMoney(session.countedCash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold">Diferencia</dt>
                <dd
                  className={cn(
                    'tabular font-extrabold',
                    session.difference === 0
                      ? 'text-primary-ink'
                      : (session.difference ?? 0) > 0
                        ? 'text-secondary-ink'
                        : 'text-danger-ink',
                  )}
                >
                  {session.difference === 0
                    ? 'Cuadra'
                    : (session.difference ?? 0) > 0
                      ? `Sobran ${formatMoney(session.difference!)}`
                      : `Faltan ${formatMoney(-session.difference!)}`}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
      <div className="flex justify-between rounded-2xl bg-surface-2 px-4 py-3 text-[15px]">
        <span className="text-muted">Ventas con tarjeta (no entran a la caja)</span>
        <span className="tabular font-bold">{formatMoney(session.cardSales)}</span>
      </div>
      {session.movements.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-extrabold">Entradas y salidas</h3>
          <ul className="flex flex-col gap-1.5">
            {session.movements.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-bold">{m.reason}</span>
                  <span className="text-muted">
                    {' '}
                    · {m.user.name.split(' ')[0]} · {formatTime(m.createdAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'tabular font-extrabold',
                    m.type === 'IN' ? 'text-primary-ink' : 'text-danger-ink',
                  )}
                >
                  {m.type === 'IN' ? '+' : '−'}
                  {formatMoney(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-muted">
        Abierta por {session.openedBy.name} el {formatDateTime(session.openedAt)}
        {session.closedAt
          ? ` · cerrada por ${session.closedBy?.name} el ${formatDateTime(session.closedAt)}`
          : ''}
      </p>
    </div>
  );
}
