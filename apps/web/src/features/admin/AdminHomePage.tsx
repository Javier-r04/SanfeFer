import { AlertTriangle, BarChart3, Boxes, CupSoda, Truck, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/features/common/ComingSoon';
import { useSession } from '@/features/auth/api';
import { StatCard } from '@/components/ui/States';
import { useDaily } from '@/features/cash/api';
import { useInventorySummary } from '@/features/inventory/api';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

const shortcuts = [
  {
    to: '/admin/productos',
    label: 'Productos y menú',
    text: 'Precios, recetas y extras',
    Icon: CupSoda,
    ready: true,
  },
  {
    to: '/admin/inventario',
    label: 'Inventario',
    text: 'Stock, entradas, mermas y conteos',
    Icon: Boxes,
    ready: true,
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    text: 'Vendedores y sus PIN',
    Icon: Users,
    ready: true,
  },
  {
    to: '/admin/compras',
    label: 'Compras',
    text: 'Proveedores y compras que suben el stock',
    Icon: Truck,
    ready: true,
  },
  { to: '/admin/caja', label: 'Caja', text: 'Cierre del día y arqueos', Icon: Wallet, ready: true },
  {
    to: '/admin/reportes',
    label: 'Reportes',
    text: 'Ventas, utilidad, productos y vendedores; exporta a CSV',
    Icon: BarChart3,
    ready: true,
  },
];

export function AdminHomePage() {
  const { data: user } = useSession();
  const summary = useInventorySummary();
  const daily = useDaily();
  const low = summary.data?.lowCount ?? 0;
  const out = summary.data?.outCount ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hola, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="Resumen de hoy. Para otros periodos, abre Reportes."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Vendido hoy" value={daily.data ? formatMoney(daily.data.total) : '—'} />
        <StatCard label="Cuentas cobradas" value={daily.data?.tabsPaid ?? '—'} />
        <StatCard
          label="Efectivo · tarjeta"
          value={
            daily.data ? `${formatMoney(daily.data.cash)} · ${formatMoney(daily.data.card)}` : '—'
          }
        />
        <StatCard label="Cuentas abiertas" value={daily.data?.openTabs ?? '—'} />
      </div>
      {low + out > 0 ? (
        <Link
          to="/admin/inventario?alert=1"
          className="flex items-center gap-4 rounded-2xl border border-warning bg-warning-soft p-4 text-warning-ink transition hover:brightness-97"
        >
          <AlertTriangle aria-hidden="true" className="size-7 shrink-0" />
          <span className="flex-1">
            <span className="block font-extrabold">Revisa el inventario</span>
            <span className="block text-sm">
              {out > 0 ? `${out} agotado${out === 1 ? '' : 's'}` : ''}
              {out > 0 && low > 0 ? ' y ' : ''}
              {low > 0 ? `${low} con stock bajo` : ''}
            </span>
          </span>
          <span className="text-sm font-bold underline underline-offset-4">Ver</span>
        </Link>
      ) : null}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {shortcuts.map(({ to, label, text, Icon, ready }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
          >
            <span
              className={cn(
                'grid size-12 place-items-center rounded-xl',
                ready ? 'bg-primary-soft text-primary-ink' : 'bg-surface-2 text-muted',
              )}
            >
              <Icon aria-hidden="true" className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="font-extrabold">{label}</span>
              <span className="text-sm text-muted">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
