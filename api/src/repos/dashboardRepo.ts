import type { DashboardStats, TimelineEvent } from '@hmsi/shared';
import { db } from '../../db/index.js';
import { DEFAULT_HOSPITAL_ID } from '../config.js';

export async function getDashboard(): Promise<DashboardStats> {
  const [totalPatients, activeAdmissions, critical, pendingLabs] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) AS n FROM patients WHERE hospital_id = ?`, args: [DEFAULT_HOSPITAL_ID] }),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = ? AND a.status = 'active'`, args: [DEFAULT_HOSPITAL_ID] }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM patients
            WHERE hospital_id = ? AND status = 'active'
              AND (critical_alerts_json != '[]' AND critical_alerts_json IS NOT NULL)`,
      args: [DEFAULT_HOSPITAL_ID],
    }),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM lab_results WHERE status IN ('ordered','in_progress')`, args: [] }),
  ]);

  const dischargedToday = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM admissions a JOIN patients p ON p.id = a.patient_id
          WHERE p.hospital_id = ? AND a.status = 'discharged' AND date(a.discharged_at) = date('now')`,
    args: [DEFAULT_HOSPITAL_ID],
  });

  const occupancy = await db.execute({
    sql: `SELECT w.id, w.name_ar, w.name_en,
                 SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) AS used,
                 COUNT(b.id) AS total
          FROM wards w
          JOIN beds b ON b.ward_id = w.id
          GROUP BY w.id
          ORDER BY w.name_ar ASC`,
    args: [],
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
          GROUP BY d
          ORDER BY d`,
    args: [],
  });

  const activity = await db.execute({
    sql: `SELECT t.* FROM timeline_events t
          JOIN admissions a ON a.id = t.admission_id
          JOIN patients p ON p.id = a.patient_id
          WHERE p.hospital_id = ?
          ORDER BY t.created_at DESC LIMIT 12`,
    args: [DEFAULT_HOSPITAL_ID],
  });

  return {
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