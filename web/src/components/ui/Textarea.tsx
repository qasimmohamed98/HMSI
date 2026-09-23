import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id: customId, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const id = customId ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-ink/90">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={cn(
          'w-full resize-y rounded-lg border bg-surface-raised px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-ink transition-colors placeholder:text-ink/35',
          'border-ink/15 hover:border-ink/25 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          'dark:border-white/15 dark:bg-surface-raised dark:focus:border-brand-400 dark:focus:ring-brand-400/25',
          error && 'border-danger-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
});