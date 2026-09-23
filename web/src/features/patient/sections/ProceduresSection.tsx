import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Scissors, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Textarea } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type ProcedureInput, type ChartData } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';

export function ProceduresSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: API.addProcedure,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteProcedure(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  return (
    <SectionCard
      title={t('procedures.title')}
      action={
        canWrite && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t('procedures.add')}
          </Button>
        ) : undefined
      }
    >
      {chart.procedures.length === 0 ? (
        <EmptyLine>{t('procedures.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.procedures.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-900/40 dark:text-warning-300">
                <Scissors className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{p.name_ar}</p>
                <p className="text-xs text-ink/50">
                  {fmtDateTime(p.performed_at)} · {t('procedures.performedBy')}: {p.performed_by}
                </p>
                {p.notes && <p className="mt-1.5 text-sm text-ink/70">{p.notes}</p>}
              </div>
              {canWrite && chart.admissionId && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="mt-1 shrink-0 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                  onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: p.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AddProcedureDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
    </SectionCard>
  );
}

function AddProcedureDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: ProcedureInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState('');
  const [notes, setNotes] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (nameAr.trim().length < 2) return;
    onSubmit({ admissionId, nameAr, notes: notes || null });
    setNameAr('');
    setNotes('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('procedures.add')}
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
        <Input label={t('procedures.name')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
        <Textarea label={t('procedures.notes')} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}