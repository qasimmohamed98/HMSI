import { toUser } from './authRepo.js';
import type { Role, User } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { hashPassword } from '../lib/password.js';

/** قائمة المستخدمين؛ departmentIds محدَّدة تقيّد النتيجة على مستخدمي هذه الأقسام فقط (لمدير القسم المفوَّض) */
export async function listUsers(hospitalId: string, departmentIds?: string[]): Promise<User[]> {
  const deptFilter = departmentIds && departmentIds.length > 0 ? ` AND u.department_id IN (${departmentIds.map(() => '?').join(',')})` : '';
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en, h.logo_updated_at AS hospital_logo_updated_at, h.trial_ends_at AS hospital_trial_ends_at, h.subscription_ends_at AS hospital_subscription_ends_at,
                 d.name_ar AS department_name_ar, d.name_en AS department_name_en
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          LEFT JOIN departments d ON d.id = u.department_id
          WHERE u.hospital_id = ?${deptFilter}
          ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name_ar`,
    args: [hospitalId, ...(departmentIds ?? [])],
  });
  return rows.rows.map((r) => toUser(r as Record<string, unknown>));
}

/** يتحقق أن القسم المختار موجود فعلاً ضمن نفس المستشفى — حماية إضافية من تسريب بين المستشفيات */
async function assertDepartmentInHospital(departmentId: string | null | undefined, hospitalId: string): Promise<void> {
  if (!departmentId) return;
  const rows = await db.execute({ sql: `SELECT id FROM departments WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [departmentId, hospitalId] });
  if (rows.rows.length === 0) throw new UserDepartmentError('القسم المختار غير موجود في هذا المستشفى');
}

export async function createUser(input: {
  username: string;
  password: string;
  full_name_ar: string;
  full_name_en?: string;
  email?: string | null;
  role: Exclude<Role, 'super_admin'>;
  department_id?: string | null;
}, hospitalId: string): Promise<User> {
  // اسم المستخدم فريد على مستوى النظام كله (كل المستشفيات)
  const username = input.username.toLowerCase();
  const exists = await db.execute({
    sql: `SELECT id FROM users WHERE lower(username) = ? LIMIT 1`,
    args: [username],
  });
  if (exists.rows.length > 0) throw new UserExistsError('اسم المستخدم مستخدم من قبل');
  await assertDepartmentInHospital(input.department_id, hospitalId);

  const passwordHash = await hashPassword(input.password);
  const id = uuid('us');
  await db.execute({
    // حساب ينشئه المدير بكلمة مؤقتة: تغييرها إجباري عند أول دخول
    sql: `INSERT INTO users (id, hospital_id, username, full_name_ar, full_name_en, email, role, password_hash, must_change_password, department_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [id, hospitalId, username, input.full_name_ar, input.full_name_en ?? null, input.email ?? null, input.role, passwordHash, input.department_id ?? null],
  });
  return (await getUserById(id))!;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.execute({
    sql: `SELECT u.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en, h.logo_updated_at AS hospital_logo_updated_at, h.trial_ends_at AS hospital_trial_ends_at, h.subscription_ends_at AS hospital_subscription_ends_at,
                 d.name_ar AS department_name_ar, d.name_en AS department_name_en
          FROM users u JOIN hospitals h ON h.id = u.hospital_id
          LEFT JOIN departments d ON d.id = u.department_id
          WHERE u.id = ? LIMIT 1`,
    args: [id],
  });
  if (rows.rows.length === 0) return null;
  return toUser(rows.rows[0] as Record<string, unknown>);
}

/** بيانات مختصرة للتحقق من الصلاحية قبل التعديل (دور المستخدم وقسمه الحالي) */
export async function getUserAccessInfo(id: string, hospitalId: string): Promise<{ role: string; department_id: string | null } | null> {
  const rows = await db.execute({ sql: `SELECT role, department_id FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { role: String(r.role), department_id: r.department_id == null ? null : String(r.department_id) };
}

export async function updateUser(
  id: string,
  hospitalId: string,
  input: {
    full_name_ar?: string;
    full_name_en?: string | null;
    email?: string | null;
    role?: Exclude<Role, 'super_admin'>;
    is_active?: boolean;
    department_id?: string | null;
  },
): Promise<User | null> {
  const existing = await db.execute({ sql: `SELECT id, role FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  if (existing.rows.length === 0) return null;
  // حساب المدير العام لا يُعدَّل من إدارة المستخدمين في المستشفى
  if (String((existing.rows[0] as Record<string, unknown>).role) === 'super_admin') throw new UserProtectedError('لا يمكن تعديل حساب المدير العام');
  if (input.department_id !== undefined) await assertDepartmentInHospital(input.department_id, hospitalId);

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (input.full_name_ar !== undefined) { sets.push('full_name_ar = ?'); args.push(input.full_name_ar); }
  if (input.full_name_en !== undefined) { sets.push('full_name_en = ?'); args.push(input.full_name_en ?? null); }
  if (input.email !== undefined) { sets.push('email = ?'); args.push(input.email ?? null); }
  if (input.role !== undefined) { sets.push('role = ?'); args.push(input.role); }
  if (input.is_active !== undefined) { sets.push('is_active = ?'); args.push(input.is_active ? 1 : 0); }
  if (input.department_id !== undefined) { sets.push('department_id = ?'); args.push(input.department_id ?? null); }
  if (sets.length > 0) {
    args.push(id);
    await db.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
  }
  return getUserById(id);
}

export class UserDepartmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDepartmentError';
  }
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