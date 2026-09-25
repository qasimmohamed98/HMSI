import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Alert, Button, Card, CardContent, Textarea } from '@/components/ui';
import { API } from '@/lib/api';

/** الطبيب فتح ملف مريض ليس من مرضاه: شرح + وصول طارئ بسبب مكتوب (مُدقَّق ومُبلَّغ للمدير) */
export function NotYourPatient({ patientId, onGranted }: { patientId: string; onGranted: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const grant = useMutation({ mutationFn: () => API.emergencyAccess(patientId, reason.trim()), onSuccess: onGranted });
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-ink">{t('careTeam.notYoursTitle')}</h1>
            <p className="text-sm text-ink/60">{t('careTeam.notYoursBody')}</p>
          </div>
        </div>
        <Alert variant="warning">{t('careTeam.emergencyHint')}</Alert>
        <Textarea label={t('careTeam.emergencyReason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        {grant.error && <Alert variant="danger">{(grant.error as Error).message}</Alert>}
        <Button variant="danger" loading={grant.isPending} disabled={reason.trim().length < 5} onClick={() => grant.mutate()}>
          {t('careTeam.emergencyButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
