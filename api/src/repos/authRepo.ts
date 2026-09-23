import type { User } from '@hmsi/shared';
import { db } from '../../db/index.js';

export function toUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    hospital_name_ar: String(r.hospital_name_ar ?? ''),
    hospital_name_en: String(r.hospital_name_en ?? ''),
    username: String(r.username),
    full_name_ar: String(r.full_name_ar),
    full_name_en: r.full_name_en ? String(r.full_name_en) : '',
    email: r.email ? String(r.email) : null,
    role: String(r.role) as User['role'],
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
  };
}

export async function findUserByUsername(username: string): Promise<{ hash: string; id: string } | null> {
  const rows = await db.execute({
    sql: `SELECT id, password_hash AS hash FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
    args: [username],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { hash: String(r.hash), id: String(r.id) };
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
    args: [id],
  });
  return rows.rows.length > 0 ? toUser(rows.rows[0] as Record<string, unknown>) : null;
}