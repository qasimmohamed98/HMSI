import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Chip({ label, onRemove, tone = 'neutral' }: { label: string; onRemove?: () => void; tone?: 'neutral' | 'danger' | 'warning' }) {
  const tones = {
    neutral: 'bg-surface-muted text-ink/80 dark:bg-white/10 dark:text-white/80',
    danger: 'bg-danger-50 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300',
    warning: 'bg-warning-50 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100" aria-label={`إزالة ${label}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}