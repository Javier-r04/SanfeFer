import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Diálogo nativo (<dialog>): maneja foco, Escape y fondo inerte.
 * En celular aparece como hoja inferior; en pantallas grandes, centrado.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-text',
        'sm:m-auto sm:max-w-lg sm:rounded-3xl',
        'backdrop:bg-overlay',
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-extrabold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer ? (
            <footer className="flex gap-3 border-t border-border px-5 py-4">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
