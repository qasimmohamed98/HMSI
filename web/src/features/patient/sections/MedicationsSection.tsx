import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pill, Timer, Trash2, Pencil } from 'lucide-react';
import { Button, Dialog, Input, Badge, Select } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type MedicationStatusInput, type ChartData } from '@/lib/api';
import type { Medication } from '@hmsi/shared';
import { fmtDate, todayISO, localName } from '@/lib/format';
import { MarStrip } from './MarStrip';
import { useToast, useConfirm } from '@/components/ui';

export function MedicationsSection({ chart, canWrite, canAdminister = false }: { chart: ChartData; canWrite: boolean; canAdminister?: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Medication | null>(null);

  const mut = useMutation({
    mutationFn: API.addMedication,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; medicationId: string; input: MedicationStatusInput }) => API.updateMedication(args.admissionId, args.medicationId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setEditTarget(null);
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
            <div key={m.id} className="rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    <Pill className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{localName(m, 'name')}</p>
                    <p className="text-xs text-ink/50">
                      {m.dose} · {m.route} · {m.frequency}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/45">
                      <Timer className="h-3 w-3" />
                      {fmtDate(m.start_at, { day: 'numeric', month: 'short' })}
                      {m.end_at ? ` – ${fmtDate(m.end_at, { day: 'numeric', month: 'short' })}` : ''}
                      <span className="text-ink/30">·</span>
                      {t('medications.prescribedBy')}: {m.prescribed_by}
                    </p>
                    {m.status === 'active' && (
                      <p className={`mt-0.5 text-xs font-semibold ${m.dispensed_at ? 'text-info-600' : 'text-warning-700'}`}>
                        {m.dispensed_at ? `${t('ui.dispensed')} · ${m.dispensed_by}` : t('ui.notDispensed')}
                      </p>
                    )}
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
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditTarget(m)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canWrite && chart.admissionId && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                      onClick={async () => { if (await confirm(t('ui.confirmDeleteRecord'))) deleteMut.mutate({ admissionId: chart.admissionId!, id: m.id }); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <MarStrip chart={chart} medication={m} canAdminister={canAdminister} />
            </div>
          ))}
        </div>
      )}

      <AddMedicationDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate({ admissionId: chart.admissionId ?? '', nameAr: i.nameAr ?? '', dose: i.dose ?? '', route: i.route ?? '', frequency: i.frequency ?? '', startAt: i.startAt ?? todayISO() })} busy={mut.isPending} />
      {editTarget && chart.admissionId && (
        <AddMedicationDialog
          open
          onClose={() => setEditTarget(null)}
          admissionId={chart.admissionId}
          initial={editTarget}
          onSubmit={(i) => updateMut.mutate({ admissionId: chart.admissionId!, medicationId: editTarget.id, input: i })}
          busy={updateMut.isPending}
        />
      )}
    </SectionCard>
  );
}

type MedicationStatus = 'active' | 'discontinued' | 'completed';

function AddMedicationDialog({
  open,
  onClose,
  admissionId,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  initial?: Pick<Medication, 'name_ar' | 'dose' | 'route' | 'frequency' | 'start_at'>;
  onSubmit: (i: MedicationStatusInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(initial?.name_ar ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');
  const [route, setRoute] = useState(initial?.route ?? '');
  const [frequency, setFrequency] = useState(initial?.frequency ?? '');
  const [start, setStart] = useState(initial?.start_at ?? todayISO());

  if (!admissionId) return null;
  const submit = () => {
    if (nameAr.trim().length < 2 || !dose.trim()) return;
    onSubmit({ nameAr, dose, route, frequency, startAt: start });
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
      title={initial ? t('common.edit') : t('medications.add')}
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
        <Input label={t('medications.name')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder={t('examples.medication')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('medications.dose')} value={dose} onChange={(e) => setDose(e.target.value)} placeholder={t('examples.dose')} />
          <Input label={t('medications.route')} value={route} onChange={(e) => setRoute(e.target.value)} placeholder="PO" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('medications.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder={t('examples.frequency')} />
          <Input label={t('medications.start')} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}