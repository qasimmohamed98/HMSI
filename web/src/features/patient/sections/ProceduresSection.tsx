import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Scissors, Trash2, Pencil } from 'lucide-react';
import { Button, Dialog, Input, Textarea } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type ProcedureUpdateInput, type ChartData } from '@/lib/api';
import type { Procedure } from '@hmsi/shared';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';

export function ProceduresSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Procedure | null>(null);

  const mut = useMutation({
    mutationFn: API.addProcedure,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string; input: ProcedureUpdateInput }) => API.updateProcedure(args.admissionId, args.id, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setEditTarget(null);
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
                <div className="mt-1 flex shrink-0 items-center gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditTarget(p)} aria-label={t('common.edit')}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                    onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: p.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddProcedureDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate({ admissionId: chart.admissionId ?? '', nameAr: i.nameAr ?? '', notes: i.notes ?? null })} busy={mut.isPending} />
      {editTarget && chart.admissionId && (
        <AddProcedureDialog
          open
          onClose={() => setEditTarget(null)}
          admissionId={chart.admissionId}
          initial={editTarget}
          onSubmit={(i) => updateMut.mutate({ admissionId: chart.admissionId!, id: editTarget.id, input: i })}
          busy={updateMut.isPending}
        />
      )}
    </SectionCard>
  );
}

function AddProcedureDialog({
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
  initial?: Pick<Procedure, 'name_ar' | 'notes'>;
  onSubmit: (i: ProcedureUpdateInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(initial?.name_ar ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  if (!admissionId) return null;
  const submit = () => {
    if (nameAr.trim().length < 2) return;
    onSubmit({ nameAr, notes: notes || null });
    setNameAr('');
    setNotes('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? t('common.edit') : t('procedures.add')}
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