import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellRing, Download, Smartphone, Monitor } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { IS_LIVE, canPromptInstall, enablePush, isIOS, isMobile, isStandalone, onInstallChange, promptInstall, pushSupport, syncPush } from '@/lib/push-client';

const SNOOZE_DAYS = 7;

/**
 * نصيحة أعلى النظام: ثبّت Q VIREXA (الشاشة الرئيسية للهاتف، سطح المكتب للحاسوب) وفعّل الإشعارات.
 * تختفي عند اكتمال الأمرين، أو أسبوعاً عند «لاحقاً».
 */
export function DeviceSetupBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const key = `hmsi.deviceBanner.${user?.id ?? ''}`;
  const [snoozed, setSnoozed] = useState(() => {
    try {
      return Date.now() < Number(localStorage.getItem(key) ?? 0);
    } catch {
      return false;
    }
  });
  const [installable, setInstallable] = useState(canPromptInstall());
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const support = pushSupport();
  const standalone = isStandalone();

  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);
  useEffect(() => {
    if (!IS_LIVE || snoozed) return;
    if (support !== 'ok') return setSubscribed(false);
    // يربط اشتراك الجهاز بالمستخدم الحالي عند كل فتح للنظام
    syncPush()
      .then((s) => setSubscribed(s.subscribed))
      .catch(() => setSubscribed(false));
  }, [support, snoozed, user?.id]);

  if (!IS_LIVE || !user || snoozed || subscribed === null) return null;
  const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const needPush = support === 'ok' && !subscribed && !denied;
  // آيفون من Safari: الإشعارات تحتاج التثبيت أولاً
  // (أندرويد والحاسوب: فقط إن عرض المتصفح التثبيت — أي أنه غير مثبت بعد)
  const needInstall = !standalone && (isIOS() || installable);
  if (!needPush && !needInstall) return null;

  const snooze = () => {
    try {
      localStorage.setItem(key, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    } catch {
      /* */
    }
    setSnoozed(true);
  };
  const turnOn = async () => {
    const r = await enablePush('all').catch(() => 'error' as const);
    if (r === 'ok') setSubscribed(true);
  };

  const phone = isMobile();
  const Icon = needInstall ? (phone ? Smartphone : Monitor) : BellRing;
  const text = needInstall ? (phone ? t('device.bannerPhone') : t('device.bannerDesktop')) : t('device.bannerPush');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm text-brand-900 print:hidden dark:border-brand-800/60 dark:bg-brand-900/25 dark:text-brand-100">
      <Icon className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-60">
        <span className="font-bold">{t('device.bannerTitle')}: </span>
        {text}
        {needInstall && isIOS() && !installable && <span className="mt-1 block text-xs text-brand-900/75 dark:text-brand-100/75">{t('device.iosSteps')}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {needInstall && installable && (
          <button type="button" onClick={() => void promptInstall()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">
            <Download className="h-3.5 w-3.5" />
            {t('device.install')}
          </button>
        )}
        {needPush && (
          <button type="button" onClick={() => void turnOn()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">
            <BellRing className="h-3.5 w-3.5" />
            {t('device.enable')}
          </button>
        )}
        <Link to="/settings#device" className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-800 underline-offset-2 hover:underline dark:text-brand-200">
          {t('device.how')}
        </Link>
        <button type="button" onClick={snooze} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-800/70 hover:bg-brand-100 dark:text-brand-200/70 dark:hover:bg-brand-900/40">
          {t('device.later')}
        </button>
      </div>
    </div>
  );
}
