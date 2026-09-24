import type { PublicUser, DischargeType } from '@hmsi/shared';
import type { Transaction } from '@libsql/client';
import { db, uuid, withTx, generateFamilyPin } from '../../db/index.js';
import { HttpConflict } from '../lib/errors.js';

export { HttpConflict };

type Row = Record<string, unknown>;

/** سرير ضمن المستشفى — للقراءة داخل transaction */
async function getBedInHospital(tx: Transaction, bedId: string, hospitalId: string): Promise<Row | null> {
  const rows = await tx.execute({
    sql: `SELECT b.id, b.ward_id, b.room, b.bed_no, b.status, w.department_id FROM beds b
          JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id
          WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [bedId, hospitalId],
  });
  return (rows.rows[0] as Row | undefined) ?? null;
}

/** حجز السرير بشرط أن يكون شاغراً — يمنع حجز نفس السرير مرتين بطلبين متزامنين */
async function occupyBed(tx: Transaction, bedId: string): Promise<void> {
  const res = await tx.execute({ sql: `UPDATE beds SET status = 'occupied' WHERE id = ? AND status = 'free'`, args: [bedId] });
  if (res.rowsAffected !== 1) throw new HttpConflict('السرير مشغول');
}

export async function admitPatient(input: {
  patient_id: string;
  bed_id: string;
  department_id: string;
  attending_doctor_id?: string | null;
  reason?: string;
}, hospitalId: string): Promise<{ admission_id: string; patient_id: string; family_pin: string }> {
  return withTx(async (tx) => {
    const patientRows = await tx.execute({
      sql: `SELECT id FROM patients WHERE id = ? AND hospital_id = ? AND archived_at IS NULL LIMIT 1`,
      args: [input.patient_id, hospitalId],
    });
    if (patientRows.rows.length === 0) throw new HttpConflict('المريض غير موجود');

    const activeRows = await tx.execute({
      sql: `SELECT id FROM admissions WHERE patient_id = ? AND status = 'active' LIMIT 1`,
      args: [input.patient_id],
    });
    if (activeRows.rows.length > 0) throw new HttpConflict('المريض منوّم بالفعل');

    const dept = await tx.execute({ sql: `SELECT id FROM departments WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [input.department_id, hospitalId] });
    if (dept.rows.length === 0) throw new HttpConflict('القسم غير موجود');

    const bed = await getBedInHospital(tx, input.bed_id, hospitalId);
    if (!bed) throw new HttpConflict('السرير غير موجود');

    if (input.attending_doctor_id) {
      const doc = await tx.execute({
        sql: `SELECT id FROM users WHERE id = ? AND hospital_id = ? AND role IN ('doctor','admin') AND is_active = 1 LIMIT 1`,
        args: [input.attending_doctor_id, hospitalId],
      });
      if (doc.rows.length === 0) throw new HttpConflict('الطبيب المعالج غير موجود');
    }

    await occupyBed(tx, input.bed_id);

    const admissionId = uuid('adm');
    const familyPin = generateFamilyPin();
    await tx.execute({
      sql: `INSERT INTO admissions (id, patient_id, bed_id, department_id, ward_id, room, bed_no, attending_doctor_id, admitted_at, status, reason, family_pin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      args: [admissionId, input.patient_id, input.bed_id, input.department_id, String(bed.ward_id), String(bed.room), String(bed.bed_no), input.attending_doctor_id ?? null, new Date().toISOString(), input.reason ?? null, familyPin],
    });
    await tx.execute({ sql: `UPDATE patients SET status = 'active' WHERE id = ?`, args: [input.patient_id] });
    return { admission_id: admissionId, patient_id: input.patient_id, family_pin: familyPin };
  });
}

export async function transferAdmission(admissionId: string, bedId: string, hospitalId: string): Promise<{ admission_id: string; bed_id: string }> {
  return withTx(async (tx) => {
    const rows = await tx.execute({
      sql: `SELECT a.status, a.bed_id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? AND p.hospital_id = ? LIMIT 1`,
      args: [admissionId, hospitalId],
    });
    const scope = rows.rows[0] as Row | undefined;
    if (!scope || String(scope.status) !== 'active') throw new HttpConflict('التنويم غير نشط');
    if (scope.bed_id && String(scope.bed_id) === bedId) throw new HttpConflict('المريض في هذا السرير بالفعل');

    const bed = await getBedInHospital(tx, bedId, hospitalId);
    if (!bed) throw new HttpConflict('السرير غير موجود');
    await occupyBed(tx, bedId);

    if (scope.bed_id) await tx.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [String(scope.bed_id)] });
    await tx.execute({
      sql: `UPDATE admissions SET bed_id = ?, ward_id = ?, room = ?, bed_no = ? WHERE id = ?`,
      args: [bedId, String(bed.ward_id), String(bed.room), String(bed.bed_no), admissionId],
    });
    return { admission_id: admissionId, bed_id: bedId };
  });
}

export async function dischargeAdmission(
  admissionId: string,
  hospitalId: string,
  input: { discharge_type: DischargeType; summary?: string | null },
): Promise<{ dischargedAt: string }> {
  return withTx(async (tx) => {
    const rows = await tx.execute({
      sql: `SELECT a.status, a.bed_id, a.patient_id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? AND p.hospital_id = ? LIMIT 1`,
      args: [admissionId, hospitalId],
    });
    const a = rows.rows[0] as Row | undefined;
    if (!a) throw new HttpConflict('التنويم غير موجود');
    if (String(a.status) !== 'active') throw new HttpConflict('الخروج مسجّل مسبقاً');

    const dischargedAt = new Date().toISOString();
    // سبب الدخول (reason) يبقى كما هو؛ ملخص الخروج في عمود مستقل. رمز العائلة يُلغى.
    await tx.execute({
      sql: `UPDATE admissions SET status = 'discharged', discharge_type = ?, discharged_at = ?, discharge_summary = ?, bed_id = NULL, family_pin = NULL WHERE id = ?`,
      args: [input.discharge_type, dischargedAt, input.summary ?? null, admissionId],
    });
    await tx.execute({ sql: `UPDATE patients SET status = 'discharged' WHERE id = ?`, args: [String(a.patient_id)] });
    if (a.bed_id) await tx.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [String(a.bed_id)] });
    return { dischargedAt };
  });
}

/** إصدار رمز عائلة جديد (مثلاً إذا تسرّب الرمز القديم) */
export async function regenerateFamilyPin(admissionId: string, hospitalId: string): Promise<string> {
  const pin = generateFamilyPin();
  const res = await db.execute({
    sql: `UPDATE admissions SET family_pin = ?
          WHERE id = ? AND status = 'active' AND patient_id IN (SELECT id FROM patients WHERE hospital_id = ?)`,
    args: [pin, admissionId, hospitalId],
  });
  if (res.rowsAffected !== 1) throw new HttpConflict('التنويم غير موجود أو غير نشط');
  return pin;
}

export async function listDoctors(hospitalId: string): Promise<PublicUser[]> {
  const rows = await db.execute({
    sql: `SELECT id, full_name_ar, full_name_en, role FROM users
          WHERE hospital_id = ? AND role IN ('admin', 'doctor') AND is_active = 1
          ORDER BY full_name_ar ASC`,
    args: [hospitalId],
  });
  return rows.rows.map((row) => {
    const r = row as Row;
    return {
      id: String(r.id),
      full_name_ar: String(r.full_name_ar),
      full_name_en: r.full_name_en ? String(r.full_name_en) : '',
      role: String(r.role) as PublicUser['role'],
    };
  });
}
