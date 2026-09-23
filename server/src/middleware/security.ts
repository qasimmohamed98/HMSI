import type { MiddlewareHandler } from 'hono';
import { db } from '../../db/index.js';
import { HEADER_CSRF, isSameOrigin } from '../config.js';
import { validateCsrf } from '../lib/session.js';

const MAX_FAILED = 5;
const WINDOW_MINUTES = 15;

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      c.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'");
    }
    await next();
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
    if (!session) return next(); // لا جلسة بعد (مثل login)؛ الحماية عبر SameSite + Origin أعلاه
    const token = c.req.header(HEADER_CSRF) ?? '';
    const expected = session?.csrf ?? '';
    if (!token || !expected || !validateCsrf(c, expected)) {
      return c.json({ message: 'فشل التحقق من CSRF' }, 403);
    }
    return next();
  };
}

export async function isBruteForced(username: string, ip: string | null): Promise<boolean> {
  const rows = await db.execute({
    sql: `SELECT COUNT(*) AS n
          FROM login_attempts
          WHERE success = 0 AND attempted_at > datetime('now', ?)
            AND (username = ? OR (? IS NOT NULL AND ip = ?))`,
    args: [`-${WINDOW_MINUTES} minutes`, username, ip, ip, ip],
  });
  const n = Number((rows.rows[0] as Record<string, unknown>).n ?? 0);
  return n >= MAX_FAILED;
}

export function recordLoginAttempt(username: string, ip: string | null, success: boolean): Promise<unknown> {
  return db.execute({
    sql: `INSERT INTO login_attempts (id, username, ip, success) VALUES (?, ?, ?, ?)`,
    args: [crypto.randomUUID(), username, ip, success ? 1 : 0],
  });
}