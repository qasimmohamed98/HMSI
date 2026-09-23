import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Paperclip, Upload, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { API, type ChartData } from '@/lib/api';
import { useToast } from '@/components/ui';

export function AttachmentsSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => API.uploadAttachment(chart.admissionId!, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const del = useMutation({
    mutationFn: (attachmentId: string) => API.deleteAttachment(chart.admissionId!, attachmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('attachments.tooBig'));
      return;
    }
    upload.mutate(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <SectionCard
      title={t('attachments.title')}
      action={
        canWrite && chart.admissionId ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={upload.isPending} icon={<Upload className="h-4 w-4" />}>
              {t('attachments.upload')}
            </Button>
          </>
        ) : undefined
      }
    >
      {chart.attachments.length === 0 ? (
        <EmptyLine>{t('attachments.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink/50 dark:bg-white/10 dark:text-white/50">
                <Paperclip className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink" dir="ltr">{a.file_name}</p>
                <p className="text-xs text-ink/50">
                  {fmtBytes(a.size)} · {fmtDateTime(a.created_at)} · {a.uploaded_by}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <a href={API.attachmentUrl(chart.admissionId!, a.id)} target="_blank" rel="noreferrer" download={a.file_name}>
                  <Button size="icon-sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                {canWrite && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                    onClick={() => del.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}