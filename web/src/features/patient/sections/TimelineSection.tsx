import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { SectionCard, EmptyLine } from './SectionCard';
import { fmtDateTime } from '@/lib/format';
import type { ChartData } from '@/lib/api';

export function TimelineSection({ chart }: { chart: ChartData }) {
  const { t } = useTranslation();
  return (
    <SectionCard title={t('timeline.title')}>
      {chart.timeline.length === 0 ? (
        <EmptyLine>{t('timeline.empty')}</EmptyLine>
      ) : (
        <div className="relative ms-3 border-s-2 border-surface-muted pb-1 ps-6 dark:border-white/10">
          <div className="space-y-4">
            {chart.timeline.map((ev) => (
              <div key={ev.id} className="relative">
                <span className="absolute -start-[34px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised ring-2 ring-brand-200 dark:bg-surface-raised dark:ring-brand-800">
                  <History className="h-2.5 w-2.5 text-brand-500" />
                </span>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{ev.title_ar}</p>
                    <p className="text-xs text-ink/50">
                      {ev.actor} · <span className="tabular">{fmtDateTime(ev.created_at)}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}