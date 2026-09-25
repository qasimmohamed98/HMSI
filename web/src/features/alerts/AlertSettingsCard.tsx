import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Play } from 'lucide-react';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { loadPrefs, playAlert, savePrefs, unlockAudio, vibrate, type AlertLevel, type AlertPrefs } from '@/lib/alert-sound';

/** إعدادات التنبيهات المسموعة والمكتوبة (لكل مستخدم على هذا الجهاز) */
export function AlertSettingsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [p, setP] = useState<AlertPrefs>(() => loadPrefs(user?.id));
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));

  const update = (patch: Partial<AlertPrefs>) => {
    const next = { ...p, ...patch };
    setP(next);
    if (user) savePrefs(user.id, next);
  };

  const askDesktop = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const r = await Notification.requestPermission();
      setPerm(r);
      if (r !== 'granted') return update({ desktop: false });
    }
    update({ desktop: on });
  };

  const test = (level: AlertLevel) => {
    unlockAudio();
    playAlert(level, p.volume);
    if (p.vibrate) vibrate(level);
  };

  return (
    <Card id="alerts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-brand-600" />
          {t('alerts.settingsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink/60">{t('alerts.settingsIntro')}</p>

        <Toggle label={t('alerts.sound')} checked={p.sound} onChange={(v) => update({ sound: v })} />
        {p.sound && (
          <div className="space-y-3 ps-1">
            <label className="flex items-center gap-3 text-sm text-ink/75">
              <span className="w-24 shrink-0">{t('alerts.volume')}</span>
              <input type="range" min={0.1} max={1} step={0.1} value={p.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="flex-1 accent-brand-600" />
            </label>
            <Toggle label={t('alerts.importantOnly')} checked={p.importantOnly} onChange={(v) => update({ importantOnly: v })} />
            <div className="flex flex-wrap gap-2">
              {(['info', 'warning', 'critical'] as AlertLevel[]).map((l) => (
                <Button key={l} size="sm" variant="outline" icon={<Play className="h-3.5 w-3.5" />} onClick={() => test(l)}>
                  {t(`alerts.test_${l}`)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Toggle label={t('alerts.vibrate')} checked={p.vibrate} onChange={(v) => update({ vibrate: v })} />

        {perm === 'unsupported' ? (
          <p className="text-xs text-ink/50">{t('alerts.desktopUnsupported')}</p>
        ) : (
          <>
            <Toggle label={t('alerts.desktop')} hint={t('alerts.desktopHint')} checked={p.desktop && perm === 'granted'} onChange={(v) => void askDesktop(v)} />
            {perm === 'denied' && <Alert variant="warning">{t('alerts.desktopDenied')}</Alert>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink/50">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-ink/20 dark:bg-white/20'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </label>
  );
}
