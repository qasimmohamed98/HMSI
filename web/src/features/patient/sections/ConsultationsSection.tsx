import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, MessagesSquare, Reply, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, Textarea, Badge } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type ConsultationInput, type ConsultationResponseInput, type ChartData } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';

export function ConsultationsSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<(typeof chart.consultations)[number] | null>(null);

  const mut = useMutation({
    mutationFn: API.addConsultation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const replyMut = useMutation({
    mutationFn: (args: { admissionId: string; consultationId: string; input: ConsultationResponseInput }) => API.respondConsultation(args.admissionId, args.consultationId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setReplyTo(null);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteConsultation(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  return (
    <SectionCard
      title={t('consultations.title')}
      action={
        canWrite && chart.admissionId ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t('consultations.add')}
          </Button>
        ) : undefined
      }
    >
      {chart.consultations.length === 0 ? (
        <EmptyLine>{t('consultations.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.consultations.map((c) => (
            <div key={c.id} className="rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    <MessagesSquare className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{c.specialty}</p>
                    <p className="text-xs text-ink/50">
                      {fmtDateTime(c.requested_at)} · {t('consultations.requestedBy')}: {c.requested_by}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.response ? <Badge variant="success" dot>{t('common.done')}</Badge> : <Badge variant="warning">{t('laboratory.statuses.ordered')}</Badge>}
                  {canWrite && chart.admissionId && (
                    <>
                      {!c.response && (
                        <Button size="sm" variant="outline" icon={<Reply className="h-3.5 w-3.5" />} onClick={() => setReplyTo(c)}>
                          {t('actions.respond')}
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                        onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, id: c.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-ink/70">{c.reason}</p>
              {c.response && (
                <div className="mt-3 flex gap-2 rounded-lg bg-surface-muted/80 px-3.5 py-3 dark:bg-white/5">
                  <Reply className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div>
                    <p className="text-sm leading-relaxed text-ink/85">{c.response}</p>
                    {c.responded_by && <p className="mt-1 text-xs text-ink/45">{c.responded_by}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddConsultationDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
      {replyTo && chart.admissionId && (
        <ReplyConsultationDialog
          open
          onClose={() => setReplyTo(null)}
          initial={replyTo}
          onSubmit={(input) => replyMut.mutate({ admissionId: chart.admissionId!, consultationId: replyTo.id, input })}
          busy={replyMut.isPending}
        />
      )}
    </SectionCard>
  );
}

function ReplyConsultationDialog({
  open,
  onClose,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: { specialty: string };
  onSubmit: (i: ConsultationResponseInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [response, setResponse] = useState('');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('actions.respond')} — ${initial.specialty}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => response.trim().length >= 2 && onSubmit({ response })} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea label={t('consultations.response')} rows={4} value={response} onChange={(e) => setResponse(e.target.value)} autoFocus />
      </div>
    </Dialog>
  );
}

function AddConsultationDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (i: ConsultationInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [specialty, setSpecialty] = useState('');
  const [reason, setReason] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (specialty.trim().length < 2 || reason.trim().length < 2) return;
    onSubmit({ admissionId, specialty, reason });
    setSpecialty('');
    setReason('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('consultations.add')}
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
        <Input label={t('consultations.specialty')} value={specialty} onChange={(e) => setSpecialty(e.target.value)} autoFocus placeholder="طب القلب" />
        <Textarea label={t('consultations.reason')} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Dialog>
  );
}