import { RefreshCw } from 'lucide-react';
import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';

/** Una pestaña abierta desde antes de publicar una versión nueva pide archivos que ya no existen. */
const isStaleChunk = (error: unknown) =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    error.message,
  );

export function RouteError() {
  const error = useRouteError();
  const stale = isStaleChunk(error);
  if (!stale) console.error(error);
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <h1 className="text-xl font-extrabold">
          {stale ? 'Hay una versión nueva de SanfeFer' : 'Algo salió mal en esta pantalla'}
        </h1>
        <p className="text-muted">
          {stale
            ? 'Recarga para seguir trabajando con la versión actual.'
            : 'Recarga la página. Si vuelve a pasar, avisa al administrador.'}
        </p>
        <Button size="lg" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" className="size-5" />
          Recargar
        </Button>
        <Link to="/" className="font-bold text-primary-ink underline underline-offset-4">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
