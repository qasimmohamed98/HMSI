import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardPlus, Info, Stethoscope } from 'lucide-react';
import type { Patient } from '@hmsi/shared';
import { Button, useToast } from '@/components/ui';
import { AdmitDialog } from '@/features/patients/AdmitDialog';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API } from '@/lib/api';

/**
 * المريض بلا زيارة مفتوحة ولا تنويم: الطلبات (أشعة، تحليل، دواء) تحتاج أحدهما —
 * نقول ذلك صراحة ونعطي الزرّين هنا بدل أن تختفي أزرار الطلب بلا تفسير.
 */
export function NoVisitBanner({ patient, canVisit, canAdmit, onVisit }: { patient: Patient; canVisit: boolean; canAdmit: boolean; onVisit: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [admitOpen, setAdmitOpen] = useState(false);
  const admit = useMutation({
    mutationFn: API.admitPatient,
    onSuccess: () => {
      setAdmitOpen(false);
      void qc.invalidateQueries({ queryKey: ['chart'] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      void qc.invalidateQueries({ queryKey: ['wards'] });
      toast.success(t('common.done'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-info-300 bg-info-50 px-4 py-3 text-sm text-info-900 print:hidden dark:border-info-900/60 dark:bg-info-900/20 dark:text-info-100">
      <Info className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 basis-64">
        <span className="font-bold">{t('encounter.noneTitle')}</span> {t('encounter.noneHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {canVisit && (
          <Button size="sm" icon={<ClipboardPlus className="h-4 w-4" />} onClick={onVisit}>
            {t('encounter.new')}
          </Button>
        )}
        {canAdmit && (
          <Button size="sm" variant="outline" icon={<Stethoscope className="h-4 w-4" />} onClick={() => setAdmitOpen(true)}>
            {t('admit.action')}
          </Button>
        )}
      </div>
      {admitOpen && <AdmitDialog open onClose={() => setAdmitOpen(false)} patient={patient} onSubmit={(input) => admit.mutate(input)} busy={admit.isPending} />}
    </div>
  );
}
