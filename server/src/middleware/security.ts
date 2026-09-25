import type { MiddlewareHandler } from 'hono';
import { db } from '../../db/index.js';
import { HEADER_CSRF, env, isHttps, isLocalRequest, isSameOrigin } from '../config.js';
import { validateCsrf } from '../lib/session.js';

const WINDOW = '-15 minutes';

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // المسارات التي تضبط كاشها صراحة (مثل الشعار العام) تحتفظ به؛ الباقي لا يُخزَّن
    if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store');
    if (isHttps(c)) {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
  };
}

/** في أي نشر حقيقي (غير localhost) يجب ضبط SESSION_SECRET — وإلا نرفض بدل العمل بحماية ضعيفة */
export function requireSecretOutsideLocal(): MiddlewareHandler {
  return async (c, next) => {
    if (!env.sessionSecret && !isLocalRequest(c)) {
      console.error('[hmsi] SESSION_SECRET is not set');
      return c.json({ message: 'إعداد الخادم غير مكتمل (SESSION_SECRET)' }, 500);
    }
    return next();
  };
}

export function csrfProtection(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
    if (!isSameOrigin(c.req.header('Origin'), c.req.header('Host'))) {
      return c.json({ message: 'طلب غير مقبول المصدر' }, 403);
    }
    const session = c.get('session') as { csrf?: string } | null;
    if (!session) return next(); // لا جلسة (login / الصفحة العامة)؛ الحماية عبر SameSite + Origin أعلاه
    const token = c.req.header(HEADER_CSRF) ?? '';
    const expected = session.csrf ?? '';
    if (!token || !expected || !validateCsrf(c, expected)) {
      return c.json({ message: 'فشل التحقق من CSRF — أعد تحميل الصفحة' }, 403);
    }
    return next();
  };
}

async function countFailures(where: string, args: (string | null)[]): Promise<number> {
  const rows = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND attempted_at > datetime('now', ?) AND ${where}`,
    args: [WINDOW, ...args],
  });
  return Number((rows.rows[0] as Record<string, unknown>).n ?? 0);
}

/**
 * حماية التخمين:
 * - 5 محاولات فاشلة لنفس (المستخدم + العنوان) خلال 15 دقيقة
 * - 30 محاولة فاشلة للمستخدم من كل العناوين (تخمين موزّع) — حدّ أعلى حتى لا يُقفل حساب الطبيب بسهولة
 */
export async function isBruteForced(key: string, ip: string | null, perPair = 5, perKey = 30): Promise<boolean> {
  const pair = await countFailures(`username = ? AND ip IS ?`, [key, ip]);
  if (pair >= perPair) return true;
  const total = await countFailures(`username = ?`, [key]);
  return total >= perKey;
}

export function recordLoginAttempt(key: string, ip: string | null, success: boolean): Promise<unknown> {
  return db.execute({
    sql: `INSERT INTO login_attempts (id, username, ip, success) VALUES (?, ?, ?, ?)`,
    args: [crypto.randomUUID(), key, ip, success ? 1 : 0],
  });
}
