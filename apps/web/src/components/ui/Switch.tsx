import { cn } from '@/lib/cn';

/** Interruptor accesible (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  showLabel = false,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  showLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2.5 text-sm font-semibold disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-full bg-surface shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </span>
      {showLabel ? label : null}
    </button>
  );
}
