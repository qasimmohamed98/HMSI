import { db } from '../../db/index.js';
import { DEFAULT_HOSPITAL_ID } from '../config.js';

export interface ReportOverview {
  from: string;
  to: string;
  totalAdmissions: number;
  totalDischarges: number;
  activeAdmissions: number;
  criticalAlerts: number;
  pendingLabs: number;
  admissionsTrend: { label: string; count: number }[];
  dischargesTrend: { label: string; count: number }[];
  occupancy: { ward_name_ar: string; ward_name_en: string; used: number; total: number }[];
  recentActivity: { id: string; admission_id: string; actor: string; type: string; title_ar: string; created_at: string }[];
}

export async function getReportOverview(from: string, to: string): Promise<ReportOverview> {
  const [totals, current, admissionsTrend, dischargesTrend, occupancy, activity] = await Promise.all([
    db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM admissions a JOIN patients p ON p.id = a.patient_id
                WHERE p.hospital_id = ? AND date(a.admitted_at) BETWEEN date(?) AND date(?)) AS admissions,
              (SELECT COUNT(*) FROM admissions a JOIN patients p ON p.id = a.patient_id
                WHERE p.hospital_id = ? AND a.status = 'discharged' AND date(a.discharged_at) BETWEEN date(?) AND date(?)) AS discharges`,
      args: [DEFAULT_HOSPITAL_ID, from, to, DEFAULT_HOSPITAL_ID, from, to],
    }),
    db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = ? AND a.status = 'active') AS active,
              (SELECT COUNT(*) FROM patients WHERE hospital_id = ? AND status = 'active' AND critical_alerts_json != '[]' AND critical_alerts_json IS NOT NULL) AS critical,
              (SELECT COUNT(*) FROM lab_results WHERE status IN ('ordered', 'in_progress')) AS pending`,
      args: [DEFAULT_HOSPITAL_ID, DEFAULT_HOSPITAL_ID],
    }),
    db.execute({
      sql: `WITH RECURSIVE days(d) AS (
              SELECT date(?)
              UNION ALL
              SELECT date(d, '+1 day') FROM days WHERE d < date(?)
            )
            SELECT d AS day, COUNT(a.id) AS count
            FROM days LEFT JOIN admissions a ON date(a.admitted_at) = days.d
            GROUP BY d ORDER BY d`,
      args: [from, to],
    }),
    db.execute({
      sql: `WITH RECURSIVE days(d) AS (
              SELECT date(?)
              UNION ALL
              SELECT date(d, '+1 day') FROM days WHERE d < date(?)
            )
            SELECT d AS day, COUNT(a.id) AS count
            FROM days LEFT JOIN admissions a ON a.status = 'discharged' AND date(a.discharged_at) = days.d
            GROUP BY d ORDER BY d`,
      args: [from, to],
    }),
    db.execute({
      sql: `SELECT w.id, w.name_ar, w.name_en,
                   SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) AS used,
                   COUNT(b.id) AS total
            FROM wards w JOIN beds b ON b.ward_id = w.id
            GROUP BY w.id ORDER BY w.name_ar ASC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT t.id, t.admission_id, t.actor, t.type, t.title_ar, t.created_at
            FROM timeline_events t
            JOIN admissions a ON a.id = t.admission_id
            JOIN patients p ON p.id = a.patient_id
            WHERE p.hospital_id = ? AND date(t.created_at) BETWEEN date(?) AND date(?)
            ORDER BY t.created_at DESC LIMIT 40`,
      args: [DEFAULT_HOSPITAL_ID, from, to],
    }),
  ]);

  const total = totals.rows[0] as Record<string, unknown>;
  const cur = current.rows[0] as Record<string, unknown>;

  return {
    from,
    to,
    totalAdmissions: Number(total.admissions ?? 0),
    totalDischarges: Number(total.discharges ?? 0),
    activeAdmissions: Number(cur.active ?? 0),
    criticalAlerts: Number(cur.critical ?? 0),
    pendingLabs: Number(cur.pending ?? 0),
    admissionsTrend: admissionsTrend.rows.map((r) => ({ label: String((r as Record<string, unknown>).day), count: Number((r as Record<string, unknown>).count ?? 0) })),
    dischargesTrend: dischargesTrend.rows.map((r) => ({ label: String((r as Record<string, unknown>).day), count: Number((r as Record<string, unknown>).count ?? 0) })),
    occupancy: occupancy.rows.map((r) => {
      const w = r as Record<string, unknown>;
      return { ward_name_ar: String(w.name_ar), ward_name_en: String(w.name_en), used: Number(w.used ?? 0), total: Number(w.total ?? 0) };
    }),
    recentActivity: activity.rows.map((r) => {
      const w = r as Record<string, unknown>;
      return { id: String(w.id), admission_id: String(w.admission_id), actor: String(w.actor), type: String(w.type), title_ar: String(w.title_ar), created_at: String(w.created_at) };
    }),
  };
}