import { db } from '../../db/index.js';
import { HttpError } from './errors.js';

/** أقصى عمر لإدخال مؤجَّل من طابور العمل دون اتصال */
const MAX_BACKDATE_MS = 48 * 3600_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/**
 * وقت القياس/الإعطاء الفعلي. الإدخالات المرسلة من طابور العمل دون اتصال تحمل وقتها الأصلي،
 * ونقبله ضمن 48 ساعة فقط (وليس في المستقبل) حتى لا يُزوَّر ترتيب السجل الطبي.
 */
export function resolveRecordedAt(value: string | undefined): string {
  const now = Date.now();
  if (!value) return new Date(now).toISOString();
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t > now + MAX_CLOCK_SKEW_MS || t < now - MAX_BACKDATE_MS) {
    throw new HttpError('وقت التسجيل خارج النافذة المسموحة (48 ساعة)', 422);
  }
  return new Date(Math.min(t, now)).toISOString();
}

/**
 * إدخال لا يتكرر عند إعادة الإرسال: إن وُجد سجل بنفس معرّف العميل لنفس التنويم يُعاد كما هو.
 * يعيد true إن كان السجل موجوداً مسبقاً.
 */
export async function existingClientRecord(table: string, id: string, admissionId: string): Promise<boolean> {
  const rows = await db.execute({ sql: `SELECT admission_id FROM ${table} WHERE id = ? LIMIT 1`, args: [id] });
  if (rows.rows.length === 0) return false;
  if (String((rows.rows[0] as Record<string, unknown>).admission_id) !== admissionId) {
    throw new HttpError('معرّف السجل مستخدم', 409);
  }
  return true;
}
