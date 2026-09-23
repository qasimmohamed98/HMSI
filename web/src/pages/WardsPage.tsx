import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, BedDouble } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function WardsPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['wards'], queryFn: API.wards });

  return (
    <div>
      <PageHeader title={t('nav.wards')} subtitle={t('dashboard.occupancyTitle')} />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((w) => {
            const occupied = w.beds.filter((b) => b.status === 'occupied').length;
            const pct = Math.round((occupied / w.beds.length) * 100);
            return (
              <Card key={w.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{w.name_ar}</CardTitle>
                      <p className="text-xs text-ink/50">{w.name_en}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="brand" dot>
                      {t('occupancy.bedsUsed', { used: occupied, total: w.beds.length })}
                    </Badge>
                    <span className="text-xs font-bold text-ink/45">%{pct}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10">
                    <div
                      className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500')}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {w.beds.map((b) => (
                      <div
                        key={b.id}
                        title={`${b.room} / ${b.bed_no}`}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center',
                          b.status === 'occupied'
                            ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                            : 'border-ink/8 bg-surface-raised text-ink/40 dark:border-white/10',
                        )}
                      >
                        <BedDouble className="h-3.5 w-3.5" />
                        <span className="text-[0.65rem] font-bold tabular">{b.bed_no}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}