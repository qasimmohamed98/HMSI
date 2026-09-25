import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, HeartPulse, Stethoscope, Lock, User as UserIcon, LogIn } from 'lucide-react';
import { Button, Input, Alert } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { QLockup } from '@/components/brand/QBrand';
import { useAuth } from '@/lib/auth';
import { API } from '@/lib/api';
import { DEVELOPER } from '@/lib/developer';
import { ProductsLink } from '@/features/products/OurProducts';
import { setLanguage, currentLang } from '@/i18n';
import { useTheme } from '@/lib/theme';

const FEATURES = [
  { icon: Stethoscope, key: 'auth.features.chart' },
  { icon: Activity, key: 'auth.features.vitals' },
  { icon: ShieldCheck, key: 'auth.features.security' },
  { icon: HeartPulse, key: 'auth.features.family' },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, completeMfa } = useAuth();
  const { toggle, resolved } = useTheme();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mfaToken ? code.trim().length < 6 : !username || !password) {
      setError(t('errors.required'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mfaToken) {
        await completeMfa(mfaToken, code.trim());
      } else {
        const r = await login(username, password);
        if (r) {
          setMfaToken(r.mfaToken);
          return;
        }
      }
      navigate('/', { replace: true });
    } catch (err) {
      // «بيانات غير صحيحة» فقط عند 401 — أعطال الخادم أو الشبكة أو حد المحاولات تُعرض كما هي
      const status = (err as { status?: number })?.status;
      if (mfaToken && status === 401) {
        // رمز خاطئ، أو انتهت التذكرة (5 محاولات / 5 دقائق) → العودة لكلمة المرور
        const msg = err instanceof Error ? err.message : '';
        if (/انتهت|expired/i.test(msg)) {
          setMfaToken(null);
          setCode('');
          setError(t('twofa.expired'));
        } else setError(t('twofa.wrongCode'));
      } else if (status === undefined || status === 401) setError(t('auth.invalid'));
      else if (status === 429) setError(t('auth.tooMany'));
      else if (status === 0) setError(t('auth.network'));
      else setError(currentLang() === 'ar' && err instanceof Error && err.message ? err.message : t('auth.serverError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      {/* Brand panel */}
      <div className="q-on-dark relative hidden overflow-hidden bg-[var(--q-ink)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* شبكة «مخطط الإنتاج» من هوية Q */}
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative">
          <QLockup className="h-12" />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-snug">{t('auth.heroTitle')}</h1>
          <p className="mt-4 text-lg font-medium text-white/75">
            {t('auth.heroSubtitle')}
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="font-semibold text-white/90">{t(f.key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex flex-wrap gap-3 text-sm text-white/60">
          <span dir="ltr">© 2026 Q VIREXA</span>
          <Link to="/guide" className="hover:text-white">{t('nav.guide')}</Link>
          <Link to="/system" className="hover:text-white">{t('nav.aboutSystem')}</Link>
          <Link to="/about" className="hover:text-white">{t('nav.about')}</Link>
          <ProductsLink source="login-panel" className="text-[var(--q-b-light,#3CE0C3)] hover:text-white" />
          <Link to="/about" className="font-bold tracking-wide text-white/75 hover:text-white" dir="ltr">
            DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}
          </Link>
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLanguage(currentLang() === 'ar' ? 'en' : 'ar')}
              className="rounded-lg px-3 py-2 text-sm font-bold text-ink/70 hover:bg-surface-muted dark:text-white/70"
            >
              {currentLang() === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg px-3 py-2 text-sm font-bold text-ink/70 hover:bg-surface-muted dark:text-white/70"
            >
              {resolved === 'dark' ? t('theme.light') : t('theme.dark')}
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-extrabold text-ink">{t('auth.welcome')}</h2>
            <p className="mt-1.5 text-sm text-ink/55">{t('auth.subtitle')}</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              {error && <Alert variant="danger">{error}</Alert>}

              {mfaToken ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                    <ShieldCheck className="h-5 w-5 text-brand-600" />
                    {t('twofa.loginPrompt')}
                  </p>
                  <Input
                    label={t('twofa.codeLabel')}
                    hint={t('twofa.codeHint')}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    inputMode="text"
                    dir="ltr"
                    className="text-center font-mono text-lg tracking-[0.3em]"
                    maxLength={11}
                    autoFocus
                  />
                  <button type="button" className="text-xs font-semibold text-ink/50 hover:underline" onClick={() => { setMfaToken(null); setCode(''); setError(''); }}>
                    {t('twofa.back')}
                  </button>
                </div>
              ) : (
              <>
              <Input
                label={t('auth.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                icon={<UserIcon className="h-4 w-4" />}
                autoFocus
              />
              <Input
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" />}
              />
              </>
              )}

              <Button type="submit" size="lg" className="w-full" loading={busy} icon={<LogIn className="h-5 w-5" />}>
                {t('auth.signIn')}
              </Button>
            </form>

            {/* لمن لا يملك حساباً: تسجيل مستشفى بفترة تجريبية دون التواصل مع مدير النظام */}
            <div className="mt-6 rounded-xl border border-ink/10 p-4 text-center dark:border-white/10">
              <p className="text-sm font-semibold text-ink/70">{t('signup.noAccount')}</p>
              <Link to="/signup" className="mt-2 inline-flex items-center justify-center rounded-lg bg-brand-50 px-4 py-2 text-sm font-extrabold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200">
                {t('signup.cta')}
              </Link>
              <p className="mt-2 text-xs text-ink/45">{t('signup.staffHint')}</p>
            </div>
            <p className="mt-4 flex justify-center gap-4 text-xs font-semibold text-ink/50 lg:hidden">
              <Link to="/guide" className="hover:underline">{t('nav.guide')}</Link>
              <Link to="/system" className="hover:underline">{t('nav.aboutSystem')}</Link>
              <Link to="/about" className="hover:underline">{t('nav.about')}</Link>
            </p>
            <p className="mt-2 text-center text-xs lg:hidden">
              <ProductsLink source="login-mobile" className="text-brand-700 dark:text-brand-300" />
            </p>
            <p className="mt-3 text-center text-[0.7rem] font-bold tracking-wide text-ink/40 lg:hidden" dir="ltr">
              DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}
            </p>

            {/* تلميح الحسابات التجريبية فقط في وضع العرض — لا يظهر أبداً في الإنتاج */}
            {API.mode === 'demo' && (
              <div className="mt-6 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-4 text-center dark:border-brand-800 dark:bg-brand-950/30">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">{t('auth.demoHint')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}