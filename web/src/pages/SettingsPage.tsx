import { useTranslation } from 'react-i18next';
import { Languages, Moon, Sun, ShieldCheck, Hospital } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useTheme } from '@/lib/theme';
import { setLanguage, currentLang } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { resolved, setPref } = useTheme();
  const { user } = useAuth();

  const themeOptions = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Sun },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('nav.settings')} subtitle={t('dashboard.subtitle')} />

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-brand-600" />
            {t('lang.label')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <SegmentedOption active={currentLang() === 'ar'} onClick={() => setLanguage('ar')}>
              {t('lang.ar')} · RTL
            </SegmentedOption>
            <SegmentedOption active={currentLang() === 'en'} onClick={() => setLanguage('en')}>
              {t('lang.en')} · LTR
            </SegmentedOption>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {resolved === 'dark' ? <Moon className="h-5 w-5 text-brand-600" /> : <Sun className="h-5 w-5 text-brand-600" />}
            {t('theme.' + resolved)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="radiogroup">
            {themeOptions.map((o) => (
              <SegmentedOption key={o.value} active={resolved === o.value} onClick={() => setPref(o.value)}>
                <o.icon className="h-4 w-4" />
                {o.label}
              </SegmentedOption>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hospital */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hospital className="h-5 w-5 text-brand-600" />
            {t('nav.hospital')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/70 p-4 dark:bg-white/5">
            <div>
              <p className="font-bold text-ink">{user?.hospital_name_ar}</p>
              <p className="text-sm text-ink/50">{user?.hospital_name_en}</p>
            </div>
            <Badge variant="brand">
              <ShieldCheck className="me-1 h-3.5 w-3.5" />
              {t('status.active')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentedOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200'
          : 'border-ink/12 text-ink/60 hover:bg-surface-muted dark:border-white/15 dark:text-white/60',
      )}
    >
      {children}
    </button>
  );
}