import type { PublicUser } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';

export async function admitPatient(input: {
  patient_id: string;
  bed_id: string;
  department_id: string;
  attending_doctor_id?: string | null;
  reason?: string;
}, hospitalId: string): Promise<{ admission_id: string; patient_id: string }> {
  const patientRows = await db.execute({
    sql: `SELECT id, status FROM patients WHERE id = ? AND hospital_id = ? LIMIT 1`,
    args: [input.patient_id, hospitalId],
  });
  if (patientRows.rows.length === 0) throw new HttpConflict('المريض غير موجود');

  const activeRows = await db.execute({
    sql: `SELECT id FROM admissions WHERE patient_id = ? AND status = 'active' LIMIT 1`,
    args: [input.patient_id],
  });
  if (activeRows.rows.length > 0) throw new HttpConflict('المريض منوّم بالفعل');

  const bedRows = await db.execute({
    sql: `SELECT b.id, b.ward_id, b.room, b.bed_no, b.status FROM beds b
          JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id
          WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [input.bed_id, hospitalId],
  });
  if (bedRows.rows.length === 0) throw new HttpConflict('السرير غير موجود');
  const bed = bedRows.rows[0] as Record<string, unknown>;
  if (String(bed.status) === 'occupied') throw new HttpConflict('السرير مشغول');

  if (input.attending_doctor_id) {
    const doc = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [input.attending_doctor_id, hospitalId] });
    if (doc.rows.length === 0) throw new HttpConflict('الطبيب المعالج غير موجود');
  }

  const admissionId = uuid('adm');
  const admittedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO admissions (id, patient_id, bed_id, department_id, ward_id, room, bed_no, attending_doctor_id, admitted_at, status, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [admissionId, input.patient_id, input.bed_id, input.department_id, String(bed.ward_id), String(bed.room), String(bed.bed_no), input.attending_doctor_id ?? null, admittedAt, input.reason ?? null],
  });
  await db.execute({ sql: `UPDATE beds SET status = 'occupied' WHERE id = ?`, args: [input.bed_id] });
  await db.execute({ sql: `UPDATE patients SET status = 'active' WHERE id = ?`, args: [input.patient_id] });
  return { admission_id: admissionId, patient_id: input.patient_id };
}

export async function transferAdmission(admissionId: string, bedId: string, hospitalId: string): Promise<{ admission_id: string; bed_id: string }> {
  const scope = await getAdmissionScopeForTransfer(admissionId, hospitalId);
  if (!scope || scope.status !== 'active') throw new HttpConflict('التنويم غير نشط');

  const bedRows = await db.execute({
    sql: `SELECT b.id, b.ward_id, b.room, b.bed_no, b.status FROM beds b
          JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id
          WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [bedId, hospitalId],
  });
  if (bedRows.rows.length === 0) throw new HttpConflict('السرير غير موجود');
  const bed = bedRows.rows[0] as Record<string, unknown>;
  if (String(bed.status) === 'occupied') throw new HttpConflict('السرير مشغول');

  if (scope.bed_id) await db.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [scope.bed_id] });
  await db.execute({
    sql: `UPDATE admissions SET bed_id = ?, ward_id = ?, room = ?, bed_no = ? WHERE id = ?`,
    args: [bedId, String(bed.ward_id), String(bed.room), String(bed.bed_no), admissionId],
  });
  await db.execute({ sql: `UPDATE beds SET status = 'occupied' WHERE id = ?`, args: [bedId] });
  return { admission_id: admissionId, bed_id: bedId };
}

async function getAdmissionScopeForTransfer(admissionId: string, hospitalId: string): Promise<{ status: string; bed_id: string | null } | null> {
  const rows = await db.execute({
    sql: `SELECT a.status, a.bed_id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? AND p.hospital_id = ? LIMIT 1`,
    args: [admissionId, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { status: String(r.status), bed_id: r.bed_id ? String(r.bed_id) : null };
}

export async function listDoctors(hospitalId: string): Promise<PublicUser[]> {
  const rows = await db.execute({
    sql: `SELECT id, full_name_ar, full_name_en, role FROM users
          WHERE hospital_id = ? AND role IN ('admin', 'doctor') AND is_active = 1
          ORDER BY full_name_ar ASC`,
    args: [hospitalId],
  });
  return rows.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      full_name_ar: String(r.full_name_ar),
      full_name_en: r.full_name_en ? String(r.full_name_en) : '',
      role: String(r.role) as PublicUser['role'],
    };
  });
}

export class HttpConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpConflict';
  }
}