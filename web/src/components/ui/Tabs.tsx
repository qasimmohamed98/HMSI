import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'underline' | 'pill';
  scrollable?: boolean;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, variant = 'underline', scrollable = true, className }: TabsProps<T>) {
  const labelId = useId();
  return (
    <div
      role="tablist"
      aria-label={labelId}
      className={cn(
        'flex w-full items-center gap-1',
        variant === 'underline' ? 'border-b border-ink/10 dark:border-white/10' : 'rounded-xl bg-surface-muted p-1 dark:bg-white/5',
        scrollable && 'overflow-x-auto no-scrollbar',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors',
              variant === 'underline'
                ? 'relative px-3.5 py-2.5 text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white'
                : 'rounded-lg px-3.5 py-2',
              active &&
                (variant === 'underline'
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'bg-surface-raised text-ink shadow-card dark:bg-white/10 dark:text-white'),
            )}
          >
            {active && variant === 'underline' && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" aria-hidden />
            )}
            {item.icon && <span className="opacity-80">{item.icon}</span>}
            {item.label}
            {typeof item.count === 'number' && item.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold leading-none',
                  active ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-ink/8 text-ink/60 dark:bg-white/10 dark:text-white/60',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}