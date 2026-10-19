import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-10 place-items-center rounded-xl bg-primary', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-[60%]"
        fill="none"
        stroke="var(--on-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12l-1.6 15.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8Z" />
        <path d="M6.4 8h11.2" />
        <path d="M10 12v4" />
        <path d="M14 12v4" />
      </svg>
    </span>
  );
}

/** Franja inspirada en los tejidos de huipil. */
export function TejidoBand({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('block h-3 w-full', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="tejido" width="56" height="12" patternUnits="userSpaceOnUse">
          <rect width="56" height="12" fill="#3F7360" />
          <path d="M0 12 L7 2 L14 12 Z" fill="#46739A" />
          <path d="M14 12 L21 2 L28 12 Z" fill="#A8553F" />
          <path d="M28 12 L35 2 L42 12 Z" fill="#C9A24F" />
          <path d="M42 12 L49 2 L56 12 Z" fill="#7D6E9E" />
        </pattern>
      </defs>
      <rect width="100%" height="12" fill="url(#tejido)" />
    </svg>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  // Color estable por iniciales, tomado de la paleta.
  const palette = [
    'bg-secondary text-on-secondary',
    'bg-primary text-on-primary',
    'bg-highlight text-on-highlight',
    'bg-danger text-on-danger',
  ];
  const index = [...initials].reduce((n, c) => n + c.charCodeAt(0), 0) % palette.length;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-extrabold',
        palette[index],
        className,
      )}
    >
      {initials}
    </span>
  );
}
