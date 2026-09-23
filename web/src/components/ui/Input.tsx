import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, containerClassName, className, id: customId, ...props },
  ref,
) {
  const autoId = useId();
  const id = customId ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-ink/90">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink/45">{icon}</span>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'h-11 w-full rounded-lg border bg-surface-raised px-3.5 text-[0.95rem] text-ink shadow-inner transition-colors placeholder:text-ink/35',
            'border-ink/15 hover:border-ink/25 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            'dark:border-white/15 dark:bg-surface-raised dark:focus:border-brand-400 dark:focus:ring-brand-400/25',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
            icon && 'ps-10',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink/50">{hint}</p>
      ) : null}
    </div>
  );
});