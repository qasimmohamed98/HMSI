import { useTranslation } from 'react-i18next';
import { Cross } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
          'bg-gradient-to-br from-brand-500 to-brand-700 dark:from-brand-400 dark:to-brand-600',
        )}
      >
        <Cross className="h-5 w-5" strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block text-sm font-extrabold', light ? 'text-white' : 'text-ink')}>HMSI</span>
          <span className={cn('block text-[0.65rem] font-semibold', light ? 'text-white/70' : 'text-ink/45')}>
            {t('nav.hospital')}
          </span>
        </span>
      )}
    </div>
  );
}