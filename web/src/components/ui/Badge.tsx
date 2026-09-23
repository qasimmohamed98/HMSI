import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const tones: Record<BadgeVariant, string> = {
  neutral: 'bg-ink/8 text-ink/75 dark:bg-white/10 dark:text-white/80',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
  success: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300',
  warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300',
  danger: 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300',
  info: 'bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-300',
  outline: 'border border-ink/15 text-ink/70 dark:border-white/20 dark:text-white/70',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ className, variant = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5',
        tones[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}