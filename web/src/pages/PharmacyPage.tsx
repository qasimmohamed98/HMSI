import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pill, Timer } from 'lucide-react';
import { Button, Dialog, Input, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type MedicationInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDate, todayISO } from '@/lib/format';
import { AdmittedPatientCard, useAdmittedCharts } from '@/features/departments';

export default function PharmacyPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, refetchAll } = useAdmittedCharts();
  const toast = useToast();
  const [dialog, setDialog] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: API.addMedication,
    onSuccess: () => {
      refetchAll();
      setDialog(null);
      toast.success(t('common.done'));
    },
  });

  return (
    <div>
      <PageHeader title={t('nav.pharmacy')} subtitle={t('dept.pharmSubtitle')} />

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
            <EmptyState title={t('dept.noAdmitted')} icon={<Pill className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink/60">{t('dept.count', { count: data.length })}</p>
          {data.map(({ patient, chart }) => (
            <AdmittedPatientCard key={patient.id} patient={patient}>
              {chart.medications.length === 0 ? (
                <p className="py-2 text-center text-sm font-medium text-ink/45">{t('medications.empty')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {chart.medications.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/8 px-3.5 py-2.5 dark:border-white/10">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{m.name_ar}</p>
                          <Badge variant="success">{t(`medications.statuses.${m.status}`)}</Badge>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/50">
                          {m.dose} · {m.route} · {m.frequency}
                          <span className="text-ink/25">·</span>
                          <Timer className="h-3 w-3" />
                          {fmtDate(m.start_at, { day: 'numeric', month: 'short' })}
                          {m.end_at ? ` ← ${fmtDate(m.end_at, { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-xs text-ink/45">{m.prescribed_by}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => setDialog(chart.admissionId)} icon={<Plus className="h-4 w-4" />}>
                  {t('medications.add')}
                </Button>
              </div>
            </AdmittedPatientCard>
          ))}
        </div>
      )}

      <AddMedicationDialog admissionId={dialog} open={Boolean(dialog)} onClose={() => setDialog(null)} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
    </div>
  );
}

function AddMedicationDialog({
  open,
  onClose,
  admissionId,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  onSubmit: (i: MedicationInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');
  const [frequency, setFrequency] = useState('');
  const [start, setStart] = useState(todayISO());

  if (!admissionId) return null;
  const submit = () => {
    if (nameAr.trim().length < 2 || !dose.trim()) return;
    onSubmit({ admissionId, nameAr: nameAr.trim(), dose: dose.trim(), route: route.trim(), frequency: frequency.trim(), startAt: start });
    setNameAr('');
    setDose('');
    setRoute('');
    setFrequency('');
    setStart(todayISO());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('medications.add')}
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
        <Input label={t('medications.name')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder="باراسيتامول" />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('medications.dose')} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500 مغ" />
          <Input label={t('medications.route')} value={route} onChange={(e) => setRoute(e.target.value)} placeholder="PO" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('medications.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="كل 8 ساعات" />
          <Input label={t('medications.start')} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}