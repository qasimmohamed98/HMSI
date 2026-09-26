import { db, withTx } from '../../db/index.js';

/**
 * حذف كل بيانات مستشفى نهائياً (للمدير العام فقط، وبعد نسخة احتياطية تلقائية).
 * - keepUserIds: مستخدمون يبقون (المدير العام)، ويبقى صف المستشفى نفسه إن وُجدوا
 * الترتيب يحترم المفاتيح الأجنبية (libsql يفرضها).
 */

export const DEMO_HOSPITAL_IDS = ['h-1', 'h-2'] as const;

export async function purgeHospital(hospitalId: string, keepUserIds: string[] = []): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const keep = keepUserIds.length ? keepUserIds : ['__none__'];
  const keepPh = keep.map(() => '?').join(', ');
  const ADM = `SELECT a.id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = ?`;
  const USERS = `SELECT id FROM users WHERE hospital_id = ? AND id NOT IN (${keepPh})`;
  const H = [hospitalId];
  const U = [hospitalId, ...keep];

  await withTx(async (tx) => {
    const run = async (label: string, sql: string, args: string[]) => {
      const r = await tx.execute({ sql, args });
      counts[label] = (counts[label] ?? 0) + r.rowsAffected;
    };
    // أجهزة إشعارات الدفع
    await run('push_subscriptions', `DELETE FROM push_subscriptions WHERE hospital_id = ? OR user_id IN (${USERS})`, [hospitalId, ...U]);
    // الإشعارات وقراءاتها
    await run('notification_reads', `DELETE FROM notification_reads WHERE notification_id IN (SELECT id FROM notifications WHERE hospital_id = ?) OR user_id IN (${USERS})`, [hospitalId, ...U]);
    await run('notifications', `DELETE FROM notifications WHERE hospital_id = ? OR target_user_id IN (${USERS})`, [hospitalId, ...U]);
    await run('access_grants', `DELETE FROM access_grants WHERE hospital_id = ? OR user_id IN (${USERS})`, [hospitalId, ...U]);
    await run('nurse_handover_items', `DELETE FROM nurse_handover_items WHERE handover_id IN (SELECT id FROM nurse_handovers WHERE hospital_id = ?) OR admission_id IN (${ADM})`, [hospitalId, ...H]);
    await run('nurse_handovers', `DELETE FROM nurse_handovers WHERE hospital_id = ?`, H);
    // السجلات الطبية للتنويمات
    for (const t of ['care_plans', 'care_team', 'handover_notes', 'timeline_events', 'procedures', 'consultations', 'radiology_reports', 'lab_results', 'medication_administrations', 'fluid_entries', 'medications', 'diagnoses', 'medical_notes', 'vitals', 'attachments']) {
      await run(t, `DELETE FROM ${t} WHERE admission_id IN (${ADM})`, H);
    }
    await run('care_team', `DELETE FROM care_team WHERE user_id IN (${USERS})`, U);
    await run('trash', `DELETE FROM trash WHERE hospital_id = ?`, H);
    await run('payment_notices', `DELETE FROM payment_notices WHERE hospital_id = ?`, H);
    await run('admissions', `DELETE FROM admissions WHERE id IN (${ADM})`, H);
    await run('patients', `DELETE FROM patients WHERE hospital_id = ?`, H);
    await run('beds', `DELETE FROM beds WHERE ward_id IN (SELECT w.id FROM wards w JOIN departments d ON d.id = w.department_id WHERE d.hospital_id = ?)`, H);
    await run('wards', `DELETE FROM wards WHERE department_id IN (SELECT id FROM departments WHERE hospital_id = ?)`, H);
    await run('departments', `DELETE FROM departments WHERE hospital_id = ?`, H);
    await run('settings', `DELETE FROM settings WHERE hospital_id = ?`, H);
    // المستخدمون وما يرتبط بهم
    await run('sessions', `DELETE FROM sessions WHERE user_id IN (${USERS})`, U);
    await tx.execute({ sql: `UPDATE sessions SET active_hospital_id = NULL WHERE active_hospital_id = ?`, args: H });
    await run('mfa_challenges', `DELETE FROM mfa_challenges WHERE user_id IN (${USERS})`, U);
    await run('audit_logs', `DELETE FROM audit_logs WHERE actor_id IN (${USERS})`, U);
    await run('timeline_events', `DELETE FROM timeline_events WHERE actor_id IN (${USERS})`, U);
    await run('users', `DELETE FROM users WHERE hospital_id = ? AND id NOT IN (${keepPh})`, U);
    const kept = await tx.execute({ sql: `SELECT COUNT(*) AS n FROM users WHERE hospital_id = ?`, args: H });
    if (Number((kept.rows[0] as unknown as Record<string, unknown>).n) === 0) {
      await run('hospitals', `DELETE FROM hospitals WHERE id = ?`, H);
    }
  });
  return counts;
}

/**
 * حذف بيانات التجربة (مستشفيا البيانات التجريبية h-1 وh-2):
 * يبقى المدير العام في مستشفى h-1 بعد إفراغه وتسميته «إدارة النظام».
 */
export async function purgeDemoData(): Promise<{ counts: Record<string, number>; hospitals: string[] }> {
  const supers = (await db.execute(`SELECT id FROM users WHERE role = 'super_admin'`)).rows.map((r) => String((r as unknown as Record<string, unknown>).id));
  const present = (await db.execute({ sql: `SELECT id FROM hospitals WHERE id IN (?, ?)`, args: [...DEMO_HOSPITAL_IDS] })).rows.map((r) => String((r as unknown as Record<string, unknown>).id));
  const total: Record<string, number> = {};
  for (const id of present) {
    const c = await purgeHospital(id, supers);
    for (const [k, v] of Object.entries(c)) total[k] = (total[k] ?? 0) + v;
  }
  // المستشفى الذي بقي فيه المدير العام يصبح مساحة إدارة النظام (بلا مرضى ولا اشتراك)
  await db.execute({
    sql: `UPDATE hospitals SET name_ar = 'إدارة النظام', name_en = 'System administration', code = 'SYSTEM', trial_ends_at = NULL, subscription_ends_at = NULL, logo_data = NULL, logo_updated_at = NULL
          WHERE id IN (SELECT DISTINCT hospital_id FROM users WHERE role = 'super_admin') AND id IN (?, ?)`,
    args: [...DEMO_HOSPITAL_IDS],
  });
  return { counts: total, hospitals: present };
}
