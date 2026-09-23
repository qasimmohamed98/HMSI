import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Stethoscope, FilePenLine, Send, Pencil, Trash2 } from 'lucide-react';
import { Button, Textarea, Avatar, Dialog } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { API, type NoteInput, type NoteUpdateInput, type ChartData } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function NotesSection({ chart, kind, canWrite }: { chart: ChartData; kind: 'doctor' | 'nursing'; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [editNote, setEditNote] = useState<(typeof chart.notes)[number] | null>(null);

  const notes = chart.notes.filter((n) => n.kind === kind);

  const mut = useMutation({
    mutationFn: (input: NoteInput) => API.addNote(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setText('');
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; noteId: string; input: NoteUpdateInput }) => API.updateNote(args.admissionId, args.noteId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setEditNote(null);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; noteId: string }) => API.deleteNote(args.admissionId, args.noteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const submit = () => {
    const content = text.trim();
    if (!content || !chart.admissionId) return;
    mut.mutate({ admissionId: chart.admissionId, kind, content });
  };

  const canEditNote = (authorId?: string | null) =>
    canWrite && chart.admissionId && (!authorId || authorId === user?.id || user?.role === 'super_admin' || API.mode === 'demo');

  const titleKey = kind === 'doctor' ? 'notes.doctorTitle' : 'notes.nursingTitle';
  const emptyKey = kind === 'doctor' ? 'notes.emptyDoctor' : 'notes.emptyNursing';

  return (
    <SectionCard
      title={t(titleKey)}
      description={chart.patient.admission?.department_name_ar}
      action={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
          {kind === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <FilePenLine className="h-4 w-4" />}
        </span>
      }
    >
      {canWrite && chart.admissionId && (
        <div className="mb-4 rounded-xl border border-ink/8 bg-surface-muted/50 p-3 dark:border-white/10 dark:bg-white/5">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('notes.write')} />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={submit} loading={mut.isPending} icon={<Send className="h-4 w-4" />}>
              {t('notes.add')}
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyLine>{t(emptyKey)}</EmptyLine>
      ) : (
        <div className="space-y-5">
          {notes.map((n) => (
            <div key={n.id} className="relative flex gap-4 rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <Avatar name={n.author} className="h-9 w-9 shrink-0 text-xs" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
                  <span className="font-bold text-brand-700 dark:text-brand-300">{n.author}</span>
                  <span className="text-ink/25">·</span>
                  <span className="tabular">{fmtDateTime(n.recorded_at)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink/90">{n.content}</p>
              </div>
              {canEditNote(n.author_id) && (
                <div className="flex shrink-0 gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditNote(n)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                    onClick={() => deleteMut.mutate({ admissionId: chart.admissionId!, noteId: n.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editNote && chart.admissionId && (
        <Dialog
          open
          onClose={() => setEditNote(null)}
          title={t('actions.edit')}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditNote(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => updateMut.mutate({ admissionId: chart.admissionId!, noteId: editNote.id, input: { content: editNote.content } })}
                loading={updateMut.isPending}
              >
                {t('common.save')}
              </Button>
            </>
          }
        >
          <Textarea rows={4} value={editNote.content} onChange={(e) => setEditNote({ ...editNote, content: e.target.value })} autoFocus />
        </Dialog>
      )}
    </SectionCard>
  );
}