import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, Building2, CalendarClock, CreditCard, Lock, Phone, User as UserIcon } from 'lucide-react';
import { Alert, Button, Card, CardContent, Input } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentLang, setLanguage } from '@/i18n';

/** تسجيل مستشفى جديد بفترة تجريبية مجانية — دون الحاجة للتواصل مع مدير النظام */
export default function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { data: info } = useQuery({ queryKey: ['publicPaymentInfo'], queryFn: API.publicPaymentInfo, retry: false });
  const [form, setForm] = useState({ hospitalNameAr: '', hospitalNameEn: '', city: '', contactPhone: '', fullNameAr: '', email: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const trialDays = info?.trial_days ?? 14;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError(t('signup.mismatch'));
    setBusy(true);
    try {
      await API.signup({
        hospitalNameAr: form.hospitalNameAr.trim(),
        hospitalNameEn: form.hospitalNameEn.trim() || null,
        city: form.city.trim() || null,
        contactPhone: form.contactPhone.trim(),
        fullNameAr: form.fullNameAr.trim(),
        email: form.email.trim() || null,
        username: form.username.trim(),
        password: form.password,
      });
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/login">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setLanguage(currentLang() === 'ar' ? 'en' : 'ar')} className="rounded-lg px-3 py-2 text-sm font-bold text-ink/70 hover:bg-surface-muted">
              {currentLang() === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link to="/login" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-brand-700 hover:bg-surface-muted dark:text-brand-300">
              <ArrowRight className="h-4 w-4 ltr:rotate-180" />
              {t('signup.haveAccount')}
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Card>
            <CardContent>
              <h1 className="text-2xl font-extrabold text-ink">{t('signup.title')}</h1>
              <p className="mt-1 text-sm text-ink/60">{t('signup.subtitle', { days: trialDays })}</p>

              <form onSubmit={submit} className="mt-6 space-y-6">
                {error && <Alert variant="danger">{error}</Alert>}

                <fieldset className="space-y-4">
                  <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                    <Building2 className="h-4 w-4 text-brand-600" />
                    {t('signup.hospitalSection')}
                  </legend>
                  <Input label={t('signup.hospitalNameAr')} value={form.hospitalNameAr} onChange={set('hospitalNameAr')} required minLength={3} autoFocus />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={t('signup.hospitalNameEn')} value={form.hospitalNameEn} onChange={set('hospitalNameEn')} dir="ltr" />
                    <Input label={t('signup.city')} value={form.city} onChange={set('city')} />
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                    <UserIcon className="h-4 w-4 text-brand-600" />
                    {t('signup.adminSection')}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={t('signup.fullName')} value={form.fullNameAr} onChange={set('fullNameAr')} required minLength={3} />
                    <Input label={t('signup.phone')} value={form.contactPhone} onChange={set('contactPhone')} required inputMode="tel" dir="ltr" icon={<Phone className="h-4 w-4" />} placeholder="07xx xxx xxxx" />
                  </div>
                  <Input label={t('signup.email')} type="email" value={form.email} onChange={set('email')} dir="ltr" />
                  <Input label={t('auth.username')} value={form.username} onChange={set('username')} required dir="ltr" autoComplete="username" hint={t('signup.usernameHint')} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={t('auth.password')} type="password" value={form.password} onChange={set('password')} required dir="ltr" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} hint={t('password.rule')} />
                    <Input label={t('signup.confirm')} type="password" value={form.confirm} onChange={set('confirm')} required dir="ltr" autoComplete="new-password" />
                  </div>
                </fieldset>

                <Button type="submit" size="lg" className="w-full" loading={busy} icon={<BadgeCheck className="h-5 w-5" />}>
                  {t('signup.submit', { days: trialDays })}
                </Button>
                <p className="text-center text-xs text-ink/50">{t('signup.terms')}</p>
              </form>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-2 font-extrabold text-ink">
                  <CalendarClock className="h-5 w-5 text-brand-600" />
                  {t('signup.howTitle')}
                </p>
                <ol className="list-inside list-decimal space-y-2 text-sm text-ink/70">
                  <li>{t('signup.how1', { days: trialDays })}</li>
                  <li>{t('signup.how2')}</li>
                  <li>{t('signup.how3')}</li>
                  <li>{t('signup.how4')}</li>
                </ol>
              </CardContent>
            </Card>
            {info && (info.price || info.bank_name || info.phone) && (
              <Card>
                <CardContent className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-extrabold text-ink">
                    <CreditCard className="h-5 w-5 text-brand-600" />
                    {t('billing.priceTitle')}
                  </p>
                  {info.price && <p className="text-lg font-extrabold text-brand-700 dark:text-brand-300">{info.price}</p>}
                  {info.notes && <p className="whitespace-pre-wrap text-ink/65">{info.notes}</p>}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
