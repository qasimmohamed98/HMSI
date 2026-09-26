import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Paperclip } from 'lucide-react';
import { hasPermission, type ChartData } from '@hmsi/shared';
import { Button, useToast } from '@/components/ui';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtBytes } from '@/lib/format';

const MAX_SIZE = 18 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

/**
 * ملفات مرتبطة بفحص محدد: صور تقرير الأشعة أو نسخة PDF من التقرير، أو ورقة نتيجة المختبر.
 * الرفع لمن يملك files.manage (الأطباء، التمريض، فني/طبيب الأشعة، المختبر).
 */
export function RecordFiles({ chart, recordType, recordId }: { chart: ChartData; recordType: 'radiology' | 'lab'; recordId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const files = chart.attachments.filter((a) => a.record_type === recordType && a.record_id === recordId);
  const canUpload = Boolean(chart.admissionId) && hasPermission(user?.role, 'files.manage');
  const admissionId = chart.admissionId;

  const upload = useMutation({
    mutationFn: (file: File) => API.uploadAttachment(admissionId!, file, { type: recordType, id: recordId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart'] });
      void qc.invalidateQueries({ queryKey: ['dept', 'admitted'] });
      toast.success(t('attachments.attached'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  const pick = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.size > MAX_SIZE) return toast.error(t('attachments.tooBig'));
    if (!ALLOWED.includes(file.type)) return toast.error(t('attachments.badType'));
    upload.mutate(file);
  };

  if (!canUpload && files.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {files.map((f) => (
        <a
          key={f.id}
          href={API.attachmentUrl(f.admission_id, f.id)}
          target="_blank"
          rel="noreferrer"
          download={f.file_name}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ink/10 bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink/75 hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:bg-white/5"
          title={`${f.file_name} · ${fmtBytes(f.size)}`}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" dir="ltr">
            {f.file_name}
          </span>
          <span className="shrink-0 text-ink/40">{fmtBytes(f.size)}</span>
        </a>
      ))}
      {canUpload && (
        <>
          <input ref={input} type="file" accept={ALLOWED.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <Button size="sm" variant="ghost" loading={upload.isPending} icon={<Paperclip className="h-3.5 w-3.5" />} onClick={() => input.current?.click()}>
            {t('attachments.attach')}
          </Button>
        </>
      )}
    </div>
  );
}
