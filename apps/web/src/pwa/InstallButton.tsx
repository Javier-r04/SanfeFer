import { MonitorDown, Share, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { useInstall } from './install';

/** "Instalar app": diálogo nativo en Chrome/Edge/Android; instrucciones en iPhone. Oculto si ya está instalada. */
export function InstallButton({ className }: { className?: string }) {
  const { canPrompt, needsIOSHelp, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!canPrompt && !needsIOSHelp) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (canPrompt ? void install() : setHelp(true))}
        className={cn(
          'flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-primary-ink transition hover:bg-primary-soft',
          className,
        )}
      >
        <MonitorDown aria-hidden="true" className="size-5" />
        Instalar app
      </button>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="Instalar en el iPhone"
        description="Queda en la pantalla de inicio y se abre como una app."
        footer={
          <Button size="lg" className="w-full" onClick={() => setHelp(false)}>
            Entendido
          </Button>
        }
      >
        <ol className="flex flex-col gap-4 text-[15px]">
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft font-extrabold text-primary-ink">
              1
            </span>
            <span>
              Abre esta página en <strong>Safari</strong> y toca{' '}
              <strong className="inline-flex items-center gap-1">
                Compartir <Share aria-hidden="true" className="size-4" />
              </strong>{' '}
              en la barra de abajo.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft font-extrabold text-primary-ink">
              2
            </span>
            <span>
              Elige{' '}
              <strong className="inline-flex items-center gap-1">
                Agregar a inicio <SquarePlus aria-hidden="true" className="size-4" />
              </strong>{' '}
              y luego <strong>Agregar</strong>.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
