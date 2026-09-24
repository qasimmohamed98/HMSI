import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LogOut, DoorOpen, Printer } from 'lucide-react';
import { Button, Dialog, Textarea, Select, Alert } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type DischargeInput, type ChartData } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { printDischargeSummary } from './printDischarge';

export function DischargeSection({ chart, canDischarge }: { chart: ChartData; canDischarge: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const discharged = chart.patient.admission?.status === 'discharged';

  const mut = useMutation({
    mutationFn: API.discharge,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  return (
    <SectionCard
      title={t('discharge.title')}
      action={
        !discharged && canDischarge && chart.admissionId ? (
          <Button size="sm" variant="danger" onClick={() => setOpen(true)} icon={<LogOut className="h-4 w-4" />}>
            {t('discharge.add')}
          </Button>
        ) : undefined
      }
    >
      {discharged ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600 dark:bg-success-900/30 dark:text-success-300">
            <DoorOpen className="h-7 w-7" />
          </span>
          <p className="mt-1 font-bold text-ink">{t('status.discharged')}</p>
          {chart.patient.admission?.discharge_type && (
            <p className="text-sm text-ink/60">
              {t('history.dischargeType')}: {t(`discharge.types.${chart.patient.admission.discharge_type}`)}
            </p>
          )}
          {chart.patient.admission?.discharged_at && (
            <p className="text-sm text-ink/60">
              {t('history.dischargedAt')}: {fmtDateTime(chart.patient.admission.discharged_at)}
            </p>
          )}
          {chart.patient.admission?.discharge_summary && (
            <div className="mt-2 w-full max-w-xl rounded-lg bg-surface-muted/80 px-4 py-3 text-start dark:bg-white/5">
              <p className="text-xs font-bold text-ink/50">{t('history.dischargeSummary')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{chart.patient.admission.discharge_summary}</p>
            </div>
          )}
          <Button className="mt-3" variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printDischargeSummary(chart, t)}>
            {t('ui.printSummary')}
          </Button>
        </div>
      ) : (
        <EmptyLine>
          {!chart.admissionId ? t('ui.notAdmitted') : canDischarge ? t('ui.notDischarged') : `${t('ui.notDischarged')} — ${t('ui.dischargeNoPermission')}`}
        </EmptyLine>
      )}

      <DischargeDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
    </SectionCard>
  );
}

function DischargeDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: DischargeInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [type, setType] = useState('home');
  const [summary, setSummary] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    onSubmit({ admissionId, type: type as DischargeInput['type'], summary });
    setType('home');
    setSummary('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('discharge.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            {t('discharge.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert variant="warning">{t('ui.dischargeWarning')}</Alert>
        <Select
          label={t('discharge.type')}
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={['home', 'transfer', 'death', 'ama'].map((k) => ({ value: k, label: t(`discharge.types.${k}`) }))}
        />
        <Textarea label={t('history.dischargeSummary')} rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
    </Dialog>
  );
}