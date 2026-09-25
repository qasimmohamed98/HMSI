import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, LogOut } from 'lucide-react';
import { Alert, Button, Card, CardContent, Input } from '@/components/ui';
import { QLockup } from '@/components/brand/QBrand';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * تغيير إجباري لكلمة المرور: كلمة مؤقتة أعطاها المدير أو كلمة ضعيفة/معروفة.
 * يحل محل النظام كله حتى تُغيَّر (والخادم يرفض أي طلب بيانات قبل ذلك).
 */
export function ForcePasswordChange() {
  const { t } = useTranslation();
  const { user, refresh, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) return setError(t('password.mismatch'));
    setBusy(true);
    try {
      await API.changePassword(current, next);
      await refresh();
    } catch (err) {
      setError((err as Error).message || t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <QLockup className="h-9" />
        </div>
        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-lg font-extrabold text-ink">{t('security.forceTitle')}</h1>
                  <p className="text-sm text-ink/60">{user?.username}</p>
                </div>
              </div>
              <Alert variant="warning">{t('security.forceHint')}</Alert>
              {error && <Alert variant="danger">{error}</Alert>}
              <Input id="fp-current" label={t('password.current')} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" dir="ltr" required />
              <Input id="fp-new" label={t('password.new')} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" dir="ltr" hint={t('security.strongRule')} required />
              <Input id="fp-confirm" label={t('password.confirm')} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" dir="ltr" required />
              <Button type="submit" className="w-full" loading={busy} icon={<KeyRound className="h-4 w-4" />}>
                {t('security.forceSubmit')}
              </Button>
              <Button type="button" variant="ghost" className="w-full" icon={<LogOut className="h-4 w-4" />} onClick={() => void logout()}>
                {t('nav.logout')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
