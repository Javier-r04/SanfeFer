import { cn } from '@/lib/cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn('size-6 animate-spin', className)}
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="text-sm text-muted">{label}</span> : null}
    </span>
  );
}

export function FullScreenSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center text-primary">
      <Spinner className="size-8" label={label} />
    </div>
  );
}
