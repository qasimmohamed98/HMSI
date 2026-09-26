import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Bell, TriangleAlert, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { API, type AppNotification } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentLang } from '@/i18n';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRounds, useVitalsRounds } from '@/features/rounds/useRounds';
import { audioBlocked, loadPrefs, playAlert, unlockAudio, vibrate, type AlertLevel, type AlertPrefs } from '@/lib/alert-sound';

/**
 * مركز التنبيهات المكتوبة والمسموعة (مركَّب مرة واحدة في AppShell):
 * - يراقب إشعارات المستخدم كل 20 ثانية (حتى والتبويب في الخلفية)
 * - الجديد منها: بطاقة مكتوبة + صوت حسب الخطورة + اهتزاز + إشعار الجهاز إن كانت النافذة غير ظاهرة
 * - الحرج: شريط أحمر ثابت أعلى الشاشة وصوت يتكرر حتى يضغط المستخدم «اطّلعت»
 * - تبويبات متعددة: الصوت وإشعار الجهاز مرة واحدة فقط لكل تنبيه
 */

const POLL_MS = 20_000;
const REPEAT_MS = 20_000;
const REPEAT_MAX_MS = 15 * 60_000;
const CARD_MS = 15_000;
/** عند فتح النظام: التنبيهات الحرجة غير المقروءة خلال هذه المدة تُعرض فوراً */
const CRITICAL_BACKLOG_MS = 60 * 60_000;

function claim(id: string): boolean {
  // أول تبويب يسجّل المفتاح هو من يُصدر الصوت
  try {
    const k = `hmsi.alerted.${id}`;
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

function cleanupClaims() {
  try {
    const old = Date.now() - 2 * 86_400_000;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('hmsi.alerted.') && Number(localStorage.getItem(k)) < old) localStorage.removeItem(k);
    }
  } catch {
    /* */
  }
}

async function showDeviceNotification(n: AppNotification, title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const opts: NotificationOptions & { renotify?: boolean; requireInteraction?: boolean } = {
    body,
    tag: n.id,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: n.link ?? '/' },
    requireInteraction: n.severity === 'critical',
    lang: currentLang(),
    dir: currentLang() === 'ar' ? 'rtl' : 'ltr',
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, opts));
  } catch {
    /* نجرب الطريقة المباشرة */
  }
  try {
    const x = new Notification(title, opts);
    x.onclick = () => {
      window.focus();
      if (n.link) window.location.assign(n.link);
      x.close();
    };
  } catch {
    /* غير مدعوم (بعض متصفحات الهاتف دون Service Worker) */
  }
}

export function AlertCenter() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<AlertPrefs>(() => loadPrefs(user?.id));
  const [cards, setCards] = useState<AppNotification[]>([]);
  const [critical, setCritical] = useState<AppNotification[]>([]);
  const [blocked, setBlocked] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const criticalSince = useRef<number>(0);

  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: API.listNotifications,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    enabled: Boolean(user),
  });

  useEffect(() => {
    const onPrefs = () => setPrefs(loadPrefs(user?.id));
    window.addEventListener('hmsi:alert-prefs', onPrefs);
    // المتصفح يسمح بالصوت بعد أول تفاعل فقط
    const unlock = () => {
      unlockAudio();
      setBlocked(false);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    cleanupClaims();
    // إشعار دفع وصل والنظام ظاهر: الـ Service Worker لا يعرضه ويطلب تحديث التنبيهات فوراً بدل انتظار الدورة
    const onSw = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'hmsi-push') void qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    navigator.serviceWorker?.addEventListener('message', onSw);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSw);
      window.removeEventListener('hmsi:alert-prefs', onPrefs);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [user?.id, qc]);

  const text = useCallback(
    (n: AppNotification) => {
      const en = currentLang() === 'en';
      return { title: (en && n.title_en) || n.title_ar, body: (en && n.body_en) || n.body_ar || '' };
    },
    [],
  );

  const announce = useCallback(
    (n: AppNotification) => {
      const level = n.severity as AlertLevel;
      if (!claim(n.id)) return;
      if (prefs.sound && !(prefs.importantOnly && level === 'info')) {
        playAlert(level, prefs.volume);
        if (audioBlocked()) setBlocked(true);
      }
      if (prefs.vibrate && level !== 'info') vibrate(level);
      const { title, body } = text(n);
      if (prefs.desktop && (document.hidden || !document.hasFocus())) void showDeviceNotification(n, title, body);
    },
    [prefs, text],
  );

  // اكتشاف الجديد
  useEffect(() => {
    const data = list.data;
    if (!data) return;
    const unread = data.filter((n) => !n.is_read);
    if (seen.current === null) {
      // أول تحميل: لا ضجيج على القديم، إلا الحرج الحديث غير المقروء
      seen.current = new Set(data.map((n) => n.id));
      const backlog = unread.filter((n) => n.severity === 'critical' && Date.now() - Date.parse(n.created_at) < CRITICAL_BACKLOG_MS);
      if (backlog.length) {
        setCritical(backlog);
        criticalSince.current = Date.now();
        backlog.forEach(announce);
      }
      return;
    }
    const fresh = unread.filter((n) => !seen.current!.has(n.id));
    data.forEach((n) => seen.current!.add(n.id));
    if (fresh.length) {
      void qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
      fresh.forEach(announce);
      const crit = fresh.filter((n) => n.severity === 'critical');
      if (crit.length) {
        setCritical((c) => [...crit, ...c.filter((x) => !crit.some((y) => y.id === x.id))]);
        criticalSince.current = Date.now();
      }
      const rest = fresh.filter((n) => n.severity !== 'critical');
      if (rest.length) setCards((c) => [...rest, ...c].slice(0, 4));
    }
    // ما قُرئ من الجرس أو تبويب آخر يختفي من هنا
    const readIds = new Set(data.filter((n) => n.is_read).map((n) => n.id));
    setCritical((c) => (c.some((x) => readIds.has(x.id)) ? c.filter((x) => !readIds.has(x.id)) : c));
    setCards((c) => (c.some((x) => readIds.has(x.id)) ? c.filter((x) => !readIds.has(x.id)) : c));
  }, [list.data, announce, qc]);

  // البطاقات العادية تختفي تلقائياً
  useEffect(() => {
    if (!cards.length) return;
    const id = window.setTimeout(() => setCards((c) => c.slice(0, -1)), CARD_MS);
    return () => window.clearTimeout(id);
  }, [cards]);

  // تكرار صوت الحرج حتى الإقرار
  useEffect(() => {
    if (!critical.length || !prefs.sound) return;
    const id = window.setInterval(() => {
      if (Date.now() - criticalSince.current > REPEAT_MAX_MS) return;
      playAlert('critical', prefs.volume);
      if (prefs.vibrate) vibrate('critical');
    }, REPEAT_MS);
    return () => window.clearInterval(id);
  }, [critical.length, prefs]);

  const onSchedule = useCallback(
    (n: AppNotification) => {
      announce(n);
      setCards((c) => [n, ...c.filter((x) => x.id !== n.id)].slice(0, 4));
    },
    [announce],
  );

  const markRead = async (ids: string[]) => {
    await Promise.all(ids.filter((id) => !id.startsWith('sched-')).map((id) => API.readNotification(id).catch(() => undefined)));
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const ack = () => {
    const ids = critical.map((n) => n.id);
    setCritical([]);
    void markRead(ids);
  };
  const open = (n: AppNotification) => {
    setCritical((c) => c.filter((x) => x.id !== n.id));
    setCards((c) => c.filter((x) => x.id !== n.id));
    void markRead([n.id]);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;
  return (
    <>
      {user.role === 'nurse' && (
        <ScheduleWatcher onAlert={onSchedule} />
      )}
      {critical.length > 0 && (
        <div role="alertdialog" aria-live="assertive" aria-label={t('alerts.criticalTitle')} className="fixed inset-x-0 top-0 z-[60] print:hidden">
          <div className="mx-auto max-w-3xl p-2 sm:p-3">
            <div className="rounded-2xl border-2 border-danger-400 bg-danger-700 p-3 text-white shadow-2xl ring-4 ring-danger-500/30 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50 motion-reduce:hidden" />
                  <AlertOctagon className="relative h-6 w-6" />
                </span>
                <p className="flex-1 text-base font-extrabold">{t('alerts.criticalTitle')}</p>
                <Button size="sm" className="bg-white text-danger-700 hover:bg-danger-50" onClick={ack}>
                  {t('alerts.ack')}
                </Button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {critical.slice(0, 4).map((n) => {
                  const x = text(n);
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => open(n)} className="w-full rounded-lg bg-white/10 px-3 py-2 text-start hover:bg-white/20">
                        <span className="block font-bold">{x.title}</span>
                        {x.body && <span className="block text-sm text-white/85">{x.body}</span>}
                        <span className="block text-xs text-white/70 tabular">{fmtDateTime(n.created_at)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed bottom-20 end-3 z-[55] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2 print:hidden lg:bottom-4">
        {blocked && prefs.sound && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-warning-300 bg-warning-50 px-3 py-2 text-sm font-semibold text-warning-900 shadow-lg dark:border-warning-900/60 dark:bg-warning-900/40 dark:text-warning-100">
            <Volume2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t('alerts.enableSound')}</span>
            <Button size="sm" variant="outline" onClick={() => { unlockAudio(); setBlocked(false); }}>
              {t('alerts.enable')}
            </Button>
          </div>
        )}
        {cards.map((n) => {
          const x = text(n);
          const Icon = n.severity === 'warning' ? TriangleAlert : Bell;
          return (
            <div
              key={n.id}
              role="status"
              className={cn(
                'pointer-events-auto flex gap-3 rounded-xl border bg-surface-raised p-3 shadow-xl',
                n.severity === 'warning' ? 'border-warning-300 dark:border-warning-900/60' : 'border-ink/10 dark:border-white/10',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', n.severity === 'warning' ? 'text-warning-600' : 'text-brand-600')} />
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => open(n)}>
                <span className="block text-sm font-bold text-ink">{x.title}</span>
                {x.body && <span className="block truncate text-xs text-ink/60">{x.body}</span>}
              </button>
              <button type="button" aria-label={t('a11y.close')} onClick={() => setCards((c) => c.filter((y) => y.id !== n.id))} className="self-start rounded p-0.5 text-ink/40 hover:bg-ink/5">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * تنبيه الممرض بمواعيد مرضاه المعيَّنين: جرعة حان موعدها أو تأخرت، وعلامات حيوية حان قياسها أو تأخر.
 * كل موعد يُنبَّه مرة عند «حان» ومرة عند «تأخر». عند فتح النظام: ملخص واحد بالمتأخر بدل سيل تنبيهات.
 */
function ScheduleWatcher({ onAlert }: { onAlert: (n: AppNotification) => void }) {
  const { t } = useTranslation();
  const meds = useRounds(undefined, true);
  const vitals = useVitalsRounds(undefined, true);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!meds.data || !vitals.data) return;
    const now = new Date().toISOString();
    const events: AppNotification[] = [];
    for (const { m, s } of meds.items) {
      if ((s.state !== 'due' && s.state !== 'overdue') || !s.due_at) continue;
      const late = s.state === 'overdue';
      events.push({
        id: `sched-med-${m.id}-${s.due_at}-${s.state}`,
        kind: 'dose_due',
        severity: late ? 'warning' : 'info',
        title_ar: `${late ? 'جرعة متأخرة' : 'حان موعد الجرعة'}: ${m.name_ar} ${m.dose ?? ''}`.trim(),
        title_en: `${late ? 'Overdue dose' : 'Dose due'}: ${m.name_en || m.name_ar} ${m.dose ?? ''}`.trim(),
        body_ar: `${m.full_name_ar} · ${m.room}/${m.bed_no}`,
        body_en: `${m.full_name_en || m.full_name_ar} · ${m.room}/${m.bed_no}`,
        link: '/medication-rounds',
        created_at: now,
        is_read: false,
      });
    }
    for (const { v, s } of vitals.items) {
      if (s.state !== 'due' && s.state !== 'overdue') continue;
      const late = s.state === 'overdue';
      events.push({
        id: `sched-vit-${v.admission_id}-${s.due_at}-${s.state}`,
        kind: 'vitals_due',
        severity: late ? 'warning' : 'info',
        title_ar: late ? 'قياس العلامات الحيوية متأخر' : 'حان قياس العلامات الحيوية',
        title_en: late ? 'Vital signs overdue' : 'Vital signs due',
        body_ar: `${v.full_name_ar} · ${v.room}/${v.bed_no}`,
        body_en: `${v.full_name_en || v.full_name_ar} · ${v.room}/${v.bed_no}`,
        link: `/patients/${v.patient_id}?tab=vitals`,
        created_at: now,
        is_read: false,
      });
    }
    if (seen.current === null) {
      seen.current = new Set(events.map((e) => e.id));
      const late = events.filter((e) => e.severity === 'warning').length;
      if (late > 0) {
        onAlert({
          id: `sched-summary-${now.slice(0, 13)}`,
          kind: 'schedule_summary',
          severity: 'warning',
          title_ar: t('alerts.lateSummary', { count: late, lng: 'ar' }),
          title_en: t('alerts.lateSummary', { count: late, lng: 'en' }),
          body_ar: null,
          body_en: null,
          link: '/medication-rounds',
          created_at: now,
          is_read: false,
        });
      }
      return;
    }
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      onAlert(e);
    }
  }, [meds.data, meds.items, vitals.data, vitals.items, onAlert, t]);

  return null;
}
