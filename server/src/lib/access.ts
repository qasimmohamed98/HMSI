import { tryGetContext } from 'hono/context-storage';
import { db, uuid } from '../../db/index.js';
import { HttpError } from './errors.js';
import type { SessionUser } from './session.js';

/**
 * «الطبيب لا يرى إلا مرضاه» (قرار صاحب المشروع):
 * الطبيب يصل إلى المريض إن كان في فريق رعايته (حالياً أو سابقاً)، أو كان الطبيب المعالج،
 * أو أنشأ ملفه، أو لديه وصول طارئ ساري (بسبب مكتوب ومُدقَّق).
 * بقية الأدوار (التمريض، الصيدلية، المختبر، الأشعة، الاستقبال، الإدارة) غير مقيّدة داخل مستشفاها.
 */

export const EMERGENCY_ACCESS_HOURS = 12;

export function isRestricted(user: SessionUser['user'] | null | undefined): boolean {
  return user?.role === 'doctor';
}

/** شرط SQL لوصول الطبيب إلى المريض (alias جدول المرضى) + معاملاته */
export function doctorAccessSql(patientAlias: string, userId: string): { sql: string; args: string[] } {
  return {
    sql: `(
      EXISTS (SELECT 1 FROM care_team ct JOIN admissions ax ON ax.id = ct.admission_id WHERE ax.patient_id = ${patientAlias}.id AND ct.user_id = ? AND ct.role = 'doctor')
      OR EXISTS (SELECT 1 FROM admissions ay WHERE ay.patient_id = ${patientAlias}.id AND ay.attending_doctor_id = ?)
      OR ${patientAlias}.created_by = ?
      OR EXISTS (SELECT 1 FROM access_grants g WHERE g.patient_id = ${patientAlias}.id AND g.user_id = ? AND g.expires_at > ?)
    )`,
    args: [userId, userId, userId, userId, new Date().toISOString()],
  };
}

export async function canAccessPatient(user: SessionUser['user'], patientId: string): Promise<boolean> {
  if (!isRestricted(user)) return true;
  const { sql, args } = doctorAccessSql('p', user.id);
  const r = await db.execute({ sql: `SELECT 1 FROM patients p WHERE p.id = ? AND ${sql} LIMIT 1`, args: [patientId, ...args] });
  return r.rows.length > 0;
}

/** خطأ «ليس من مرضاك» — الواجهة تعرض خيار الوصول الطارئ */
export class NotYourPatientError extends HttpError {
  code = 'not_your_patient';
  constructor() {
    super('هذا المريض ليس ضمن مرضاك — اطلب إضافتك لفريق رعايته أو استخدم الوصول الطارئ', 403);
    this.name = 'NotYourPatientError';
  }
}

/** المستخدم صاحب الطلب الحالي (إن وُجد) — لفرض القيد في المستودعات دون تمريره يدوياً */
export function currentViewer(): SessionUser['user'] | null {
  try {
    const c = tryGetContext();
    const s = c?.get('session' as never) as SessionUser | null | undefined;
    return s?.user ?? null;
  } catch {
    return null;
  }
}

export async function assertPatientAccess(patientId: string, viewer: SessionUser['user'] | null = currentViewer()): Promise<void> {
  if (viewer && !(await canAccessPatient(viewer, patientId))) throw new NotYourPatientError();
}

export async function grantEmergencyAccess(user: SessionUser['user'], patientId: string, reason: string): Promise<string> {
  const expires = new Date(Date.now() + EMERGENCY_ACCESS_HOURS * 3_600_000).toISOString();
  await db.execute({
    sql: `INSERT INTO access_grants (id, hospital_id, user_id, patient_id, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid('ag'), user.hospital_id, user.id, patientId, reason, expires, new Date().toISOString()],
  });
  return expires;
}
