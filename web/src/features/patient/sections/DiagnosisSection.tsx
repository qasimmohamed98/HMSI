import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Select, Badge } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type DiagnosisInput, type ChartData } from '@/lib/api';
import { useToast } from '@/components/ui';

export function DiagnosisSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: API.addDiagnosis,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteDiagnosis(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  return (
    <SectionCard
      title={t('diagnosis.title')}
      action={
        canWrite && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t('diagnosis.add')}
          </Button>
        ) : undefined
      }
    >
      {chart.diagnoses.length === 0 ? (
        <EmptyLine>{t('diagnosis.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.diagnoses.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 dark:bg-info-900/40 dark:text-info-300">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-ink">{d.title_ar}</p>
                  <p className="text-xs text-ink/50">
                    {d.title_en}
                    {d.icd10 && <span className="tabular">{d.title_en ? ' · ' : ''}{d.icd10}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/40">بواسطة: {d.added_by}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.status === 'confirmed' ? 'brand' : d.status === 'suspected' ? 'warning' : 'success'}>
                  {t(`diagnosis.statuses.${d.status}`)}
                </Badge>
                {canWrite && chart.admissionId && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                    onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: d.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddDiagnosisDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(input) => mut.mutate(input)} busy={mut.isPending} />
    </SectionCard>
  );
}

function AddDiagnosisDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: DiagnosisInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [titleAr, setTitleAr] = useState('');
  const [icd10, setIcd10] = useState('');
  const [status, setStatus] = useState('suspected');

  if (!admissionId) return null;
  const submit = () => {
    if (titleAr.trim().length < 2) return;
    onSubmit({ admissionId, titleAr, icd10: icd10 || null, status: status as DiagnosisInput['status'] });
    setTitleAr('');
    setIcd10('');
    setStatus('suspected');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('diagnosis.add')}
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
        <Input label={t('diagnosis.titleLabel')} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('diagnosis.icd10')} value={icd10} onChange={(e) => setIcd10(e.target.value)} dir="ltr" placeholder="I10" />
          <Select
            label={t('diagnosis.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={(Object.keys(t('diagnosis.statuses', { returnObjects: true }) as object) as string[]).map((k) => ({ value: k, label: t(`diagnosis.statuses.${k}`) }))}
          />
        </div>
      </div>
    </Dialog>
  );
}