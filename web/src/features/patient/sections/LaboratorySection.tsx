import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FlaskConical, PenLine, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Textarea, Badge } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type LabInput, type ChartData, type LabResultInput } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';

export function LaboratorySection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editLab, setEditLab] = useState<(typeof chart.labs)[number] | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
  void invalidate;

  const mut = useMutation({
    mutationFn: API.addLabResult,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; labId: string; input: LabResultInput }) => API.updateLabResult(args.admissionId, args.labId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setEditLab(null);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteLabResult(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const badge = (s: string) =>
    ({ ordered: 'warning', in_progress: 'info', resulted: 'success', abnormal: 'danger' })[s] as 'warning' | 'info' | 'success' | 'danger';

  return (
    <SectionCard
      title={t('laboratory.title')}
      action={
        canWrite && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t('laboratory.addResult')}
          </Button>
        ) : undefined
      }
    >
      {chart.labs.length === 0 ? (
        <EmptyLine>{t('laboratory.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.labs.map((l) => (
            <div key={l.id} className="rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 dark:bg-info-900/40 dark:text-info-300">
                    <FlaskConical className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{l.test_name_ar}</p>
                    <p className="text-xs text-ink/50">
                      {l.category ? `${l.category} · ` : ''}
                      {fmtDateTime(l.ordered_at)} · {t('laboratory.orderedBy')}: {l.ordered_by}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badge(l.status)}>{t(`laboratory.statuses.${l.status}`)}</Badge>
                  {canWrite && chart.admissionId && (
                    <>
                      {(l.status === 'ordered' || l.status === 'in_progress') && (
                        <Button size="sm" variant="outline" icon={<PenLine className="h-3.5 w-3.5" />} onClick={() => setEditLab(l)}>
                          {t('actions.enterResult')}
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                        onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: l.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {l.result && (
                <div className="mt-3 rounded-lg bg-surface-muted/80 px-3.5 py-2.5 dark:bg-white/5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <p className="text-sm font-extrabold tabular text-ink">
                      {l.result}
                      {l.unit && <span className="ms-1 text-xs font-semibold text-ink/45">{l.unit}</span>}
                    </p>
                    {l.reference_range && <span className="text-xs font-medium text-ink/45">مرجع: {l.reference_range}</span>}
                  </div>
                  {l.resulted_by && l.resulted_at && (
                    <p className="mt-1 text-xs text-ink/40">
                      {t('laboratory.updateResult')}: {fmtDateTime(l.resulted_at)} · {l.resulted_by}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddLabDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
      {editLab && chart.admissionId && (
        <UpdateLabDialog
          open
          onClose={() => setEditLab(null)}
          initial={editLab}
          onSubmit={(input) => updateMut.mutate({ admissionId: chart.admissionId!, labId: editLab.id, input })}
          busy={updateMut.isPending}
        />
      )}
    </SectionCard>
  );
}

function AddLabDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: LabInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [testNameAr, setTestNameAr] = useState('');
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('');
  const [reference, setReference] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (testNameAr.trim().length < 2) return;
    onSubmit({ admissionId, testNameAr, result, unit: unit || null, referenceRange: reference || null });
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
          <Button onClick={submit} loading={busy} icon={<PenLine className="h-4 w-4" />}>
            {t('laboratory.updateResult')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('laboratory.test')} value={testNameAr} onChange={(e) => setTestNameAr(e.target.value)} autoFocus placeholder="تعداد الدم الكامل CBC" />
        <div className="grid grid-cols-3 gap-3">
          <Input label={t('laboratory.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} dir="ltr" containerClassName="col-span-1" />
          <Input label={t('laboratory.reference')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" containerClassName="col-span-2" />
        </div>
        <Textarea label={t('laboratory.result')} rows={3} value={result} onChange={(e) => setResult(e.target.value)} />
      </div>
    </Dialog>
  );
}

function UpdateLabDialog({
  open,
  onClose,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: { test_name_ar: string; result: string | null; unit: string | null; reference_range: string | null };
  onSubmit: (i: LabResultInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [result, setResult] = useState(initial.result ?? '');
  const [unit, setUnit] = useState(initial.unit ?? '');
  const [reference, setReference] = useState(initial.reference_range ?? '');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('actions.enterResult')} — ${initial.test_name_ar}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSubmit({ result, unit: unit || null, referenceRange: reference || null })} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input label={t('laboratory.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} dir="ltr" containerClassName="col-span-1" />
          <Input label={t('laboratory.reference')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" containerClassName="col-span-2" />
        </div>
        <Textarea label={t('laboratory.result')} rows={3} value={result} onChange={(e) => setResult(e.target.value)} autoFocus />
      </div>
    </Dialog>
  );
}