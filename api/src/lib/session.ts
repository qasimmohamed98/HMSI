import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db } from '../../db/index.js';
import { COOKIE_CSRF, COOKIE_SESSION, HEADER_CSRF, SESSION_TTL_MS, env, isSameOrigin } from '../config.js';
import type { User } from '@hmsi/shared';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sign(value: string): string {
  if (!env.sessionSecret) return value;
  return `${value}.${createHmac('sha256', env.sessionSecret).update(value).digest('base64url')}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCsrf(): string {
  return sign(randomBytes(24).toString('base64url'));
}

function cookieOptions(maxAgeSeconds: number, sameSite: 'Lax' | 'Strict' = 'Lax') {
  return {
    httpOnly: true,
    secure: env.production,
    sameSite,
    path: '/',
    maxAge: maxAgeSeconds,
  } as const;
}

export async function createSession(ctx: Context, userId: string, ip: string | null, userAgent: string | null): Promise<{ token: string; csrf: string }> {
  const token = generateSessionToken();
  const csrf = generateCsrf();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, ip, user_agent)
          VALUES (?, ?, ?, ?, datetime('now', '+12 hours'), ?, ?)`,
    args: [randomUUID(), userId, sha256(token), csrf, ip, userAgent],
  });
  setCookie(ctx, COOKIE_SESSION, token, cookieOptions(SESSION_TTL_MS / 1000));
  setCookie(ctx, COOKIE_CSRF, csrf, { ...cookieOptions(SESSION_TTL_MS / 1000), httpOnly: false, sameSite: 'Strict' });
  return { token, csrf };
}

export async function destroySession(ctx: Context): Promise<void> {
  const token = getCookie(ctx, COOKIE_SESSION);
  if (token) {
    await db.execute({ sql: `DELETE FROM sessions WHERE token_hash = ?`, args: [sha256(token)] });
  }
  deleteCookie(ctx, COOKIE_SESSION, { path: '/' });
  deleteCookie(ctx, COOKIE_CSRF, { path: '/' });
}

export interface SessionUser {
  user: User;
  sessionId: string;
  csrf: string;
}

export async function currentSession(ctx: Context): Promise<SessionUser | null> {
  const token = getCookie(ctx, COOKIE_SESSION);
  if (!token) return null;
  const rows = await db.execute({
    sql: `SELECT s.id AS session_id, s.csrf_token,
                 u.id, u.hospital_id, u.username, u.full_name_ar, u.full_name_en, u.email, u.role, u.is_active, u.created_at,
                 h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          JOIN hospitals h ON h.id = u.hospital_id
          WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.is_active = 1`,
    args: [sha256(token)],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as unknown as Record<string, unknown>;
  return {
    sessionId: String(r.session_id),
    csrf: String(r.csrf_token),
    user: {
      id: String(r.id),
      hospital_id: String(r.hospital_id),
      hospital_name_ar: String(r.hospital_name_ar),
      hospital_name_en: String(r.hospital_name_en),
      username: String(r.username),
      full_name_ar: String(r.full_name_ar),
      full_name_en: r.full_name_en ? String(r.full_name_en) : '',
      email: r.email ? String(r.email) : null,
      role: String(r.role) as User['role'],
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    },
  };
}

export function validateCsrf(ctx: Context, csrfInSession: string): boolean {
  const token = ctx.req.header(HEADER_CSRF) ?? '';
  if (!token) return false;
  if (!isSameOrigin(ctx.req.header('Origin'), ctx.req.header('Host'))) return false;
  const unsigned = token.split('.')[0];
  if (env.sessionSecret) {
    if (sign(unsigned) !== token) return false;
  }
  return unsigned === csrfInSession.split('.')[0];
}