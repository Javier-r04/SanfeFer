import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'highlight';
type Size = 'md' | 'lg' | 'xl' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:brightness-95',
  secondary: 'bg-secondary-soft text-secondary-ink hover:brightness-97',
  outline: 'border-[1.5px] border-border bg-transparent text-text hover:bg-surface-2',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:brightness-95',
  highlight: 'bg-highlight text-on-highlight hover:brightness-95',
};

// En el POS los botones miden al menos 56 px (size="xl").
const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
  xl: 'h-14 px-6 text-[17px] rounded-2xl gap-2.5',
  icon: 'size-11 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold transition select-none',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-5" /> : null}
      {children}
    </button>
  );
});
