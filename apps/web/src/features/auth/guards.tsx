import type { Role } from '@sanfefer/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api';
import { homePath, useSession } from './api';

function SessionError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <p className="text-lg font-bold">{errorMessage(error)}</p>
        <Button size="lg" onClick={retry}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}

/** Exige sesión (y opcionalmente un rol). Un vendedor que entra a /admin va al POS. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { data: user, isPending, error, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <FullScreenSpinner />;
  if (error) return <SessionError error={error} retry={() => void refetch()} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return children;
}

/** Pantallas de ingreso: si ya hay sesión, va directo a su inicio. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession();
  if (isPending) return <FullScreenSpinner />;
  if (user) return <Navigate to={homePath(user.role)} replace />;
  return children;
}

export function RootRedirect() {
  const { data: user, isPending, error, refetch } = useSession();
  if (isPending) return <FullScreenSpinner />;
  if (error) return <SessionError error={error} retry={() => void refetch()} />;
  return <Navigate to={user ? homePath(user.role) : '/login'} replace />;
}
