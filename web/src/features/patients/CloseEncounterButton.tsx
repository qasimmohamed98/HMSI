import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DoorClosed } from 'lucide-react';
import type { DischargeType } from '@hmsi/shared';
import { Button, Dialog, Select, useToast } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API } from '@/lib/api';

/** إغلاق زيارة بلا تنويم (مراجع/طوارئ/فحص) — التنويم يُغلق بالخروج الطبي */
export function CloseEncounterButton({ admissionId }: { admissionId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<DischargeType>('home');
  const [summary, setSummary] = useState('');
  const close = useMutation({
    mutationFn: () => API.closeEncounter(admissionId, { outcome, summary: summary.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart'] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      setOpen(false);
      toast.success(t('encounter.closed'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });
  return (
    <>
      <Button size="sm" variant="outline" icon={<DoorClosed className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {t('encounter.close')}
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={t('encounter.closeTitle')}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => close.mutate()} loading={close.isPending}>
                {t('encounter.close')}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-ink/60">{t('encounter.closeHint')}</p>
          <div className="space-y-4">
            <Select
              label={t('encounter.outcome')}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as DischargeType)}
              options={(['home', 'transfer', 'ama', 'death'] as const).map((o) => ({ value: o, label: t(`encounter.outcomes.${o}`) }))}
            />
            <Textarea label={t('encounter.summary')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={2000} />
          </div>
        </Dialog>
      )}
    </>
  );
}
