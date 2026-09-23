import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FlaskConical } from 'lucide-react';
import { Button, Dialog, Input, Textarea, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type LabInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { AdmittedPatientCard, useAdmittedCharts } from '@/features/departments';

export default function LaboratoryPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, refetchAll } = useAdmittedCharts();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ admissionId: string; test: string } | null>(null);

  const mut = useMutation({
    mutationFn: API.addLabResult,
    onSuccess: () => {
      refetchAll();
      setDialog(null);
      toast.success(t('common.done'));
    },
  });

  const badge = (s: string) =>
    ({ ordered: 'warning', in_progress: 'info', resulted: 'success', abnormal: 'danger' })[s] as 'warning' | 'info' | 'success' | 'danger';

  return (
    <div>
      <PageHeader title={t('nav.laboratory')} subtitle={t('dept.labSubtitle')} />

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
            <EmptyState title={t('dept.noAdmitted')} icon={<FlaskConical className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink/60">{t('dept.count', { count: data.length })}</p>
          {data.map(({ patient, chart }) => (
            <AdmittedPatientCard key={patient.id} patient={patient}>
              {chart.labs.length === 0 ? (
                <p className="py-2 text-center text-sm font-medium text-ink/45">{t('laboratory.empty')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {chart.labs.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/8 px-3.5 py-2.5 dark:border-white/10">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{l.test_name_ar}</p>
                          <Badge variant={badge(l.status)}>{t(`laboratory.statuses.${l.status}`)}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-ink/50">
                          {l.category ? `${l.category} · ` : ''}
                          {fmtDateTime(l.ordered_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        {l.result ? (
                          <>
                            <p className="text-sm font-extrabold tabular text-ink">
                              {l.result}
                              {l.unit && <span className="ms-1 text-xs font-semibold text-ink/45">{l.unit}</span>}
                            </p>
                            <p className="text-xs text-ink/45">{l.resulted_by}</p>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setDialog({ admissionId: l.admission_id, test: l.test_name_ar })}
                            icon={<Plus className="h-3.5 w-3.5" />}
                          >
                            {t('laboratory.updateResult')}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdmittedPatientCard>
          ))}
        </div>
      )}

      <AddResultDialog
        admissionId={dialog?.admissionId ?? null}
        preset={dialog?.test ?? ''}
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        onSubmit={(i) => mut.mutate(i)}
        busy={mut.isPending}
      />
    </div>
  );
}

function AddResultDialog({
  open,
  onClose,
  admissionId,
  preset,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  preset: string;
  onSubmit: (i: LabInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [testNameAr, setTestNameAr] = useState(preset);
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('');
  const [reference, setReference] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (testNameAr.trim().length < 2) return;
    onSubmit({ admissionId, testNameAr: testNameAr.trim(), result, unit: unit || null, referenceRange: reference || null });
    setTestNameAr('');
    setResult('');
    setUnit('');
    setReference('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('laboratory.addResult')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} icon={<FlaskConical className="h-4 w-4" />}>
            {t('laboratory.updateResult')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('laboratory.test')} value={testNameAr} onChange={(e) => setTestNameAr(e.target.value)} autoFocus />
        <div className="grid grid-cols-3 gap-3">
          <Input label={t('laboratory.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} dir="ltr" containerClassName="col-span-1" />
          <Input label={t('laboratory.reference')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" containerClassName="col-span-2" />
        </div>
        <Textarea label={t('laboratory.result')} rows={3} value={result} onChange={(e) => setResult(e.target.value)} />
      </div>
    </Dialog>
  );
}