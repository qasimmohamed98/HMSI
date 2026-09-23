import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pill, Timer, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Badge, Select } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type MedicationInput, type MedicationStatusInput, type ChartData } from '@/lib/api';
import { fmtDate, todayISO } from '@/lib/format';
import { useToast } from '@/components/ui';

export function MedicationsSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: API.addMedication,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; medicationId: string; input: MedicationStatusInput }) => API.updateMedicationStatus(args.admissionId, args.medicationId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteMedication(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const badge = (s: MedicationStatus) => ({
    active: 'success',
    discontinued: 'neutral',
    completed: 'info',
  })[s] as 'success' | 'neutral' | 'info';

  const setStatus = (m: (typeof chart.medications)[number], status: MedicationStatus) => {
    if (!chart.admissionId) return;
    updateMut.mutate({
      admissionId: chart.admissionId,
      medicationId: m.id,
      input: { status, endAt: status === 'active' ? null : todayISO() },
    });
  };

  return (
    <SectionCard
      title={t('medications.title')}
      action={
        canWrite && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t('medications.add')}
          </Button>
        ) : undefined
      }
    >
      {chart.medications.length === 0 ? (
        <EmptyLine>{t('medications.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.medications.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Pill className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-ink">{m.name_ar}</p>
                  <p className="text-xs text-ink/50">
                    {m.dose} · {m.route} · {m.frequency}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/45">
                    <Timer className="h-3 w-3" />
                    {fmtDate(m.start_at, { day: 'numeric', month: 'short' })}
                    {m.end_at ? ` ← ${fmtDate(m.end_at, { day: 'numeric', month: 'short' })}` : ''}
                    <span className="text-ink/30">·</span>
                    {t('medications.prescribedBy')}: {m.prescribed_by}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canWrite && chart.admissionId ? (
                  <div className="w-40">
                    <Select
                      value={m.status}
                      onChange={(e) => setStatus(m, e.target.value as MedicationStatus)}
                      options={(['active', 'discontinued', 'completed'] as MedicationStatus[]).map((s) => ({
                        value: s,
                        label: t(`medications.statuses.${s}`),
                      }))}
                    />
                  </div>
                ) : (
                  <Badge variant={badge(m.status)}>{t(`medications.statuses.${m.status}`)}</Badge>
                )}
                {canWrite && chart.admissionId && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                    onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: m.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMedicationDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
    </SectionCard>
  );
}

type MedicationStatus = 'active' | 'discontinued' | 'completed';

function AddMedicationDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: MedicationInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');
  const [frequency, setFrequency] = useState('');
  const [start, setStart] = useState(todayISO());

  if (!admissionId) return null;
  const submit = () => {
    if (nameAr.trim().length < 2 || !dose.trim()) return;
    onSubmit({ admissionId, nameAr, dose, route, frequency, startAt: start });
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