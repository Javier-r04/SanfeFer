import { ROLE_LABELS } from '@sanfefer/shared';
import {
  BarChart3,
  Boxes,
  CupSoda,
  House,
  LogOut,
  Menu,
  MonitorSmartphone,
  SlidersHorizontal,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Avatar, LogoMark } from '@/components/ui/Brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useLogout, useSession } from '@/features/auth/api';
import { cn } from '@/lib/cn';

export const adminNav = [
  { to: '/admin', label: 'Inicio', Icon: House, end: true },
  { to: '/pos', label: 'Punto de venta', Icon: MonitorSmartphone },
  { to: '/admin/productos', label: 'Productos y menú', Icon: CupSoda },
  { to: '/admin/inventario', label: 'Inventario', Icon: Boxes },
  { to: '/admin/compras', label: 'Compras', Icon: Truck },
  { to: '/admin/caja', label: 'Caja', Icon: Wallet },
  { to: '/admin/reportes', label: 'Reportes', Icon: BarChart3 },
  { to: '/admin/usuarios', label: 'Usuarios', Icon: Users },
  { to: '/admin/ajustes', label: 'Ajustes', Icon: SlidersHorizontal },
];

function initialsOf(name: string) {
  const [a = '', b = ''] = name.trim().split(/\s+/);
  return (b ? a[0]! + b[0]! : a.slice(0, 2)).toUpperCase();
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useSession();
  const logout = useLogout();
  return (
    <div className="flex h-full flex-col gap-1 px-3.5 py-5">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <LogoMark />
        <span className="font-display text-[22px] font-extrabold">SanfeFer</span>
      </div>
      <nav aria-label="Administración" className="flex flex-col gap-1">
        {adminNav.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px]',
                isActive
                  ? 'bg-primary-soft font-extrabold text-primary-ink'
                  : 'font-semibold hover:bg-surface-2',
              )
            }
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-sm font-semibold text-muted">Tema</span>
          <ThemeToggle />
        </div>
        {user ? (
          <div className="flex items-center gap-2.5 px-1">
            <Avatar initials={initialsOf(user.name)} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
            >
              <LogOut aria-hidden="true" className="size-5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      {/* Celular y tablet: barra superior con menú desplegable */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <Menu aria-hidden="true" className="size-6" />
        </button>
        <LogoMark className="size-9" />
        <span className="font-display text-xl font-extrabold">SanfeFer</span>
      </header>
      {open ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-overlay"
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-4 right-3 grid size-11 place-items-center rounded-full hover:bg-surface-2"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
