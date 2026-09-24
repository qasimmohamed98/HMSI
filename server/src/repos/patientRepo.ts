import type { Patient, AdmissionSummary } from '@hmsi/shared';
import { db, uuid, withTx } from '../../db/index.js';
import { isUniqueViolation } from '../lib/errors.js';

export interface PatientListOptions {
  search?: string;
  admitted?: boolean;
}

/** أعمدة التنويم الموحّدة — تتطلب aliases: a (admissions)، d (departments)، w (wards) */
export const ADMISSION_COLUMNS = `a.id AS admission_id, a.patient_id, a.department_id, a.ward_id, a.room,
       a.bed_no, a.status, a.admitted_at, a.discharged_at, a.discharge_type, a.discharge_summary, a.reason, a.family_pin,
       d.name_ar AS department_name_ar, d.name_en AS department_name_en,
       w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
       (SELECT full_name_ar FROM users u WHERE u.id = a.attending_doctor_id) AS attending_doctor`;

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export function mapAdmission(r: Record<string, unknown>): AdmissionSummary | null {
  if (!r.admission_id) return null;
  return {
    id: String(r.admission_id),
    department_id: String(r.department_id ?? ''),
    department_name_ar: String(r.department_name_ar ?? ''),
    department_name_en: String(r.department_name_en ?? ''),
    ward_id: String(r.ward_id ?? ''),
    ward_name_ar: String(r.ward_name_ar ?? ''),
    ward_name_en: String(r.ward_name_en ?? ''),
    room: String(r.room ?? ''),
    bed_no: String(r.bed_no ?? ''),
    attending_doctor: str(r.attending_doctor),
    admitted_at: String(r.admitted_at ?? ''),
    discharged_at: str(r.discharged_at),
    status: String(r.status ?? 'active') as AdmissionSummary['status'],
    reason: str(r.reason),
    discharge_type: str(r.discharge_type) as AdmissionSummary['discharge_type'],
    discharge_summary: str(r.discharge_summary),
    family_pin: str(r.family_pin),
  };
}

export function mapPatient(r: Record<string, unknown>, admission: AdmissionSummary | null): Patient {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    file_number: String(r.file_number),
    full_name_ar: String(r.full_name_ar),
    full_name_en: r.full_name_en ? String(r.full_name_en) : '',
    gender: String(r.gender) as Patient['gender'],
    birth_date: String(r.birth_date),
    phone: str(r.phone),
    national_id: str(r.national_id),
    blood_type: String(r.blood_type) as Patient['blood_type'],
    allergies_json: String(r.allergies_json ?? '[]'),
    critical_alerts_json: String(r.critical_alerts_json ?? '[]'),
    status: String(r.status) as Patient['status'],
    created_at: String(r.created_at),
    activeAdmission: admission,
  };
}

/** يهرب محارف LIKE الخاصة حتى يُبحث عنها حرفياً */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function listPatients(hospitalId: string, opts: PatientListOptions = {}): Promise<Patient[]> {
  const where: string[] = [`p.hospital_id = ?`, `p.archived_at IS NULL`];
  const args: (string | number)[] = [hospitalId];
  const search = opts.search?.trim();
  if (search) {
    where.push(`(p.full_name_ar LIKE ? ESCAPE '\\' OR p.full_name_en LIKE ? ESCAPE '\\' OR p.file_number LIKE ? ESCAPE '\\' OR p.national_id LIKE ? ESCAPE '\\' OR p.phone LIKE ? ESCAPE '\\')`);
    const pat = likePattern(search);
    args.push(pat, pat, pat, pat, pat);
  }
  if (opts.admitted) {
    where.push(`EXISTS (SELECT 1 FROM admissions a WHERE a.patient_id = p.id AND a.status = 'active')`);
  }
  const patients = await db.execute({
    sql: `SELECT p.* FROM patients p WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 200`,
    args,
  });

  const ids = patients.rows.map((r) => String((r as Record<string, unknown>).id));
  const admissionsByPatient = new Map<string, AdmissionSummary>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ');
    const adm = await db.execute({
      sql: `SELECT ${ADMISSION_COLUMNS}
            FROM admissions a
            LEFT JOIN departments d ON d.id = a.department_id
            LEFT JOIN wards w ON w.id = a.ward_id
            WHERE a.patient_id IN (${placeholders}) AND a.status = 'active'`,
      args: ids,
    });
    for (const row of adm.rows) {
      const r = row as Record<string, unknown>;
      const map = mapAdmission(r);
      if (map) admissionsByPatient.set(String(r.patient_id), map);
    }
  }

  return patients.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return mapPatient(r, admissionsByPatient.get(String(r.id)) ?? null);
  });
}

export async function getPatientById(id: string, hospitalId: string): Promise<Patient | null> {
  const rows = await db.execute({
    sql: `SELECT p.* FROM patients p WHERE p.id = ? AND p.hospital_id = ? AND p.archived_at IS NULL LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;

  const adm = await db.execute({
    sql: `SELECT ${ADMISSION_COLUMNS}
          FROM admissions a
          LEFT JOIN departments d ON d.id = a.department_id
          LEFT JOIN wards w ON w.id = a.ward_id
          WHERE a.patient_id = ? AND a.status = 'active'
          ORDER BY a.admitted_at DESC LIMIT 1`,
    args: [id],
  });
  const admission = adm.rows.length > 0 ? mapAdmission(adm.rows[0] as Record<string, unknown>) : null;
  return mapPatient(r, admission);
}

/** رقم ملف تسلسلي (FM-24501، FM-24502...) — فريد على مستوى النظام */
async function nextFileNumber(): Promise<string> {
  const rows = await db.execute({
    sql: `SELECT COALESCE(MAX(CAST(SUBSTR(file_number, 4) AS INTEGER)), 24500) AS n FROM patients WHERE file_number LIKE 'FM-%'`,
    args: [],
  });
  return `FM-${Number((rows.rows[0] as Record<string, unknown>).n) + 1}`;
}

export async function createPatient(input: {
  full_name_ar: string;
  full_name_en?: string;
  gender: 'male' | 'female';
  birth_date: string;
  phone?: string | null;
  national_id?: string | null;
  blood_type: string;
  allergies: string[];
  critical_alerts: string[];
}, createdBy: string, hospitalId: string): Promise<Patient> {
  const id = uuid('pat');
  // إعادة المحاولة عند تصادم رقم الملف بين طلبين متزامنين
  for (let attempt = 0; ; attempt++) {
    const fileNumber = await nextFileNumber();
    try {
      await db.execute({
        sql: `INSERT INTO patients (id, hospital_id, file_number, full_name_ar, full_name_en, gender, birth_date, phone, national_id, blood_type, allergies_json, critical_alerts_json, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        args: [
          id,
          hospitalId,
          fileNumber,
          input.full_name_ar,
          input.full_name_en ?? null,
          input.gender,
          input.birth_date,
          input.phone ?? null,
          input.national_id ?? null,
          input.blood_type,
          JSON.stringify(input.allergies),
          JSON.stringify(input.critical_alerts),
          createdBy,
        ],
      });
      break;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 4) throw e;
    }
  }
  return (await getPatientById(id, hospitalId))!;
}

export async function updatePatient(id: string, hospitalId: string, input: {
  full_name_ar?: string;
  full_name_en?: string | null;
  gender?: 'male' | 'female';
  birth_date?: string;
  phone?: string | null;
  national_id?: string | null;
  blood_type?: string;
  allergies?: string[];
  critical_alerts?: string[];
}): Promise<Patient | null> {
  const existing = await getPatientById(id, hospitalId);
  if (!existing) return null;

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const cols = ['full_name_ar', 'full_name_en', 'gender', 'birth_date', 'phone', 'national_id', 'blood_type'] as const;
  for (const col of cols) {
    const v = input[col];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v === null ? null : String(v));
    }
  }
  if (input.allergies !== undefined) {
    sets.push('allergies_json = ?');
    args.push(JSON.stringify(input.allergies));
  }
  if (input.critical_alerts !== undefined) {
    sets.push('critical_alerts_json = ?');
    args.push(JSON.stringify(input.critical_alerts));
  }
  if (sets.length === 0) return existing;
  args.push(id, hospitalId);
  await db.execute({
    sql: `UPDATE patients SET ${sets.join(', ')} WHERE id = ? AND hospital_id = ? AND archived_at IS NULL`,
    args,
  });
  return getPatientById(id, hospitalId);
}

export async function archivePatient(id: string, hospitalId: string): Promise<boolean> {
  return withTx(async (tx) => {
    const rows = await tx.execute({
      sql: `SELECT id FROM patients WHERE id = ? AND hospital_id = ? AND archived_at IS NULL LIMIT 1`,
      args: [id, hospitalId],
    });
    if (rows.rows.length === 0) return false;

    const active = await tx.execute({
      sql: `SELECT id, bed_id FROM admissions WHERE patient_id = ? AND status = 'active'`,
      args: [id],
    });
    for (const row of active.rows) {
      const r = row as Record<string, unknown>;
      await tx.execute({
        sql: `UPDATE admissions SET status = 'discharged', discharged_at = ?, bed_id = NULL, family_pin = NULL WHERE id = ?`,
        args: [new Date().toISOString(), String(r.id)],
      });
      if (r.bed_id) await tx.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [String(r.bed_id)] });
    }
    await tx.execute({
      sql: `UPDATE patients SET archived_at = datetime('now'), status = 'discharged' WHERE id = ?`,
      args: [id],
    });
    return true;
  });
}
