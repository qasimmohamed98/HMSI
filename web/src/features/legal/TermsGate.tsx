import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { TERMS_VERSION } from '@hmsi/shared';
import { Alert, Button } from '@/components/ui';
import { QLockup } from '@/components/brand/QBrand';
import { currentLang } from '@/i18n';
import { LEGAL_AR, LEGAL_EN } from '@/i18n/content/legal';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * قبل أي عمل: الموظف يوافق على شروط الاستخدام وسياسة الخصوصية (وعند كل إصدار جديد منها).
 * الخادم يرفض أي بيانات قبل الموافقة (403 terms_required) — هذه الشاشة واجهة ذلك فقط.
 */
export function TermsGate() {
  const { t } = useTranslation();
  const { user, refresh, logout } = useAuth();
  const L = currentLang() === 'en' ? LEGAL_EN : LEGAL_AR;
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await API.acceptTerms(TERMS_VERSION);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-ink/10 bg-surface-raised p-6 shadow-xl sm:p-8 dark:border-white/10">
        <QLockup className="h-8 w-auto" />
        <div className="mt-6 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-brand-600" />
          <h1 className="text-xl font-extrabold text-ink">{t('legal.gateTitle')}</h1>
        </div>
        <p className="mt-2 text-sm text-ink/65">{t('legal.gateIntro', { name: currentLang() === 'en' ? user?.full_name_en || user?.full_name_ar : user?.full_name_ar })}</p>

        <ul className="mt-5 space-y-2.5">
          {L.pledge.map((x) => (
            <li key={x} className="flex gap-2.5 rounded-xl bg-surface-muted px-3 py-2.5 text-sm leading-relaxed text-ink/85 dark:bg-white/5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              {x}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm">
          <Link to="/privacy" target="_blank" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {L.privacy.title}
          </Link>
          {' · '}
          <Link to="/terms" target="_blank" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {L.terms.title}
          </Link>
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/12 p-3 dark:border-white/15">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
          <span className="text-sm font-semibold text-ink">{t('legal.agree')}</span>
        </label>

        {error && (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button onClick={() => void accept()} disabled={!agree} loading={busy}>
            {t('legal.accept')}
          </Button>
          <button type="button" onClick={() => void logout()} className="text-sm font-semibold text-ink/55 hover:text-ink">
            {t('legal.decline')}
          </button>
        </div>
      </div>
    </div>
  );
}
