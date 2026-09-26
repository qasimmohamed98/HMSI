import { randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db, uuid } from '../../db/index.js';
import { isHttps } from '../config.js';
import { sha256 } from './session.js';

/**
 * «تذكّر هذا الجهاز»: بعد إدخال رمز التحقق بخطوتين مع اختيار التذكّر، لا يُطلب الرمز على المتصفح نفسه 30 يوماً.
 * كلمة المرور تبقى مطلوبة دائماً. الرمز عشوائي في ملف ارتباط HttpOnly، والقاعدة تحفظ بصمته فقط.
 * يُلغى لكل أجهزة المستخدم عند: تغيير كلمة المرور، إيقاف التحقق، إعادة ضبطه من المدير، أو زر «إلغاء تذكّر الأجهزة».
 */

const COOKIE = 'hmsi_trusted';
export const TRUST_DAYS = 30;

function label(ua: string | null): string {
  const u = ua ?? '';
  const os = /android/i.test(u) ? 'Android' : /iphone|ipad/i.test(u) ? 'iOS' : /windows/i.test(u) ? 'Windows' : /mac os/i.test(u) ? 'macOS' : /linux/i.test(u) ? 'Linux' : '—';
  const br = /edg\//i.test(u) ? 'Edge' : /firefox/i.test(u) ? 'Firefox' : /chrome|crios/i.test(u) ? 'Chrome' : /safari/i.test(u) ? 'Safari' : '—';
  return `${os} · ${br}`;
}

export async function trustThisDevice(c: Context, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + TRUST_DAYS * 86_400_000);
  // المتصفح الواحد يحمل رمزاً واحداً: رمزه السابق (إن وُجد) لا يعود صالحاً
  const old = getCookie(c, COOKIE);
  if (old) await db.execute({ sql: `DELETE FROM trusted_devices WHERE token_hash = ?`, args: [sha256(old)] });
  await db.execute({
    sql: `INSERT INTO trusted_devices (id, user_id, token_hash, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [uuid('trd'), userId, sha256(token), label(c.req.header('user-agent') ?? null), now.toISOString(), expires.toISOString()],
  });
  setCookie(c, COOKIE, token, { httpOnly: true, secure: isHttps(c), sameSite: 'Strict', path: '/api/auth', maxAge: TRUST_DAYS * 86_400 });
}

/** هل هذا المتصفح موثوق لهذا المستخدم تحديداً؟ */
export async function isTrustedDevice(c: Context, userId: string): Promise<boolean> {
  const token = getCookie(c, COOKIE);
  if (!token) return false;
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: `SELECT id FROM trusted_devices WHERE token_hash = ? AND user_id = ? AND expires_at > ? LIMIT 1`,
    args: [sha256(token), userId, now],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (!row) return false;
  await db.execute({ sql: `UPDATE trusted_devices SET last_used_at = ? WHERE id = ?`, args: [now, row.id] });
  return true;
}

export async function countTrustedDevices(userId: string): Promise<number> {
  const r = await db.execute({ sql: `SELECT COUNT(*) AS n FROM trusted_devices WHERE user_id = ? AND expires_at > ?`, args: [userId, new Date().toISOString()] });
  return Number((r.rows[0] as unknown as { n: number }).n);
}

export async function forgetAllDevices(userId: string, c?: Context): Promise<number> {
  const r = await db.execute({ sql: `DELETE FROM trusted_devices WHERE user_id = ?`, args: [userId] });
  if (c) deleteCookie(c, COOKIE, { path: '/api/auth' });
  return r.rowsAffected;
}
