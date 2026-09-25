import type { User } from '@hmsi/shared';
import { db } from '../../db/index.js';
import { logoUrl } from '../lib/logo.js';
import { computeSubscription } from '../lib/subscription.js';

export function toUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    home_hospital_id: String(r.hospital_id),
    hospital_name_ar: String(r.hospital_name_ar ?? ''),
    hospital_name_en: String(r.hospital_name_en ?? ''),
    username: String(r.username),
    full_name_ar: String(r.full_name_ar),
    full_name_en: r.full_name_en ? String(r.full_name_en) : '',
    email: r.email ? String(r.email) : null,
    role: String(r.role) as User['role'],
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    hospital_logo_url: logoUrl(r.hospital_id, r.hospital_logo_updated_at),
    subscription: computeSubscription(r.hospital_trial_ends_at, r.hospital_subscription_ends_at),
    must_change_password: Boolean(Number(r.must_change_password ?? 0)),
    totp_enabled: Boolean(Number(r.totp_enabled ?? 0)),
  };
}

/** المستخدمون في مستشفى معطّل لا يستطيعون الدخول (عدا المدير العام) */
export async function findUserByUsername(username: string): Promise<{ hash: string; id: string } | null> {
  const rows = await db.execute({
    sql: `SELECT u.id, u.password_hash AS hash FROM users u JOIN hospitals h ON h.id = u.hospital_id
          WHERE lower(u.username) = ? AND u.is_active = 1 AND (h.is_active = 1 OR u.role = 'super_admin') LIMIT 1`,
    args: [username],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { hash: String(r.hash), id: String(r.id) };
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en, h.logo_updated_at AS hospital_logo_updated_at, h.trial_ends_at AS hospital_trial_ends_at, h.subscription_ends_at AS hospital_subscription_ends_at
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
    args: [id],
  });
  return rows.rows.length > 0 ? toUser(rows.rows[0] as Record<string, unknown>) : null;
}

export async function flagMustChangePassword(userId: string): Promise<void> {
  await db.execute({ sql: `UPDATE users SET must_change_password = 1 WHERE id = ?`, args: [userId] });
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const rows = await db.execute({ sql: `SELECT password_hash FROM users WHERE id = ? LIMIT 1`, args: [userId] });
  return rows.rows.length > 0 ? String((rows.rows[0] as Record<string, unknown>).password_hash) : null;
}

/**
 * تحديث كلمة المرور وإنهاء كل جلسات المستخدم (عدا keepSessionId إن وُجد).
 * mustChange: كلمة مؤقتة يضعها المدير — يُطلب من صاحبها تغييرها عند الدخول.
 */
export async function setPassword(userId: string, passwordHash: string, keepSessionId: string | null = null, mustChange = false): Promise<void> {
  await db.batch(
    [
      { sql: `UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?`, args: [passwordHash, mustChange ? 1 : 0, userId] },
      { sql: `DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?`, args: [userId, keepSessionId] },
    ],
    'write',
  );
}
