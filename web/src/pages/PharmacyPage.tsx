import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PackageCheck, Pill, Timer } from 'lucide-react';
import { Button, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDate, fmtDateTime, localName } from '@/lib/format';
import { AdmittedPatientCard, useAdmittedCharts } from '@/features/departments';
import { cn } from '@/lib/utils';

/**
 * الصيدلية: صرف الأدوية التي وصفها الطبيب للمنوّمين.
 * الصيدلي لا يصف الأدوية (صلاحية medications.dispense فقط).
 */
export default function PharmacyPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, refetchAll } = useAdmittedCharts();
  const toast = useToast();
  const [pendingOnly, setPendingOnly] = useState(true);

  const dispenseMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.dispenseMedication(args.admissionId, args.id),
    onSuccess: () => {
      refetchAll();
      toast.success(t('common.done'));
    },
  });

  const needsDispense = (m: { status: string; dispensed_at?: string | null }) => m.status === 'active' && !m.dispensed_at;
  const rows = (data ?? [])
    .map((d) => ({ ...d, meds: pendingOnly ? d.chart.medications.filter(needsDispense) : d.chart.medications }))
    .filter((d) => !pendingOnly || d.meds.length > 0);
  const pendingCount = (data ?? []).reduce((n, d) => n + d.chart.medications.filter(needsDispense).length, 0);

  return (
    <div>
      <PageHeader
        title={t('nav.pharmacy')}
        subtitle={t('dept.pharmSubtitle')}
        actions={
          <div className="flex rounded-lg border border-ink/10 p-0.5 dark:border-white/10">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setPendingOnly(v)}
                className={cn('rounded-md px-3 py-1.5 text-sm font-semibold', pendingOnly === v ? 'bg-brand-600 text-white' : 'text-ink/60 hover:text-ink')}
              >
                {v ? `${t('ui.pendingDispense')} (${pendingCount})` : t('ui.showAll')}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={pendingOnly ? t('ui.noPending') : t('dept.noAdmitted')} icon={<Pill className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(({ patient, chart, meds }) => (
            <AdmittedPatientCard key={patient.id} patient={patient}>
              {meds.length === 0 ? (
                <p className="py-2 text-center text-sm font-medium text-ink/45">{t('medications.empty')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {meds.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/8 px-3.5 py-2.5 dark:border-white/10">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{localName(m, 'name')}</p>
                          <Badge variant={m.status === 'active' ? 'success' : 'neutral'}>{t(`medications.statuses.${m.status}`)}</Badge>
                          {m.dispensed_at ? <Badge variant="info">{t('ui.dispensed')}</Badge> : m.status === 'active' ? <Badge variant="warning">{t('ui.notDispensed')}</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink/50">
                          {m.dose} · {m.route} · {m.frequency} · <Timer className="inline h-3 w-3" /> {fmtDate(m.start_at, { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-xs text-ink/40">
                          {t('medications.prescribedBy')}: {m.prescribed_by}
                          {m.dispensed_at && ` · ${t('ui.dispensedBy')}: ${m.dispensed_by} (${fmtDateTime(m.dispensed_at)})`}
                        </p>
                      </div>
                      {needsDispense(m) && chart.admissionId && (
                        <Button
                          size="sm"
                          icon={<PackageCheck className="h-4 w-4" />}
                          loading={dispenseMut.isPending && dispenseMut.variables?.id === m.id}
                          onClick={() => dispenseMut.mutate({ admissionId: chart.admissionId!, id: m.id })}
                        >
                          {t('ui.dispense')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </AdmittedPatientCard>
          ))}
        </div>
      )}
    </div>
  );
}
