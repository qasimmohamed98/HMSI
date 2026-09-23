import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, placeholder, className, id: customId, ...props },
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
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-11 w-full appearance-none rounded-lg border bg-surface-raised px-3.5 pe-10 text-[0.95rem] text-ink transition-colors',
            'border-ink/15 hover:border-ink/25 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            'dark:border-white/15 dark:bg-surface-raised dark:focus:border-brand-400 dark:focus:ring-brand-400/25',
            error && 'border-danger-500',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-ink/45" aria-hidden />
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
});