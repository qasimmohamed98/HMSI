import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Pencil } from 'lucide-react';
import { vitalsIntervalHours } from '@hmsi/shared';
import { Alert, Button, Dialog, Input, Select, Textarea, useToast } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type CarePlan, type CarePlanInput, type ChartData } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';

const FIELDS = ['goals', 'diet', 'activity', 'monitoring', 'nursing_instructions'] as const;

/** الخطة العلاجية: يضعها الطبيب، ويعدّل الممرض تكرار قياس العلامات الحيوية فقط */
export function CarePlanSection({ chart, canEdit, canEditVitals }: { chart: ChartData; canEdit: boolean; canEditVitals: boolean }) {
  const { t } = useTranslation();
  const admissionId = chart.admissionId!;
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['carePlan', admissionId], queryFn: () => API.carePlan(admissionId) });
  const plan = q.data;
  const interval = vitalsIntervalHours(plan?.vitals_interval_hours ?? null);

  return (
    <SectionCard
      title={t('carePlan.title')}
      description={plan ? t('carePlan.updatedBy', { name: plan.updated_by, at: fmtDateTime(plan.updated_at) }) : undefined}
      action={
        canEdit || canEditVitals ? (
          <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setOpen(true)}>
            {plan ? t('common.edit') : t('carePlan.create')}
          </Button>
        ) : undefined
      }
    >
      {!plan ? (
        <EmptyLine>{t('carePlan.empty')}</EmptyLine>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 font-semibold text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              <ClipboardCheck className="h-4 w-4" />
              {t('carePlan.vitalsEvery', { count: interval })}
            </span>
            {plan.review_at && <span className="rounded-lg bg-ink/5 px-3 py-1.5 text-ink/70 dark:bg-white/5">{t('carePlan.reviewAt')}: {fmtDate(plan.review_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => plan[f]).map((f) => (
              <div key={f} className={f === 'goals' || f === 'nursing_instructions' ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs font-bold text-ink/50">{t(`carePlan.${f}`)}</dt>
                <dd className="whitespace-pre-line text-sm text-ink">{plan[f]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {open && <PlanDialog admissionId={admissionId} plan={plan ?? null} doctor={canEdit} onClose={() => setOpen(false)} />}
    </SectionCard>
  );
}

function PlanDialog({ admissionId, plan, doctor, onClose }: { admissionId: string; plan: CarePlan | null; doctor: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<CarePlanInput>({
    goals: plan?.goals ?? '',
    diet: plan?.diet ?? '',
    activity: plan?.activity ?? '',
    monitoring: plan?.monitoring ?? '',
    nursing_instructions: plan?.nursing_instructions ?? '',
    vitals_interval_hours: plan?.vitals_interval_hours ?? 4,
    review_at: plan?.review_at?.slice(0, 10) ?? '',
  });
  const save = useMutation({
    mutationFn: () =>
      API.saveCarePlan(
        admissionId,
        doctor
          ? { ...f, review_at: f.review_at || null }
          : { vitals_interval_hours: f.vitals_interval_hours },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['carePlan', admissionId] });
      void qc.invalidateQueries({ queryKey: ['rounds'] });
      toast.success(t('common.done'));
      onClose();
    },
  });
  const text = (k: (typeof FIELDS)[number], rows = 2) => (
    <Textarea label={t(`carePlan.${k}`)} rows={rows} value={(f[k] as string) ?? ''} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} placeholder={t(`carePlan.${k}Hint`)} />
  );
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('carePlan.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {!doctor && <Alert variant="info">{t('carePlan.nurseHint')}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('carePlan.vitalsInterval')}
            value={String(f.vitals_interval_hours ?? 4)}
            onChange={(e) => setF((x) => ({ ...x, vitals_interval_hours: Number(e.target.value) }))}
            options={[1, 2, 4, 6, 8, 12, 24].map((h) => ({ value: String(h), label: t('carePlan.vitalsEvery', { count: h }) }))}
          />
          {doctor && <Input label={t('carePlan.reviewAt')} type="date" value={f.review_at ?? ''} onChange={(e) => setF((x) => ({ ...x, review_at: e.target.value }))} />}
        </div>
        {doctor && (
          <>
            {text('goals', 3)}
            <div className="grid grid-cols-2 gap-3">
              {text('diet', 1)}
              {text('activity', 1)}
            </div>
            {text('monitoring')}
            {text('nursing_instructions', 3)}
          </>
        )}
        <p className="text-xs text-ink/50">{t('carePlan.mewsHint')}</p>
        {save.error && <Alert variant="danger">{(save.error as Error).message}</Alert>}
      </div>
    </Dialog>
  );
}
