import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/60',
  secondary:
    'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-100 dark:hover:bg-brand-900/60',
  ghost:
    'text-ink/80 hover:bg-surface-muted active:bg-ink/10 dark:hover:bg-white/10',
  outline:
    'border border-ink/15 bg-transparent text-ink hover:bg-surface-muted active:bg-ink/5 dark:border-white/20',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 shadow-sm',
  subtle:
    'bg-surface-muted text-ink/80 hover:bg-ink/10 dark:bg-white/10 dark:text-white/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, icon, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors duration-150 select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', size === 'sm' && 'h-3.5 w-3.5')}
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});