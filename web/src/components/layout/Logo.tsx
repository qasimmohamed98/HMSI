import { useTranslation } from 'react-i18next';
import { Cross } from 'lucide-react';
import { cn } from '@/lib/utils';

/** شعار النظام؛ إن كان للمستشفى شعار (src) يظهر بدل الرمز الافتراضي */
export function Logo({ compact = false, light = false, src, title }: { compact?: boolean; light?: boolean; src?: string | null; title?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {src ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-ink/10">
          <img src={src} alt="" className="h-full w-full object-contain" />
        </span>
      ) : (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
            'bg-gradient-to-br from-brand-500 to-brand-700 dark:from-brand-400 dark:to-brand-600',
          )}
        >
          <Cross className="h-5 w-5" strokeWidth={2.5} />
        </span>
      )}
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={cn('block truncate text-sm font-extrabold', light ? 'text-white' : 'text-ink')}>{title || 'HMSI'}</span>
          <span className={cn('block truncate text-[0.65rem] font-semibold', light ? 'text-white/70' : 'text-ink/45')}>
            {title ? 'HMSI' : t('nav.hospital')}
          </span>
        </span>
      )}
    </div>
  );
}
