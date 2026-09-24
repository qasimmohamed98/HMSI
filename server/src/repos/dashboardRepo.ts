import type { Consciousness, DashboardStats, MewsAlert, TimelineEvent } from '@hmsi/shared';
import { calcMews } from '@hmsi/shared';
import { db } from '../../db/index.js';

export async function getDashboard(hospitalId: string): Promise<DashboardStats> {
  const [totalPatients, activeAdmissions, critical, pendingLabs] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) AS n FROM patients WHERE hospital_id = ?`, args: [hospitalId] }),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = ? AND a.status = 'active'`, args: [hospitalId] }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM patients
            WHERE hospital_id = ? AND status = 'active'
              AND (critical_alerts_json != '[]' AND critical_alerts_json IS NOT NULL)`,
      args: [hospitalId],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM lab_results lr
            JOIN admissions a ON a.id = lr.admission_id
            JOIN patients p ON p.id = a.patient_id
            WHERE p.hospital_id = ? AND lr.status IN ('ordered','in_progress')`,
      args: [hospitalId],
    }),
  ]);

  const dischargedToday = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM admissions a JOIN patients p ON p.id = a.patient_id
          WHERE p.hospital_id = ? AND a.status = 'discharged' AND date(a.discharged_at) = date('now')`,
    args: [hospitalId],
  });

  const occupancy = await db.execute({
    sql: `SELECT w.id, w.name_ar, w.name_en,
                 SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) AS used,
                 COUNT(b.id) AS total
          FROM wards w
          JOIN departments d ON d.id = w.department_id
          JOIN beds b ON b.ward_id = w.id
          WHERE d.hospital_id = ?
          GROUP BY w.id
          ORDER BY w.name_ar ASC`,
    args: [hospitalId],
  });

  const trend = await db.execute({
    sql: `WITH RECURSIVE days(d) AS (
                SELECT date('now', '-6 days')
                UNION ALL
                SELECT date(d, '+1 day') FROM days WHERE d < date('now')
              )
          SELECT d AS day, COUNT(a.id) AS count
          FROM days
          LEFT JOIN admissions a ON date(a.admitted_at) = days.d
            AND a.id IN (SELECT a2.id FROM admissions a2 JOIN patients p ON p.id = a2.patient_id WHERE p.hospital_id = ?)
          GROUP BY d
          ORDER BY d`,
    args: [hospitalId],
  });

  const activity = await db.execute({
    sql: `SELECT t.* FROM timeline_events t
          JOIN admissions a ON a.id = t.admission_id
          JOIN patients p ON p.id = a.patient_id
          WHERE p.hospital_id = ?
          ORDER BY t.created_at DESC LIMIT 12`,
    args: [hospitalId],
  });

  // آخر علامات حيوية لكل تنويم نشط (خلال 24 ساعة) → درجة الإنذار المبكر
  const latestVitals = await db.execute({
    sql: `SELECT p.id AS patient_id, p.full_name_ar, p.full_name_en, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en, a.bed_no,
                 v.recorded_at, v.bp_systolic, v.pulse, v.respiratory_rate, v.temperature, v.consciousness
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN wards w ON w.id = a.ward_id
          JOIN vitals v ON v.id = (SELECT id FROM vitals WHERE admission_id = a.id ORDER BY recorded_at DESC LIMIT 1)
          WHERE p.hospital_id = ? AND a.status = 'active' AND v.recorded_at >= ?`,
    args: [hospitalId, new Date(Date.now() - 24 * 3600_000).toISOString()],
  });
  const mewsAlerts: MewsAlert[] = [];
  for (const row of latestVitals.rows) {
    const r = row as Record<string, unknown>;
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const m = calcMews({
      bp_systolic: num(r.bp_systolic),
      pulse: num(r.pulse),
      respiratory_rate: num(r.respiratory_rate),
      temperature: num(r.temperature),
      consciousness: (r.consciousness as Consciousness | null) ?? null,
    });
    if (!m || m.level === 'low') continue;
    mewsAlerts.push({
      patient_id: String(r.patient_id),
      patient_name_ar: String(r.full_name_ar),
      patient_name_en: String(r.full_name_en ?? ''),
      ward_name_ar: String(r.ward_name_ar ?? ''),
      ward_name_en: String(r.ward_name_en ?? ''),
      bed_no: String(r.bed_no ?? ''),
      score: m.score,
      level: m.level,
      recorded_at: String(r.recorded_at),
    });
  }
  mewsAlerts.sort((x, y) => y.score - x.score);

  return {
    mewsAlerts,
    totalPatients: Number((totalPatients.rows[0] as Record<string, unknown>).n ?? 0),
    activeAdmissions: Number((activeAdmissions.rows[0] as Record<string, unknown>).n ?? 0),
    dischargedToday: Number((dischargedToday.rows[0] as Record<string, unknown>).n ?? 0),
    criticalAlerts: Number((critical.rows[0] as Record<string, unknown>).n ?? 0),
    pendingLabs: Number((pendingLabs.rows[0] as Record<string, unknown>).n ?? 0),
    occupancy: occupancy.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ward_name_ar: String(r.name_ar),
        ward_name_en: String(r.name_en),
        used: Number(r.used ?? 0),
        total: Number(r.total ?? 0),
      };
    }),
    admissionsTrend: trend.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return { label: String(r.day), count: Number(r.count ?? 0) };
    }),
    recentActivity: activity.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        admission_id: String(r.admission_id),
        actor: String(r.actor),
        type: String(r.type),
        title_ar: String(r.title_ar),
        title_en: r.title_en ? String(r.title_en) : null,
        created_at: String(r.created_at),
      } as TimelineEvent;
    }),
  };
}