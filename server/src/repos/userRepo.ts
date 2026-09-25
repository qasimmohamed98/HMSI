import { toUser } from './authRepo.js';
import type { User } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { hashPassword } from '../lib/password.js';

export async function listUsers(hospitalId: string): Promise<User[]> {
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en, h.logo_updated_at AS hospital_logo_updated_at, h.trial_ends_at AS hospital_trial_ends_at, h.subscription_ends_at AS hospital_subscription_ends_at
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          WHERE u.hospital_id = ?
          ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name_ar`,
    args: [hospitalId],
  });
  return rows.rows.map((r) => toUser(r as Record<string, unknown>));
}

export async function createUser(input: {
  username: string;
  password: string;
  full_name_ar: string;
  full_name_en?: string;
  email?: string | null;
  role: 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'radiology' | 'reception' | 'viewer';
}, hospitalId: string): Promise<User> {
  // اسم المستخدم فريد على مستوى النظام كله (كل المستشفيات)
  const username = input.username.toLowerCase();
  const exists = await db.execute({
    sql: `SELECT id FROM users WHERE lower(username) = ? LIMIT 1`,
    args: [username],
  });
  if (exists.rows.length > 0) throw new UserExistsError('اسم المستخدم مستخدم من قبل');

  const passwordHash = await hashPassword(input.password);
  const id = uuid('us');
  await db.execute({
    // حساب ينشئه المدير بكلمة مؤقتة: تغييرها إجباري عند أول دخول
    sql: `INSERT INTO users (id, hospital_id, username, full_name_ar, full_name_en, email, role, password_hash, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    args: [id, hospitalId, username, input.full_name_ar, input.full_name_en ?? null, input.email ?? null, input.role, passwordHash],
  });
  return (await getUserById(id))!;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en, h.logo_updated_at AS hospital_logo_updated_at, h.trial_ends_at AS hospital_trial_ends_at, h.subscription_ends_at AS hospital_subscription_ends_at
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          WHERE u.id = ? LIMIT 1`,
    args: [id],
  });
  if (rows.rows.length === 0) return null;
  return toUser(rows.rows[0] as Record<string, unknown>);
}

export async function updateUser(
  id: string,
  hospitalId: string,
  input: {
    full_name_ar?: string;
    full_name_en?: string | null;
    email?: string | null;
    role?: 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'radiology' | 'reception' | 'viewer';
    is_active?: boolean;
  },
): Promise<User | null> {
  const existing = await db.execute({ sql: `SELECT id, role FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  if (existing.rows.length === 0) return null;
  // حساب المدير العام لا يُعدَّل من إدارة المستخدمين في المستشفى
  if (String((existing.rows[0] as Record<string, unknown>).role) === 'super_admin') throw new UserProtectedError('لا يمكن تعديل حساب المدير العام');

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (input.full_name_ar !== undefined) { sets.push('full_name_ar = ?'); args.push(input.full_name_ar); }
  if (input.full_name_en !== undefined) { sets.push('full_name_en = ?'); args.push(input.full_name_en ?? null); }
  if (input.email !== undefined) { sets.push('email = ?'); args.push(input.email ?? null); }
  if (input.role !== undefined) { sets.push('role = ?'); args.push(input.role); }
  if (input.is_active !== undefined) { sets.push('is_active = ?'); args.push(input.is_active ? 1 : 0); }
  if (sets.length > 0) {
    args.push(id);
    await db.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
  }
  return getUserById(id);
}

export class UserProtectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserProtectedError';
  }
}

export class UserExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserExistsError';
  }
}