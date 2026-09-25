import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * الخروج التلقائي عند الخمول (أجهزة المستشفى مشتركة).
 * الخادم ينهي الجلسة بعد 30 دقيقة بلا نشاط؛ الواجهة تنبّه قبل ذلك بدقيقة وتسجّل الخروج بنفسها.
 * آخر نشاط يُحفظ في localStorage لتتزامن كل التبويبات المفتوحة.
 */
const IDLE_MS = 29 * 60_000;
const WARN_MS = 60_000;
const KEY = 'hmsi.lastActivity';

const now = () => Date.now();
function readLast(): number {
  try {
    return Number(localStorage.getItem(KEY)) || now();
  } catch {
    return now();
  }
}
function writeLast(t: number) {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    /* التخزين غير متاح — يعمل المؤقت لهذا التبويب فقط */
  }
}

export function IdleLogout() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [left, setLeft] = useState<number | null>(null);
  const last = useRef(now());
  const lastWrite = useRef(0);

  const touch = useCallback(() => {
    const t0 = now();
    last.current = t0;
    // كتابة مرة كل 15 ثانية على الأكثر
    if (t0 - lastWrite.current > 15_000) {
      lastWrite.current = t0;
      writeLast(t0);
    }
  }, []);

  useEffect(() => {
    writeLast(now());
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = now() - Math.max(last.current, readLast());
      if (idle >= IDLE_MS) {
        window.clearInterval(timer);
        void logout();
        return;
      }
      setLeft(idle >= IDLE_MS - WARN_MS ? Math.ceil((IDLE_MS - idle) / 1000) : null);
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [touch, logout]);

  const stay = async () => {
    last.current = now();
    writeLast(last.current);
    setLeft(null);
    // طلب واحد يجدد نشاط الجلسة على الخادم
    await API.me().catch(() => undefined);
  };

  if (left === null) return null;
  return (
    <Dialog
      open
      onClose={() => void stay()}
      title={t('security.idleTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
          <Button onClick={() => void stay()}>{t('security.idleStay')}</Button>
        </>
      }
    >
      <p className="flex items-center gap-2 text-ink/75">
        <Timer className="h-5 w-5 text-warning-600" />
        {t('security.idleBody', { count: left })}
      </p>
    </Dialog>
  );
}
