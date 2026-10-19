import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Las tablets del POS pasan el día abiertas: se busca una versión nueva cada hora.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Avisos globales de la app: sin conexión y versión nueva disponible. */
export function AppStatus() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  if (online && !needRefresh) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {!online ? (
        <div
          role="status"
          className="pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-2xl bg-danger px-4 py-2.5 text-sm font-semibold text-on-danger shadow-lg"
        >
          <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>
            Sin conexión a internet. La orden en curso se guarda en este dispositivo; podrás
            enviarla y cobrar cuando vuelva la conexión.
          </span>
        </div>
      ) : null}
      {needRefresh ? (
        <div
          role="status"
          className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-surface py-2 pr-2 pl-4 text-sm font-semibold shadow-lg"
        >
          <span>Hay una versión nueva de SanfeFer.</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 font-bold text-on-primary hover:brightness-95"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </button>
        </div>
      ) : null}
    </div>
  );
}
