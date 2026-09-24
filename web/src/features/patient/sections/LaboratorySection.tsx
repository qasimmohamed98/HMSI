import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FlaskConical, PenLine, Trash2, Tag } from 'lucide-react';
import { printSpecimenLabel } from '@/lib/labels';
import { Button, Dialog, Input, Textarea, Badge } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type LabInput, type ChartData, type LabResultInput } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast, useConfirm } from '@/components/ui';

/** canOrder: طلب فحص (الطبيب) — canResult: إدخال النتائج (فني المختبر) */
export function LaboratorySection({ chart, canOrder, canResult }: { chart: ChartData; canOrder: boolean; canResult: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editLab, setEditLab] = useState<(typeof chart.labs)[number] | null>(null);

  const canAdd = (canOrder || canResult) && chart.patient.admission?.status === 'active';

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
        canAdd && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {canResult ? t('laboratory.addResult') : t('orders.labOrder')}
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
                  {chart.admissionId && (
                    <>
                      {(l.status === 'ordered' || l.status === 'in_progress') && (
                        <Button size="icon-sm" variant="ghost" aria-label={t('labels.specimen')} title={t('labels.specimen')} onClick={() => printSpecimenLabel(chart.patient, chart.admissionId!, l, t)}>
                          <Tag className="h-4 w-4" />
                        </Button>
                      )}
                      {canResult && (l.status === 'ordered' || l.status === 'in_progress') && (
                        <Button size="sm" variant="outline" icon={<PenLine className="h-3.5 w-3.5" />} onClick={() => setEditLab(l)}>
                          {t('actions.enterResult')}
                        </Button>
                      )}
                      {(canResult || (canOrder && l.status === 'ordered')) && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                          onClick={async () => { if (await confirm(t('ui.confirmDeleteRecord'))) deleteMut.mutate({ admissionId: chart.admissionId!, id: l.id }); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
                    {l.reference_range && (
                      <span className="text-xs font-medium text-ink/45">
                        {t('laboratory.reference')}: <bdi dir="ltr">{l.reference_range}</bdi>
                      </span>
                    )}
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

      <AddLabDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} withResult={canResult} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
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

function AddLabDialog({ open, onClose, admissionId, withResult, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; withResult: boolean; onSubmit: (i: LabInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [testNameAr, setTestNameAr] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('');
  const [reference, setReference] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (testNameAr.trim().length < 2) return;
    onSubmit({ admissionId, testNameAr, category: category || null, result: withResult ? result.trim() || null : null, unit: unit || null, referenceRange: reference || null });
    setTestNameAr('');
    setCategory('');
    setResult('');
    setUnit('');
    setReference('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={withResult ? t('laboratory.addResult') : t('orders.labOrder')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} icon={<PenLine className="h-4 w-4" />}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('laboratory.test')} value={testNameAr} onChange={(e) => setTestNameAr(e.target.value)} autoFocus placeholder="تعداد الدم الكامل CBC" />
        <Input label={t('orders.category')} value={category} onChange={(e) => setCategory(e.target.value)} />
        {withResult && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Input label={t('laboratory.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} dir="ltr" containerClassName="col-span-1" />
              <Input label={t('laboratory.reference')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" containerClassName="col-span-2" />
            </div>
            <Textarea label={t('orders.resultOptional')} rows={3} value={result} onChange={(e) => setResult(e.target.value)} />
          </>
        )}
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
  const [abnormal, setAbnormal] = useState(false);

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
          <Button onClick={() => onSubmit({ result, unit: unit || null, referenceRange: reference || null, abnormal })} loading={busy} disabled={!result.trim()}>
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
        <label className="flex items-center gap-2 text-sm font-semibold text-danger-600">
          <input type="checkbox" checked={abnormal} onChange={(e) => setAbnormal(e.target.checked)} className="h-4 w-4 accent-danger-500" />
          {t('orders.abnormal')}
        </label>
      </div>
    </Dialog>
  );
}