import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className={cn('relative block', className)}>
        <select
          ref={ref}
          className={cn(
            'h-12 w-full appearance-none rounded-xl border-[1.5px] border-border bg-surface pr-10 pl-3.5 text-base text-text',
            'aria-invalid:border-danger disabled:opacity-60',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted"
        />
      </span>
    );
  },
);
