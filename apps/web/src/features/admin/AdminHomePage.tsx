import { Boxes, CupSoda, Truck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/features/common/ComingSoon';
import { useSession } from '@/features/auth/api';

const shortcuts = [
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    text: 'Crea vendedores y asigna su PIN',
    Icon: Users,
    ready: true,
  },
  {
    to: '/admin/productos',
    label: 'Productos y menú',
    text: 'Fase 1',
    Icon: CupSoda,
    ready: false,
  },
  { to: '/admin/inventario', label: 'Inventario', text: 'Fase 1', Icon: Boxes, ready: false },
  { to: '/admin/compras', label: 'Compras', text: 'Fase 2', Icon: Truck, ready: false },
];

export function AdminHomePage() {
  const { data: user } = useSession();
  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="El resumen de ventas llegará en la Fase 5. Por ahora puedes administrar los usuarios."
      />
      <div className="grid gap-3.5 sm:grid-cols-2">
        {shortcuts.map(({ to, label, text, Icon, ready }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
          >
            <span
              className={
                ready
                  ? 'grid size-12 place-items-center rounded-xl bg-primary-soft text-primary-ink'
                  : 'grid size-12 place-items-center rounded-xl bg-surface-2 text-muted'
              }
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
