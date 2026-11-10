import { LayoutGrid, LogOut, Settings, Wallet } from 'lucide-react';
import { NavLink, Outlet, useMatches } from 'react-router';
import { useLogout, useSession } from '@/features/auth/api';
import { cn } from '@/lib/cn';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex flex-1 flex-col items-center justify-center gap-1 text-xs md:h-[72px] md:flex-none',
    isActive ? 'font-extrabold text-primary-ink' : 'font-bold text-muted hover:text-text',
  );

/** Las pantallas de cuenta y orden marcan `handle: { hideNav: true }`: tienen su propia barra inferior. */
export function PosLayout() {
  const { data: user } = useSession();
  const logout = useLogout();
  const hideNav = useMatches().some(
    (m) => (m.handle as { hideNav?: boolean } | undefined)?.hideNav,
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row-reverse">
      <div className={cn('flex min-w-0 flex-1 flex-col', !hideNav && 'pb-[72px] md:pb-0')}>
        <Outlet />
      </div>
      <nav
        aria-label="Navegación del POS"
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 h-[72px] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]',
          'md:sticky md:top-0 md:flex md:h-dvh md:w-24 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:pt-4',
          hideNav ? 'hidden' : 'flex',
        )}
      >
        <NavLink to="/pos" end className={linkClass}>
          <LayoutGrid aria-hidden="true" className="size-6" />
          Mesas
        </NavLink>
        {/* La caja solo la ve y la maneja el administrador. */}
        {user?.role === 'ADMIN' ? (
          <>
            <NavLink to="/pos/caja" className={linkClass}>
              <Wallet aria-hidden="true" className="size-6" />
              Caja
            </NavLink>
            <NavLink to="/admin" className={linkClass}>
              <Settings aria-hidden="true" className="size-6" />
              Admin
            </NavLink>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-xs font-bold text-muted hover:text-text md:mt-auto md:h-[72px] md:flex-none"
        >
          <LogOut aria-hidden="true" className="size-6" />
          Salir
        </button>
      </nav>
    </div>
  );
}
