import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { FAMILY_SHARE_CATEGORIES, FAMILY_SHARE_DOCTOR_ONLY, type AdmissionSummary, type FamilyShare } from '@hmsi/shared';
import { Alert, Button, Dialog, Textarea, useToast } from '@/components/ui';
import { API } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * يحدد الطاقم ما يراه ذوو المريض في صفحة المتابعة (بعد إدخال رمز العائلة).
 * الفئات السريرية للطبيب فقط؛ التمريض: العلامات الحيوية والرسالة.
 */
export function FamilyShareDialog({
  patientId,
  admission,
  isDoctor,
  onClose,
}: {
  patientId: string;
  admission: AdmissionSummary;
  isDoctor: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [share, setShare] = useState<FamilyShare>(admission.family_share ?? { vitals: true });
  const [message, setMessage] = useState(admission.family_message ?? '');

  const mut = useMutation({
    mutationFn: () =>
      API.updateFamilyShare(admission.id, {
        share: Object.fromEntries(FAMILY_SHARE_CATEGORIES.map((k) => [k, Boolean(share[k])])),
        message: message.trim() === (admission.family_message ?? '') ? undefined : message.trim() || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', patientId] });
      toast.success(t('familyShare.saved'));
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('familyShare.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink/60">{t('familyShare.hint')}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          {FAMILY_SHARE_CATEGORIES.map((k) => {
            const locked = FAMILY_SHARE_DOCTOR_ONLY.includes(k) && !isDoctor;
            const on = Boolean(share[k]);
            return (
              <label
                key={k}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                  on ? 'border-brand-400 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-900/20' : 'border-ink/12 dark:border-white/12',
                  locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-muted dark:hover:bg-white/5',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  checked={on}
                  disabled={locked}
                  onChange={(e) => setShare((s) => ({ ...s, [k]: e.target.checked }))}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-bold text-ink">
                    {t(`familyShare.categories.${k}`)}
                    {locked && <Lock className="h-3 w-3" />}
                  </span>
                  <span className="block text-xs text-ink/50">{t(`familyShare.details.${k}`)}</span>
                </span>
              </label>
            );
          })}
        </div>
        {!isDoctor && <Alert variant="info">{t('familyShare.doctorOnly')}</Alert>}

        <div>
          <Textarea label={t('familyShare.message')} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} placeholder={t('familyShare.messagePlaceholder')} />
          {admission.family_message_at && (
            <p className="mt-1 text-xs text-ink/45">
              {t('familyShare.messageBy', { by: admission.family_message_by ?? '—' })} · <span className="tabular">{fmtDateTime(admission.family_message_at)}</span>
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
