import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser } from 'lucide-react';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const PHRASE = 'DELETE DEMO DATA';

/** حذف بيانات التجربة قبل تسليم النظام للمستشفيات (يظهر فقط ما دامت موجودة) */
export function PurgeDemoCard() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['demoStatus'], queryFn: API.demoStatus });
  const [typed, setTyped] = useState('');
  const purge = useMutation({
    mutationFn: () => API.purgeDemo(typed.trim()),
    onSuccess: () => {
      void qc.invalidateQueries();
      void refresh();
    },
  });

  if (purge.isSuccess)
    return (
      <Alert variant="success" title={t('purge.doneTitle')}>
        {t('purge.done', { backup: purge.data.backup })}
      </Alert>
    );
  if (!status.data?.present) return null;
  return (
    <Card className="border-danger-300 dark:border-danger-900/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger-700 dark:text-danger-300">
          <Eraser className="h-5 w-5" />
          {t('purge.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-ink/70">{t('purge.body')}</p>
        <ul className="text-sm text-ink/70">
          {status.data.hospitals.map((h) => (
            <li key={h.id}>
              • {h.name_ar} — {t('purge.counts', { p: h.patients, u: h.users })}
            </li>
          ))}
        </ul>
        <Alert variant="warning">{t('purge.warning')}</Alert>
        <Input label={t('purge.typeLabel', { phrase: PHRASE })} value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr" placeholder={PHRASE} />
        {purge.error && <Alert variant="danger">{(purge.error as Error).message}</Alert>}
        <Button variant="danger" icon={<Eraser className="h-4 w-4" />} loading={purge.isPending} disabled={typed.trim() !== PHRASE} onClick={() => purge.mutate()}>
          {t('purge.button')}
        </Button>
      </CardContent>
    </Card>
  );
}
