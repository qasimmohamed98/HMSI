import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Archive,
  BedDouble,
  Building2,
  CheckCircle2,
  FileBarChart2,
  FlaskConical,
  HeartPulse,
  Printer,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { SYSTEM_AR, SYSTEM_EN } from '@/i18n/content/system';
import { currentLang } from '@/i18n';

const ICONS: Record<string, LucideIcon> = {
  patients: Users,
  chart: Stethoscope,
  nursing: HeartPulse,
  mews: Activity,
  services: FlaskConical,
  wards: BedDouble,
  family: QrCode,
  reports: FileBarChart2,
  print: Printer,
  offline: WifiOff,
  trash: Archive,
  multi: Building2,
};

/** صفحة «عن النظام» — عامة، تشرح النظام لمن يفكر في استخدامه ولمستخدميه الجدد */
export default function SystemPage() {
  const { t } = useTranslation();
  const c = currentLang() === 'en' ? SYSTEM_EN : SYSTEM_AR;
  return (
    <PublicLayout>
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{c.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/85">{c.summary}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/signup" className="rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-800 hover:bg-brand-50">
            {t('signup.cta')}
          </Link>
        </div>
      </section>

      <h2 className="mb-4 mt-10 text-2xl font-extrabold text-ink">{c.modulesTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {c.modules.map((m) => {
          const Icon = ICONS[m.key] ?? CheckCircle2;
          return (
            <Card key={m.key}>
              <CardContent className="space-y-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-extrabold text-ink">{m.title}</p>
                <p className="text-sm leading-relaxed text-ink/65">{m.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-extrabold text-ink">{c.flowTitle}</h2>
      <ol className="grid gap-3 md:grid-cols-4">
        {c.flow.map((f, i) => (
          <li key={f.title} className="relative rounded-2xl border border-ink/10 bg-surface-raised p-4 dark:border-white/10">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{i + 1}</span>
            <p className="font-extrabold text-ink">{f.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/65">{f.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mb-4 mt-10 text-2xl font-extrabold text-ink">{c.rolesTitle}</h2>
      <Card>
        <CardContent className="divide-y divide-ink/6 p-0 dark:divide-white/5">
          {c.roles.map((r) => (
            <div key={r.role} className="grid gap-1 px-5 py-3 sm:grid-cols-[12rem_1fr]">
              <p className="font-extrabold text-ink">{r.role}</p>
              <p className="text-sm text-ink/65">{r.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-lg font-extrabold text-ink">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              {c.securityTitle}
            </p>
            <ul className="space-y-2 text-sm text-ink/70">
              {c.security.map((s) => (
                <li key={s} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-lg font-extrabold text-ink">
              <Activity className="h-5 w-5 text-brand-600" />
              {c.techTitle}
            </p>
            <ul className="space-y-2 text-sm text-ink/70">
              {c.tech.map((s) => (
                <li key={s} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                  {s}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink/45">{t('ui.version', { v: __APP_VERSION__ })}</p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
