import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToasts, type ToastTone } from '@/stores/toast';

const styles: Record<ToastTone, string> = {
  success: 'bg-primary-soft text-primary-ink border-primary',
  error: 'bg-danger-soft text-danger-ink border-danger',
  info: 'bg-secondary-soft text-secondary-ink border-secondary',
};
const icons = { success: CircleCheck, error: CircleAlert, info: Info };

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      // Arriba en celular para no tapar las barras de acciones de abajo; abajo en pantallas grandes.
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg',
              styles[t.tone],
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <p className="flex-1 text-[15px] font-semibold">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar aviso"
              className="grid size-8 place-items-center"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
