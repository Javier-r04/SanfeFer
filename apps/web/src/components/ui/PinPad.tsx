import { ArrowRight, Delete } from 'lucide-react';
import { cn } from '@/lib/cn';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinDots({
  length,
  max = 6,
  error,
}: {
  length: number;
  max?: number;
  error?: boolean;
}) {
  return (
    <div className={cn('flex gap-3.5', error && 'animate-shake')} aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-4 rounded-full',
            i < length ? (error ? 'bg-danger' : 'bg-primary') : 'border-2 border-border-strong',
          )}
        />
      ))}
    </div>
  );
}

export function PinPad({
  onDigit,
  onDelete,
  onSubmit,
  canSubmit,
  disabled,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  disabled?: boolean;
}) {
  const key =
    'h-14 rounded-2xl text-[26px] font-bold transition active:scale-[0.97] disabled:opacity-50';
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[...KEYS, 'del', '0', 'ok'].map((k) =>
        k === 'del' ? (
          <button
            key={k}
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Borrar dígito"
            className={cn(key, 'grid place-items-center bg-surface-2')}
          >
            <Delete aria-hidden="true" className="size-7" />
          </button>
        ) : k === 'ok' ? (
          <button
            key={k}
            type="button"
            onClick={onSubmit}
            disabled={disabled || !canSubmit}
            aria-label="Entrar"
            className={cn(key, 'grid place-items-center bg-primary text-on-primary')}
          >
            <ArrowRight aria-hidden="true" className="size-7" strokeWidth={2.6} />
          </button>
        ) : (
          <button
            key={k}
            type="button"
            onClick={() => onDigit(k)}
            disabled={disabled}
            className={cn(key, 'border border-border bg-surface')}
          >
            {k}
          </button>
        ),
      )}
    </div>
  );
}
