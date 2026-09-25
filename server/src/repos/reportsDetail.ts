import { db } from '../../db/index.js';

/**
 * التقارير التفصيلية: كل تقرير يعيد أعمدة وصفوفاً فعلية (وليس أرقاماً نهائية فقط) + ملخصاً.
 * أسماء الأعمدة والملخص تُترجم في الواجهة (reports.cols.* و reports.sum.*).
 * التواريخ تُحسب بتوقيت المستخدم (tz = فرق الدقائق عن UTC، العراق = 180).
 */
export const REPORT_TYPES = ['admissions', 'discharges', 'census', 'occupancy', 'lab', 'radiology', 'pharmacy', 'mar', 'diagnoses', 'doctors'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ColumnKind = 'text' | 'number' | 'date' | 'datetime' | 'percent' | 'enum';
export interface ReportColumn {
  key: string;
  kind: ColumnKind;
  /** للأعمدة من نوع enum: بادئة مفتاح الترجمة للقيمة، مثل discharge.types */
  enumPrefix?: string;
}
export interface DetailedReport {
  type: ReportType;
  from: string;
  to: string;
  /** تقرير لحظي لا يتأثر بالمدى (مثل المنوّمين حالياً) */
  snapshot: boolean;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary: { key: string; value: number | string; enumPrefix?: string }[];
}

export interface ReportFilters {
  from: string;
  to: string;
  tzMinutes: number;
  departmentId?: string;
  doctorId?: string;
}

type Row = Record<string, unknown>;
const MAX_ROWS = 5000;

const col = (key: string, kind: ColumnKind = 'text', enumPrefix?: string): ReportColumn => ({ key, kind, ...(enumPrefix && { enumPrefix }) });

function clean(r: Row): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(r)) out[k] = v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'bigint' ? Number(v) : String(v);
  return out;
}

export async function getDetailedReport(type: ReportType, hospitalId: string, f: ReportFilters): Promise<DetailedReport> {
  // تاريخ محلي لعمود زمني: date(x, '+180 minutes')
  const shift = `'${f.tzMinutes >= 0 ? '+' : ''}${Math.trunc(f.tzMinutes)} minutes'`;
  const local = (c: string) => `date(${c}, ${shift})`;
  const inRange = (c: string) => `${local(c)} BETWEEN date(?) AND date(?)`;
  const dept = f.departmentId ? ` AND a.department_id = ?` : '';
  const doc = f.doctorId ? ` AND a.attending_doctor_id = ?` : '';
  const extra = [...(f.departmentId ? [f.departmentId] : []), ...(f.doctorId ? [f.doctorId] : [])];
  const q = async (sql: string, args: (string | number)[]) => (await db.execute({ sql: `${sql} LIMIT ${MAX_ROWS}`, args })).rows.map((r) => clean(r as Row));
  const base = { type, from: f.from, to: f.to, snapshot: false };

  const PATIENT = `p.file_number, p.full_name_ar AS patient, p.gender,
                   CAST((julianday('now') - julianday(p.birth_date)) / 365.25 AS INTEGER) AS age`;
  const PLACE = `d.name_ar AS department, w.name_ar AS ward, a.room || ' / ' || a.bed_no AS bed,
                 (SELECT full_name_ar FROM users u WHERE u.id = a.attending_doctor_id) AS doctor`;
  const FROM_ADM = `FROM admissions a JOIN patients p ON p.id = a.patient_id
                    LEFT JOIN departments d ON d.id = a.department_id LEFT JOIN wards w ON w.id = a.ward_id`;
  const LOS = `ROUND(julianday(COALESCE(a.discharged_at, datetime('now'))) - julianday(a.admitted_at), 1)`;

  switch (type) {
    case 'admissions': {
      const rows = await q(
        `SELECT a.admitted_at, ${PATIENT}, ${PLACE}, a.reason, a.status, a.discharged_at, ${LOS} AS los_days, a.discharge_type
         ${FROM_ADM} WHERE p.hospital_id = ? AND ${inRange('a.admitted_at')}${dept}${doc} ORDER BY a.admitted_at DESC`,
        [hospitalId, f.from, f.to, ...extra],
      );
      const still = rows.filter((r) => r.status === 'active').length;
      const avg = rows.length ? rows.reduce((s, r) => s + Number(r.los_days ?? 0), 0) / rows.length : 0;
      return {
        ...base,
        columns: [col('admitted_at', 'datetime'), col('file_number'), col('patient'), col('gender', 'enum', 'gender'), col('age', 'number'), col('department'), col('ward'), col('bed'), col('doctor'), col('reason'), col('status', 'enum', 'status'), col('discharged_at', 'datetime'), col('los_days', 'number'), col('discharge_type', 'enum', 'discharge.types')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'stillAdmitted', value: still },
          { key: 'discharged', value: rows.length - still },
          { key: 'avgLos', value: Math.round(avg * 10) / 10 },
          { key: 'male', value: rows.filter((r) => r.gender === 'male').length },
          { key: 'female', value: rows.filter((r) => r.gender === 'female').length },
        ],
      };
    }
    case 'discharges': {
      const rows = await q(
        `SELECT a.discharged_at, ${PATIENT}, ${PLACE}, a.admitted_at, ${LOS} AS los_days, a.discharge_type, a.discharge_summary
         ${FROM_ADM} WHERE p.hospital_id = ? AND a.status = 'discharged' AND ${inRange('a.discharged_at')}${dept}${doc} ORDER BY a.discharged_at DESC`,
        [hospitalId, f.from, f.to, ...extra],
      );
      const by = (t: string) => rows.filter((r) => r.discharge_type === t).length;
      const avg = rows.length ? rows.reduce((s, r) => s + Number(r.los_days ?? 0), 0) / rows.length : 0;
      return {
        ...base,
        columns: [col('discharged_at', 'datetime'), col('file_number'), col('patient'), col('gender', 'enum', 'gender'), col('age', 'number'), col('department'), col('doctor'), col('admitted_at', 'datetime'), col('los_days', 'number'), col('discharge_type', 'enum', 'discharge.types'), col('discharge_summary')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'home', value: by('home') },
          { key: 'transfer', value: by('transfer') },
          { key: 'death', value: by('death') },
          { key: 'ama', value: by('ama') },
          { key: 'avgLos', value: Math.round(avg * 10) / 10 },
        ],
      };
    }
    case 'census': {
      const rows = await q(
        `SELECT ${PATIENT}, ${PLACE}, a.admitted_at, ${LOS} AS los_days, a.reason,
                p.allergies_json AS allergies, p.critical_alerts_json AS alerts
         ${FROM_ADM} WHERE p.hospital_id = ? AND a.status = 'active'${dept}${doc} ORDER BY w.name_ar, a.room, a.bed_no`,
        [hospitalId, ...extra],
      );
      const list = (v: unknown) => {
        try {
          return (JSON.parse(String(v ?? '[]')) as string[]).join('، ');
        } catch {
          return '';
        }
      };
      rows.forEach((r) => {
        r.allergies = list(r.allergies) || null;
        r.alerts = list(r.alerts) || null;
      });
      return {
        ...base,
        snapshot: true,
        columns: [col('ward'), col('bed'), col('file_number'), col('patient'), col('gender', 'enum', 'gender'), col('age', 'number'), col('department'), col('doctor'), col('admitted_at', 'datetime'), col('los_days', 'number'), col('reason'), col('allergies'), col('alerts')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'withoutBed', value: rows.filter((r) => !r.ward).length },
          { key: 'withAlerts', value: rows.filter((r) => r.alerts).length },
          { key: 'over7', value: rows.filter((r) => Number(r.los_days) > 7).length },
        ],
      };
    }
    case 'occupancy': {
      const rows = await q(
        `SELECT d.name_ar AS department, w.name_ar AS ward,
                COUNT(b.id) AS beds,
                SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
                (SELECT COUNT(*) FROM admissions a WHERE a.ward_id = w.id AND ${inRange('a.admitted_at')}) AS admissions_in_range,
                (SELECT ROUND(AVG(julianday(a.discharged_at) - julianday(a.admitted_at)), 1) FROM admissions a
                   WHERE a.ward_id = w.id AND a.status = 'discharged' AND ${inRange('a.discharged_at')}) AS avg_los
         FROM wards w JOIN departments d ON d.id = w.department_id LEFT JOIN beds b ON b.ward_id = w.id
         WHERE d.hospital_id = ?${f.departmentId ? ' AND d.id = ?' : ''}
         GROUP BY w.id ORDER BY d.name_ar, w.name_ar`,
        [f.from, f.to, f.from, f.to, hospitalId, ...(f.departmentId ? [f.departmentId] : [])],
      );
      rows.forEach((r) => {
        r.free = Number(r.beds) - Number(r.occupied);
        r.rate = Number(r.beds) ? Number(r.occupied) / Number(r.beds) : 0;
      });
      const beds = rows.reduce((s, r) => s + Number(r.beds), 0);
      const occ = rows.reduce((s, r) => s + Number(r.occupied), 0);
      return {
        ...base,
        columns: [col('department'), col('ward'), col('beds', 'number'), col('occupied', 'number'), col('free', 'number'), col('rate', 'percent'), col('admissions_in_range', 'number'), col('avg_los', 'number')],
        rows,
        summary: [
          { key: 'beds', value: beds },
          { key: 'occupied', value: occ },
          { key: 'free', value: beds - occ },
          { key: 'rate', value: beds ? `${Math.round((occ / beds) * 100)}%` : '0%' },
        ],
      };
    }
    case 'lab': {
      const rows = await q(
        `SELECT lr.ordered_at, p.file_number, p.full_name_ar AS patient, d.name_ar AS department, lr.test_name_ar AS test, lr.category,
                lr.ordered_by, lr.status, lr.result, lr.unit, lr.reference_range, lr.resulted_by, lr.resulted_at,
                CASE WHEN lr.resulted_at IS NOT NULL THEN ROUND((julianday(lr.resulted_at) - julianday(lr.ordered_at)) * 24, 1) END AS tat_hours
         FROM lab_results lr JOIN admissions a ON a.id = lr.admission_id JOIN patients p ON p.id = a.patient_id LEFT JOIN departments d ON d.id = a.department_id
         WHERE p.hospital_id = ? AND ${inRange('lr.ordered_at')}${dept} ORDER BY lr.ordered_at DESC`,
        [hospitalId, f.from, f.to, ...(f.departmentId ? [f.departmentId] : [])],
      );
      const done = rows.filter((r) => r.status === 'resulted' || r.status === 'abnormal');
      const tat = done.filter((r) => r.tat_hours !== null);
      return {
        ...base,
        columns: [col('ordered_at', 'datetime'), col('file_number'), col('patient'), col('department'), col('test'), col('category'), col('ordered_by'), col('status', 'enum', 'laboratory.statuses'), col('result'), col('unit'), col('reference_range'), col('resulted_by'), col('resulted_at', 'datetime'), col('tat_hours', 'number')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'completed', value: done.length },
          { key: 'pending', value: rows.length - done.length },
          { key: 'abnormal', value: rows.filter((r) => r.status === 'abnormal').length },
          { key: 'avgTat', value: tat.length ? Math.round((tat.reduce((s, r) => s + Number(r.tat_hours), 0) / tat.length) * 10) / 10 : 0 },
        ],
      };
    }
    case 'radiology': {
      const rows = await q(
        `SELECT rr.ordered_at, p.file_number, p.full_name_ar AS patient, d.name_ar AS department, rr.study_type_ar AS study,
                rr.ordered_by, rr.status, rr.performed_by, rr.report
         FROM radiology_reports rr JOIN admissions a ON a.id = rr.admission_id JOIN patients p ON p.id = a.patient_id LEFT JOIN departments d ON d.id = a.department_id
         WHERE p.hospital_id = ? AND ${inRange('rr.ordered_at')}${dept} ORDER BY rr.ordered_at DESC`,
        [hospitalId, f.from, f.to, ...(f.departmentId ? [f.departmentId] : [])],
      );
      const done = rows.filter((r) => r.report);
      return {
        ...base,
        columns: [col('ordered_at', 'datetime'), col('file_number'), col('patient'), col('department'), col('study'), col('ordered_by'), col('status', 'enum', 'radiology.statuses'), col('performed_by'), col('report')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'completed', value: done.length },
          { key: 'pending', value: rows.length - done.length },
        ],
      };
    }
    case 'pharmacy': {
      const rows = await q(
        `SELECT m.created_at AS prescribed_at, p.file_number, p.full_name_ar AS patient, d.name_ar AS department, m.name_ar AS medication,
                m.dose, m.route, m.frequency, m.prescribed_by, m.status AS med_status, m.dispensed_by, m.dispensed_at
         FROM medications m JOIN admissions a ON a.id = m.admission_id JOIN patients p ON p.id = a.patient_id LEFT JOIN departments d ON d.id = a.department_id
         WHERE p.hospital_id = ? AND ${inRange('m.created_at')}${dept} ORDER BY m.created_at DESC`,
        [hospitalId, f.from, f.to, ...(f.departmentId ? [f.departmentId] : [])],
      );
      return {
        ...base,
        columns: [col('prescribed_at', 'datetime'), col('file_number'), col('patient'), col('department'), col('medication'), col('dose'), col('route'), col('frequency'), col('prescribed_by'), col('med_status', 'enum', 'medications.statuses'), col('dispensed_by'), col('dispensed_at', 'datetime')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'dispensed', value: rows.filter((r) => r.dispensed_at).length },
          { key: 'notDispensed', value: rows.filter((r) => !r.dispensed_at && r.med_status === 'active').length },
        ],
      };
    }
    case 'mar': {
      const rows = await q(
        `SELECT ma.administered_at, p.file_number, p.full_name_ar AS patient, w.name_ar AS ward, m.name_ar AS medication, m.dose,
                ma.status AS dose_status, ma.administered_by, ma.note
         FROM medication_administrations ma JOIN medications m ON m.id = ma.medication_id
         JOIN admissions a ON a.id = ma.admission_id JOIN patients p ON p.id = a.patient_id LEFT JOIN wards w ON w.id = a.ward_id
         WHERE p.hospital_id = ? AND ${inRange('ma.administered_at')}${dept} ORDER BY ma.administered_at DESC`,
        [hospitalId, f.from, f.to, ...(f.departmentId ? [f.departmentId] : [])],
      );
      const by = (s: string) => rows.filter((r) => r.dose_status === s).length;
      return {
        ...base,
        columns: [col('administered_at', 'datetime'), col('file_number'), col('patient'), col('ward'), col('medication'), col('dose'), col('dose_status', 'enum', 'mar.statuses'), col('administered_by'), col('note')],
        rows,
        summary: [
          { key: 'total', value: rows.length },
          { key: 'given', value: by('given') },
          { key: 'held', value: by('held') },
          { key: 'refused', value: by('refused') },
        ],
      };
    }
    case 'diagnoses': {
      const rows = await q(
        `SELECT dg.title_ar AS diagnosis, dg.icd10, COUNT(*) AS cases,
                SUM(CASE WHEN dg.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
                SUM(CASE WHEN dg.status = 'suspected' THEN 1 ELSE 0 END) AS suspected,
                SUM(CASE WHEN dg.status = 'resolved' THEN 1 ELSE 0 END) AS resolved
         FROM diagnoses dg JOIN admissions a ON a.id = dg.admission_id JOIN patients p ON p.id = a.patient_id
         WHERE p.hospital_id = ? AND ${inRange('dg.created_at')}${dept}
         GROUP BY lower(trim(dg.title_ar)), dg.icd10 ORDER BY cases DESC`,
        [hospitalId, f.from, f.to, ...(f.departmentId ? [f.departmentId] : [])],
      );
      return {
        ...base,
        columns: [col('diagnosis'), col('icd10'), col('cases', 'number'), col('confirmed', 'number'), col('suspected', 'number'), col('resolved', 'number')],
        rows,
        summary: [
          { key: 'distinct', value: rows.length },
          { key: 'total', value: rows.reduce((s, r) => s + Number(r.cases), 0) },
        ],
      };
    }
    case 'doctors': {
      const rows = await q(
        `SELECT u.full_name_ar AS doctor,
                (SELECT COUNT(*) FROM admissions a WHERE a.attending_doctor_id = u.id AND ${inRange('a.admitted_at')}) AS admissions_in_range,
                (SELECT COUNT(*) FROM admissions a WHERE a.attending_doctor_id = u.id AND a.status = 'active') AS current_patients,
                (SELECT COUNT(*) FROM admissions a WHERE a.attending_doctor_id = u.id AND a.status = 'discharged' AND ${inRange('a.discharged_at')}) AS discharges,
                (SELECT COUNT(*) FROM medical_notes n WHERE n.author_id = u.id AND ${inRange('n.recorded_at')}) AS notes,
                (SELECT COUNT(*) FROM lab_results lr WHERE lr.ordered_by = u.full_name_ar AND ${inRange('lr.ordered_at')}) AS lab_orders,
                (SELECT COUNT(*) FROM medications m WHERE m.prescribed_by = u.full_name_ar AND ${inRange('m.created_at')}) AS prescriptions
         FROM users u WHERE u.hospital_id = ? AND u.role = 'doctor' AND u.is_active = 1 ORDER BY u.full_name_ar`,
        [f.from, f.to, f.from, f.to, f.from, f.to, f.from, f.to, f.from, f.to, hospitalId],
      );
      return {
        ...base,
        columns: [col('doctor'), col('admissions_in_range', 'number'), col('current_patients', 'number'), col('discharges', 'number'), col('notes', 'number'), col('lab_orders', 'number'), col('prescriptions', 'number')],
        rows,
        summary: [
          { key: 'doctors', value: rows.length },
          { key: 'total', value: rows.reduce((s, r) => s + Number(r.admissions_in_range), 0) },
        ],
      };
    }
  }
}
