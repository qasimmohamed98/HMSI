import type { MiddlewareHandler } from 'hono';
import type { Subscription } from '@hmsi/shared';
import { getSession } from '../middleware/auth.js';

export const TRIAL_DAYS = 14;
const DAY = 86_400_000;

/**
 * حالة اشتراك المستشفى من تاريخي نهاية التجربة والاشتراك.
 * كلاهما فارغ = unlimited (مستشفى أنشأه المدير العام). الوصول حتى أبعد التاريخين.
 */
export function computeSubscription(trialEndsAt: unknown, subscriptionEndsAt: unknown, now = Date.now()): Subscription {
  const trial = trialEndsAt ? Date.parse(String(trialEndsAt)) : NaN;
  const sub = subscriptionEndsAt ? Date.parse(String(subscriptionEndsAt)) : NaN;
  if (Number.isNaN(trial) && Number.isNaN(sub)) return { status: 'unlimited', ends_at: null, days_left: null };
  const until = Math.max(Number.isNaN(trial) ? 0 : trial, Number.isNaN(sub) ? 0 : sub);
  const endsAt = new Date(until).toISOString();
  if (now >= until) return { status: 'expired', ends_at: endsAt, days_left: 0 };
  const daysLeft = Math.ceil((until - now) / DAY);
  return { status: !Number.isNaN(sub) && sub > now ? 'active' : 'trial', ends_at: endsAt, days_left: daysLeft };
}

/** نهاية الفترة التجريبية لمستشفى جديد */
export function trialEnd(now = Date.now()): string {
  return new Date(now + TRIAL_DAYS * DAY).toISOString();
}

/** المسارات المسموحة لمستشفى انتهى اشتراكه: الدخول/الخروج، صفحة الدفع، والصفحات العامة */
// تصدير بيانات المستشفى متاح دائماً: البيانات ملك المستشفى
const ALLOWED_WHEN_EXPIRED = ['/api/auth/', '/api/billing', '/api/public/', '/api/system/export', '/api/system/client-errors', '/api/health'];

/**
 * مستشفى انتهت تجربته أو اشتراكه: يدخل مستخدموه لكن لا يصلون لأي بيانات حتى يُجدَّد الاشتراك.
 * المدير العام غير مقيّد (ليستطيع التفعيل والمتابعة).
 */
export function subscriptionGuard(): MiddlewareHandler {
  return async (c, next) => {
    const s = getSession(c);
    if (s && s.user.role !== 'super_admin' && s.user.subscription?.status === 'expired') {
      const path = new URL(c.req.url).pathname;
      if (!ALLOWED_WHEN_EXPIRED.some((p) => path.startsWith(p))) {
        return c.json({ message: 'انتهت الفترة التجريبية أو الاشتراك — راجع صفحة الدفع', code: 'subscription_expired' }, 402);
      }
    }
    return next();
  };
}
