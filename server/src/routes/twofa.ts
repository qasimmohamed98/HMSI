import { Hono } from 'hono';
import type { Context } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db, uuid } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { isBruteForced, recordLoginAttempt } from '../middleware/security.js';
import { verifyPassword } from '../lib/password.js';
import { getPasswordHash, getUserById } from '../repos/authRepo.js';
import { createSession } from '../lib/session.js';
import { consumeRecoveryCode, newRecoveryCodes, newTotpSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from '../lib/totp.js';

/**
 * التحقق بخطوتين (اختياري لكل مستخدم، ويُنصح به للمدراء):
 * - الإعداد: /setup (سر جديد + رابط QR) ثم /enable برمز من التطبيق → رموز استرداد
 * - الدخول: /api/auth/login يعيد mfa_token، ثم /login/mfa بالرمز أو رمز استرداد
 * - الإيقاف: بكلمة المرور؛ ومدير المستشفى يعيد ضبطه لموظف فقد هاتفه
 */
export const twofaRoutes = new Hono();

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface TotpRow {
  totp_secret: string | null;
  totp_enabled: number;
  totp_recovery_json: string | null;
  totp_last_step: number | null;
}

async function totpRow(userId: string): Promise<TotpRow | null> {
  const r = await db.execute({ sql: `SELECT totp_secret, totp_enabled, totp_recovery_json, totp_last_step FROM users WHERE id = ? LIMIT 1`, args: [userId] });
  const row = r.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    totp_secret: row.totp_secret ? String(row.totp_secret) : null,
    totp_enabled: Number(row.totp_enabled ?? 0),
    totp_recovery_json: row.totp_recovery_json ? String(row.totp_recovery_json) : null,
    totp_last_step: row.totp_last_step === null || row.totp_last_step === undefined ? null : Number(row.totp_last_step),
  };
}

export async function isTotpEnabled(userId: string): Promise<boolean> {
  return (await totpRow(userId))?.totp_enabled === 1;
}

/** تذكرة الخطوة الثانية بعد صحة كلمة المرور */
export async function createMfaChallenge(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.execute({ sql: `DELETE FROM mfa_challenges WHERE user_id = ? OR expires_at < ?`, args: [userId, new Date().toISOString()] });
  await db.execute({
    sql: `INSERT INTO mfa_challenges (id, user_id, token_hash, attempts, expires_at) VALUES (?, ?, ?, 0, ?)`,
    args: [uuid('mfa'), userId, sha256(token), new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()],
  });
  return token;
}

/** يتحقق من رمز التطبيق أو رمز استرداد، ويحدّث حالة منع إعادة الاستخدام */
async function checkCode(userId: string, row: TotpRow, code: string): Promise<'totp' | 'recovery' | null> {
  const secret = row.totp_secret ? openSecret(row.totp_secret) : null;
  if (secret) {
    const step = verifyTotp(secret, code, row.totp_last_step);
    if (step !== null) {
      await db.execute({ sql: `UPDATE users SET totp_last_step = ? WHERE id = ?`, args: [step, userId] });
      return 'totp';
    }
  }
  if (row.totp_enabled && /[a-z]/i.test(code)) {
    const left = consumeRecoveryCode(row.totp_recovery_json, code);
    if (left) {
      await db.execute({ sql: `UPDATE users SET totp_recovery_json = ? WHERE id = ?`, args: [JSON.stringify(left), userId] });
      return 'recovery';
    }
  }
  return null;
}

const MfaLoginSchema = z.object({ mfa_token: z.string().min(10).max(200), code: z.string().trim().min(6).max(20) });

twofaRoutes.post('/login', async (c) => {
  const parsed = await parseBody(c, MfaLoginSchema);
  if (!parsed.ok) return parsed.json;
  const { mfa_token, code } = parsed.data as z.infer<typeof MfaLoginSchema>;
  const ip = clientIp(c);
  const r = await db.execute({
    sql: `SELECT id, user_id, attempts FROM mfa_challenges WHERE token_hash = ? AND expires_at > ? LIMIT 1`,
    args: [sha256(mfa_token), new Date().toISOString()],
  });
  const ch = r.rows[0] as unknown as { id: string; user_id: string; attempts: number } | undefined;
  if (!ch || Number(ch.attempts) >= MAX_ATTEMPTS) return c.json({ message: 'انتهت صلاحية خطوة التحقق — سجّل الدخول من جديد', code: 'mfa_expired' }, 401);
  const userId = String(ch.user_id);
  if (await isBruteForced(`mfa:${userId}`, ip, 10, 30)) return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  await db.execute({ sql: `UPDATE mfa_challenges SET attempts = attempts + 1 WHERE id = ?`, args: [ch.id] });

  const row = await totpRow(userId);
  const how = row ? await checkCode(userId, row, code) : null;
  if (!how) {
    await recordLoginAttempt(`mfa:${userId}`, ip, false);
    await writeAudit({ actorId: userId, action: 'mfa_failed', resourceType: 'user', resourceId: userId, ip });
    return c.json({ message: 'رمز التحقق غير صحيح' }, 401);
  }
  await db.execute({ sql: `DELETE FROM mfa_challenges WHERE id = ?`, args: [ch.id] });
  const full = await getUserById(userId);
  if (!full) return c.json({ message: 'تعذر تحميل المستخدم' }, 500);
  await createSession(c, userId, ip, c.req.header('user-agent') ?? null);
  await writeAudit({ actorId: userId, action: 'login', resourceType: 'user', resourceId: userId, ip, meta: { mfa: how } });
  return c.json(full, 200);
});

/** سر جديد (غير مفعّل بعد) + رابط QR للتطبيق */
twofaRoutes.post('/setup', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const row = await totpRow(s.user.id);
  if (row?.totp_enabled) return c.json({ message: 'التحقق بخطوتين مفعّل بالفعل' }, 409);
  const secret = newTotpSecret();
  await db.execute({ sql: `UPDATE users SET totp_secret = ?, totp_last_step = NULL WHERE id = ?`, args: [sealSecret(secret), s.user.id] });
  return c.json({ secret, otpauth_url: otpauthUrl(secret, s.user.username) }, 200);
});

const CodeSchema = z.object({ code: z.string().trim().min(6).max(20) });

twofaRoutes.post('/enable', requireAuth(), async (c) => {
  const parsed = await parseBody(c, CodeSchema);
  if (!parsed.ok) return parsed.json;
  const s = getSession(c)!;
  const row = await totpRow(s.user.id);
  if (!row?.totp_secret) return c.json({ message: 'ابدأ الإعداد أولاً' }, 400);
  if (row.totp_enabled) return c.json({ message: 'التحقق بخطوتين مفعّل بالفعل' }, 409);
  const secret = openSecret(row.totp_secret);
  const step = secret ? verifyTotp(secret, (parsed.data as { code: string }).code, null) : null;
  if (step === null) return c.json({ message: 'رمز التحقق غير صحيح' }, 422);
  const { codes, hashes } = newRecoveryCodes();
  await db.execute({
    sql: `UPDATE users SET totp_enabled = 1, totp_last_step = ?, totp_recovery_json = ? WHERE id = ?`,
    args: [step, JSON.stringify(hashes), s.user.id],
  });
  await writeAudit({ actorId: s.user.id, action: 'mfa_enabled', resourceType: 'user', resourceId: s.user.id, ip: clientIp(c) });
  return c.json({ recovery_codes: codes }, 200);
});

const PasswordSchema = z.object({ password: z.string().min(1).max(200) });

async function requirePassword(c: Context, userId: string): Promise<Response | null> {
  const parsed = await parseBody(c, PasswordSchema);
  if (!parsed.ok) return parsed.json;
  const ip = clientIp(c);
  const key = `pw:${userId}`;
  if (await isBruteForced(key, ip)) return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  const hash = await getPasswordHash(userId);
  if (!hash || !(await verifyPassword((parsed.data as { password: string }).password, hash))) {
    await recordLoginAttempt(key, ip, false);
    return c.json({ message: 'كلمة المرور الحالية غير صحيحة' }, 403);
  }
  return null;
}

twofaRoutes.post('/disable', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const denied = await requirePassword(c, s.user.id);
  if (denied) return denied;
  await db.execute({ sql: `UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_json = NULL, totp_last_step = NULL WHERE id = ?`, args: [s.user.id] });
  await writeAudit({ actorId: s.user.id, action: 'mfa_disabled', resourceType: 'user', resourceId: s.user.id, ip: clientIp(c) });
  return c.body(null, 204);
});

twofaRoutes.post('/recovery-codes', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const denied = await requirePassword(c, s.user.id);
  if (denied) return denied;
  if (!(await isTotpEnabled(s.user.id))) return c.json({ message: 'التحقق بخطوتين غير مفعّل' }, 400);
  const { codes, hashes } = newRecoveryCodes();
  await db.execute({ sql: `UPDATE users SET totp_recovery_json = ? WHERE id = ?`, args: [JSON.stringify(hashes), s.user.id] });
  await writeAudit({ actorId: s.user.id, action: 'mfa_recovery_regenerated', resourceType: 'user', resourceId: s.user.id, ip: clientIp(c) });
  return c.json({ recovery_codes: codes }, 200);
});

twofaRoutes.get('/status', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const row = await totpRow(s.user.id);
  let left = 0;
  try {
    left = JSON.parse(row?.totp_recovery_json ?? '[]').length;
  } catch {
    /* */
  }
  return c.json({ enabled: row?.totp_enabled === 1, recovery_codes_left: left }, 200);
});

/** مدير المستشفى يعيد ضبط التحقق بخطوتين لموظف فقد هاتفه (في نفس المستشفى فقط) */
export const twofaAdminRoutes = new Hono();
twofaAdminRoutes.post('/:id/2fa/reset', requireAuth(), requirePermission('users.manage'), async (c) => {
  const s = getSession(c)!;
  const id = c.req.param('id');
  if (id === s.user.id) return c.json({ message: 'لإيقاف التحقق بخطوتين لحسابك استخدم صفحة الإعدادات' }, 400);
  const rows = await db.execute({ sql: `SELECT role FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, s.user.hospital_id] });
  if (rows.rows.length === 0) return c.json({ message: 'المستخدم غير موجود' }, 404);
  if (String((rows.rows[0] as Record<string, unknown>).role) === 'super_admin') return c.json({ message: 'لا يمكن تعديل حساب المدير العام' }, 403);
  await db.execute({ sql: `UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_json = NULL, totp_last_step = NULL WHERE id = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM sessions WHERE user_id = ?`, args: [id] });
  await writeAudit({ actorId: s.user.id, action: 'mfa_reset', resourceType: 'user', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
