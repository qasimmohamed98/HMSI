import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { QLockup } from '@/components/brand/QBrand';
import { currentLang } from '@/i18n';
import { PRODUCTS, siteLink } from '@/lib/products';
import { cn } from '@/lib/utils';

/** بطاقات منتجات Q Products — تقود زوار النظام إلى الموقع العام */
export function OurProducts({ source, compact = false }: { source: string; compact?: boolean }) {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">{t('products.title')}</h2>
          <p className="text-sm text-ink/60">{t('products.subtitle')}</p>
        </div>
        <a
          href={siteLink(source)}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          {t('products.visit')}
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4')}>
        {PRODUCTS.map((p) => (
          <a
            key={p.id}
            href={siteLink(source, p.status === 'current' ? '/' : `/product/q-${p.id}`)}
            target="_blank"
            rel="noopener"
            className={cn(
              'group flex flex-col gap-3 rounded-2xl border bg-surface-raised p-4 transition hover:-translate-y-0.5 hover:shadow-md',
              p.status === 'current' ? 'border-brand-300 dark:border-brand-800' : 'border-ink/10 dark:border-white/10',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <QLockup name={p.word} className="h-6" />
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
                  p.status === 'current' && 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
                  p.status === 'available' && 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
                  p.status === 'soon' && 'bg-warning-50 text-warning-800 dark:bg-warning-900/30 dark:text-warning-200',
                )}
              >
                {t(`products.status.${p.status}`)}
              </span>
            </div>
            <div>
              <p className="font-bold text-ink">{en ? p.en : p.ar}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">{en ? p.descEn : p.descAr}</p>
            </div>
            <p className="mt-auto text-[0.7rem] font-semibold tracking-wide text-ink/40" dir="ltr">
              {p.platforms.join(' · ')}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

/** رابط صغير للموقع العام (تذييلات، صفحة الدخول، صفحة ذوي المريض) */
export function ProductsLink({ source, className }: { source: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <a href={siteLink(source)} target="_blank" rel="noopener" className={cn('inline-flex items-center gap-1 font-semibold hover:underline', className)}>
      {t('products.more')}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}
