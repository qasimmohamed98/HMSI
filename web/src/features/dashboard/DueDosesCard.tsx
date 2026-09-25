import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Syringe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { useRounds, useVitalsRounds } from '@/features/rounds/useRounds';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** بطاقة لوحة التحكم للتمريض: عدد الجرعات المتأخرة والمستحقة الآن */
export function DueDosesCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mine = user?.role === 'nurse';
  const { items, isLoading } = useRounds(undefined, mine);
  const vitals = useVitalsRounds(undefined, mine);
  if (isLoading || vitals.isLoading) return null;
  const late = (s: string) => s === 'overdue';
  const overdue = items.filter((x) => late(x.s.state)).length + vitals.items.filter((x) => late(x.s.state)).length;
  const due = items.filter((x) => x.s.state === 'due').length + vitals.items.filter((x) => x.s.state === 'due').length;
  return (
    <Link to="/medication-rounds" className="block">
      <Card className={cn('transition hover:shadow-md', overdue > 0 ? 'border-danger-200 dark:border-danger-900/50' : due > 0 ? 'border-warning-200 dark:border-warning-900/50' : '')}>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', overdue > 0 ? 'bg-danger-50 text-danger-600 dark:bg-danger-900/30' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200')}>
            <Syringe className="h-5 w-5" />
          </span>
          <p className="font-bold text-ink">{t('rounds.cardTitle')}</p>
          <div className="flex gap-5">
            <div>
              <p className={cn('text-2xl font-extrabold tabular', overdue > 0 ? 'text-danger-600' : 'text-ink')}>{overdue}</p>
              <p className="text-xs font-semibold text-ink/50">{t('rounds.cardOverdue')}</p>
            </div>
            <div>
              <p className={cn('text-2xl font-extrabold tabular', due > 0 ? 'text-warning-600' : 'text-ink')}>{due}</p>
              <p className="text-xs font-semibold text-ink/50">{t('rounds.cardDue')}</p>
            </div>
          </div>
          <span className="ms-auto text-sm font-semibold text-brand-700 dark:text-brand-300">{t('rounds.cardOpen')}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
