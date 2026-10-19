import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-20 w-full rounded-xl border-[1.5px] border-border bg-surface px-3.5 py-3 text-base text-text',
        'placeholder:text-muted/80 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
});
