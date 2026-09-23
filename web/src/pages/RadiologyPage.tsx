import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, ScanLine } from 'lucide-react';
import { Button, Dialog, Input, Textarea, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type RadiologyInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { AdmittedPatientCard, useAdmittedCharts } from '@/features/departments';

export default function RadiologyPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, refetchAll } = useAdmittedCharts();
  const toast = useToast();
  const [dialog, setDialog] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: API.addRadiology,
    onSuccess: () => {
      refetchAll();
      setDialog(null);
      toast.success(t('common.done'));
    },
  });

  return (
    <div>
      <PageHeader title={t('nav.radiology')} subtitle={t('dept.radSubtitle')} />

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
      ) : data.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={t('dept.noAdmitted')} icon={<ScanLine className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink/60">{t('dept.count', { count: data.length })}</p>
          {data.map(({ patient, chart }) => (
            <AdmittedPatientCard key={patient.id} patient={patient}>
              {chart.radiology.length === 0 ? (
                <p className="py-2 text-center text-sm font-medium text-ink/45">{t('radiology.empty')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {chart.radiology.map((r) => (
                    <li key={r.id} className="rounded-lg border border-ink/8 px-3.5 py-2.5 dark:border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-ink">{r.study_type_ar}</p>
                        <Badge variant={r.report ? 'success' : 'warning'}>{r.report ? t('laboratory.statuses.resulted') : t('laboratory.statuses.ordered')}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">{fmtDateTime(r.ordered_at)}</p>
                      {r.report && <p className="mt-2 text-sm leading-relaxed text-ink/80">{r.report}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog(chart.admissionId)}
                  icon={<Plus className="h-4 w-4" />}
                >
                  {t('radiology.add')}
                </Button>
              </div>
            </AdmittedPatientCard>
          ))}
        </div>
      )}

      <AddReportDialog admissionId={dialog} open={Boolean(dialog)} onClose={() => setDialog(null)} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
    </div>
  );
}

function AddReportDialog({
  open,
  onClose,
  admissionId,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  onSubmit: (i: RadiologyInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [studyTypeAr, setStudyTypeAr] = useState('');
  const [report, setReport] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (studyTypeAr.trim().length < 2) return;
    onSubmit({ admissionId, studyTypeAr: studyTypeAr.trim(), report });
    setStudyTypeAr('');
    setReport('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('radiology.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('radiology.studyType')} value={studyTypeAr} onChange={(e) => setStudyTypeAr(e.target.value)} autoFocus placeholder="أشعة مقطعية CT صدر" />
        <Textarea label={t('radiology.report')} rows={4} value={report} onChange={(e) => setReport(e.target.value)} />
      </div>
    </Dialog>
  );
}