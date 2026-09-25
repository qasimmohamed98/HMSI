import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import type { Context } from 'hono';
import { calcMews, type Consciousness } from '@hmsi/shared';
import { doctorAccessSql, isRestricted } from '../lib/access.js';

/** قيود القائمة: الطبيب مرضاه فقط؛ ?mine=1 للممرض = مرضاه المعيَّنون؛ ?ward= ردهة */
function listFilter(c: Context): { sql: string; args: string[] } {
  const s = getSession(c)!;
  const parts: string[] = [];
  const args: string[] = [];
  const ward = c.req.query('ward');
  if (ward) {
    parts.push('a.ward_id = ?');
    args.push(ward);
  }
  if (isRestricted(s.user)) {
    const acc = doctorAccessSql('p', s.user.id);
    parts.push(acc.sql);
    args.push(...acc.args);
  }
  if (c.req.query('mine') === '1') {
    parts.push(`EXISTS (SELECT 1 FROM care_team cm WHERE cm.admission_id = a.id AND cm.user_id = ? AND cm.ended_at IS NULL)`);
    args.push(s.user.id);
  }
  return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', args };
}

const NURSE_COLS = `(SELECT ct.user_id FROM care_team ct WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_id,
                 (SELECT u2.full_name_ar FROM care_team ct JOIN users u2 ON u2.id = ct.user_id WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_name_ar,
                 (SELECT u2.full_name_en FROM care_team ct JOIN users u2 ON u2.id = ct.user_id WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_name_en`;

/**
 * جولة الأدوية: كل الأدوية النشطة للمرضى المنوّمين في المستشفى مع آخر تسجيل إعطاء.
 * حساب الموعد التالي (متأخرة/مستحقة/قريبة) يتم في الواجهة بالتوقيت المحلي عبر doseStatus.
 */
export const roundsRoutes = new Hono();

roundsRoutes.get('/', requireAuth(), requirePermission('medications.administer', 'medications.manage', 'medications.dispense'), async (c) => {
  const s = getSession(c)!;
  const f = listFilter(c);
  const rows = await db.execute({
    sql: `SELECT m.id, m.admission_id, m.name_ar, m.name_en, m.dose, m.route, m.frequency, m.start_at, m.end_at, m.created_at,
                 m.dispensed_at, m.allergy_override_json IS NOT NULL AS allergy_override,
                 p.id AS patient_id, p.full_name_ar, p.full_name_en, p.file_number,
                 a.ward_id, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en, a.room, a.bed_no,
                 (SELECT ma.administered_at FROM medication_administrations ma WHERE ma.medication_id = m.id ORDER BY ma.administered_at DESC LIMIT 1) AS last_at,
                 (SELECT ma.status FROM medication_administrations ma WHERE ma.medication_id = m.id ORDER BY ma.administered_at DESC LIMIT 1) AS last_status,
                 (SELECT ma.administered_by FROM medication_administrations ma WHERE ma.medication_id = m.id ORDER BY ma.administered_at DESC LIMIT 1) AS last_by,
                 ${NURSE_COLS}
          FROM medications m
          JOIN admissions a ON a.id = m.admission_id AND a.status = 'active'
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN wards w ON w.id = a.ward_id
          WHERE p.hospital_id = ? AND m.status = 'active'${f.sql}
          ORDER BY w.name_ar, a.room, a.bed_no, m.created_at`,
    args: [s.user.hospital_id, ...f.args],
  });
  return c.json(
    rows.rows.map((r) => {
      const o = r as unknown as Record<string, unknown>;
      return { ...o, allergy_override: Number(o.allergy_override) === 1 };
    }),
  );
});

/** مواعيد العلامات الحيوية: آخر قياس + التكرار من الخطة العلاجية (افتراضياً كل 4 ساعات) + MEWS */
roundsRoutes.get('/vitals', requireAuth(), requirePermission('chart.view'), async (c) => {
  const s = getSession(c)!;
  const f = listFilter(c);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const rows = await db.execute({
    sql: `SELECT a.id AS admission_id, a.admitted_at, a.room, a.bed_no, a.ward_id, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 p.id AS patient_id, p.full_name_ar, p.full_name_en, p.file_number,
                 cp.vitals_interval_hours,
                 v.recorded_at AS last_at, v.temperature, v.pulse, v.respiratory_rate, v.bp_systolic, v.consciousness,
                 ${NURSE_COLS}
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN wards w ON w.id = a.ward_id
          LEFT JOIN care_plans cp ON cp.admission_id = a.id
          LEFT JOIN vitals v ON v.id = (SELECT id FROM vitals WHERE admission_id = a.id ORDER BY recorded_at DESC LIMIT 1)
          WHERE p.hospital_id = ? AND a.status = 'active'${f.sql}
          ORDER BY w.name_ar, a.room, a.bed_no`,
    args: [s.user.hospital_id, ...f.args],
  });
  return c.json(
    rows.rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const mews = r.last_at
        ? calcMews({ bp_systolic: num(r.bp_systolic), pulse: num(r.pulse), respiratory_rate: num(r.respiratory_rate), temperature: num(r.temperature), consciousness: (r.consciousness as Consciousness | null) ?? null })
        : null;
      return {
        admission_id: r.admission_id,
        admitted_at: r.admitted_at,
        room: r.room,
        bed_no: r.bed_no,
        ward_id: r.ward_id,
        ward_name_ar: r.ward_name_ar,
        ward_name_en: r.ward_name_en,
        patient_id: r.patient_id,
        full_name_ar: r.full_name_ar,
        full_name_en: r.full_name_en,
        file_number: r.file_number,
        interval_hours: num(r.vitals_interval_hours),
        last_at: r.last_at ?? null,
        mews: mews ? { score: mews.score, level: mews.level } : null,
        nurse_id: r.nurse_id ?? null,
        nurse_name_ar: r.nurse_name_ar ?? null,
        nurse_name_en: r.nurse_name_en ?? null,
      };
    }),
  );
});
