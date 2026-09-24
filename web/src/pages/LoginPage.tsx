import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, HeartPulse, Stethoscope, Lock, User as UserIcon, LogIn } from 'lucide-react';
import { Button, Input, Alert } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from '@/lib/auth';
import { API } from '@/lib/api';
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
  const { login } = useAuth();
  const { toggle, resolved } = useTheme();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t('errors.required'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message === 'unauthorized' ? t('auth.invalid') : t('auth.invalid'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="relative">
          <Logo light />
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
        <p className="relative text-sm text-white/50">© 2026 Hospital Management System</p>
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

              <Button type="submit" size="lg" className="w-full" loading={busy} icon={<LogIn className="h-5 w-5" />}>
                {t('auth.signIn')}
              </Button>
            </form>

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