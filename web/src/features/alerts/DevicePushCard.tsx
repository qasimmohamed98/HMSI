import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, BellOff, Download, MonitorSmartphone, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@/components/ui';
import { localizeServerMessage } from '@/i18n/server-messages';
import type { PushLevel } from '@/lib/api';
import { API } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  IS_LIVE,
  canPromptInstall,
  disablePush,
  enablePush,
  isIOS,
  isMobile,
  isStandalone,
  onInstallChange,
  promptInstall,
  pushSupport,
  setPushLevel,
  syncPush,
} from '@/lib/push-client';

/** تثبيت النظام كتطبيق + إشعارات الدفع على هذا الجهاز (صفحة الإعدادات، #device) */
export function DevicePushCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const support = pushSupport();
  const [installable, setInstallable] = useState(canPromptInstall());
  const [standalone] = useState(isStandalone());
  const [state, setState] = useState<{ subscribed: boolean; level: PushLevel | null } | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(() => (typeof Notification === 'undefined' ? null : Notification.permission));
  const [busy, setBusy] = useState(false);

  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);
  useEffect(() => {
    if (support !== 'ok') return setState({ subscribed: false, level: null });
    syncPush()
      .then(setState)
      .catch(() => setState({ subscribed: false, level: null }));
  }, [support]);

  const fail = (e: unknown) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));

  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await enablePush(state?.level ?? 'all');
      setPerm(typeof Notification === 'undefined' ? null : Notification.permission);
      if (r === 'ok') {
        setState({ subscribed: true, level: state?.level ?? 'all' });
        toast.success(t('device.pushOn'));
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      setState({ subscribed: false, level: null });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const changeLevel = async (level: PushLevel) => {
    setState((s) => (s ? { ...s, level } : s));
    await setPushLevel(level).catch(fail);
  };

  const test = async () => {
    try {
      await API.pushTest();
      toast.success(t('device.testSent'));
    } catch (e) {
      fail(e);
    }
  };

  const phone = isMobile();
  const on = state?.subscribed === true;

  return (
    <Card id="device">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5 text-brand-600" />
          {t('device.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-ink/60">{t('device.intro')}</p>

        {/* التثبيت كتطبيق */}
        <section className="space-y-2 rounded-xl border border-ink/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink">{t('device.installTitle')}</h3>
            {standalone ? <Badge variant="success">{t('device.installed')}</Badge> : installable && (
              <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => void promptInstall()}>
                {t('device.install')}
              </Button>
            )}
          </div>
          {!standalone && (
            <>
              <p className="text-sm text-ink/65">{phone ? t('device.installPhone') : t('device.installDesktop')}</p>
              {!installable && <p className="text-sm text-ink/80">{isIOS() ? t('device.iosSteps') : phone ? t('device.androidSteps') : t('device.desktopSteps')}</p>}
            </>
          )}
        </section>

        {/* الإشعارات */}
        <section className="space-y-3 rounded-xl border border-ink/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink">{t('device.pushTitle')}</h3>
            {support === 'ok' && state && <Badge variant={on ? 'success' : 'neutral'}>{on ? t('device.pushOn') : t('device.pushOff')}</Badge>}
          </div>

          {!IS_LIVE ? (
            <p className="text-sm text-ink/60">{t('device.demo')}</p>
          ) : support === 'ios-install' ? (
            <Alert variant="warning">{t('device.iosRequired')}</Alert>
          ) : support === 'unsupported' ? (
            <p className="text-sm text-ink/60">{t('device.unsupported')}</p>
          ) : perm === 'denied' ? (
            <Alert variant="warning">{t('device.denied')}</Alert>
          ) : on ? (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">{t('device.level')}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('device.level')}>
                  {(['all', 'important', 'critical'] as PushLevel[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={state?.level === l}
                      onClick={() => void changeLevel(l)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                        state?.level === l
                          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200'
                          : 'border-ink/12 text-ink/60 hover:bg-surface-muted dark:border-white/15 dark:text-white/60',
                      )}
                    >
                      {t(`device.level_${l}`)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink/50">{t('device.levelHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => void test()}>
                  {t('device.test')}
                </Button>
                <Button size="sm" variant="ghost" icon={<BellOff className="h-4 w-4" />} loading={busy} onClick={() => void turnOff()}>
                  {t('device.disable')}
                </Button>
              </div>
            </>
          ) : (
            <Button icon={<BellRing className="h-4 w-4" />} loading={busy || state === null} onClick={() => void turnOn()}>
              {t('device.enable')}
            </Button>
          )}

          {support === 'ok' && (
            <ul className="list-disc space-y-1 ps-5 text-xs text-ink/50">
              {phone && !isIOS() && <li>{t('device.battery')}</li>}
              <li>{t('device.logoutNote')}</li>
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
