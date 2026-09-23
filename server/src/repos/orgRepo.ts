import { randomUUID } from 'node:crypto';
import type { Hospital, Department, Ward, Bed, UnassignedPatient } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { HttpConflict } from './admissionRepo.js';

function mapDepartment(r: Record<string, unknown>): Department {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    name_ar: String(r.name_ar),
    name_en: String(r.name_en),
    ward_count: r.ward_count === undefined ? undefined : Number(r.ward_count),
  };
}

export function generateBedCode(): string {
  return 'b' + randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function getHospital(id: string): Promise<Hospital | null> {
  const rows = await db.execute({ sql: `SELECT * FROM hospitals WHERE id = ? LIMIT 1`, args: [id] });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    name_ar: String(r.name_ar),
    name_en: String(r.name_en),
    code: String(r.code),
    created_at: String(r.created_at),
  };
}

export async function updateHospital(id: string, input: { name_ar?: string; name_en?: string }): Promise<Hospital | null> {
  await db.execute({
    sql: `UPDATE hospitals SET name_ar = COALESCE(?, name_ar), name_en = COALESCE(?, name_en) WHERE id = ?`,
    args: [input.name_ar ?? null, input.name_en ?? null, id],
  });
  return getHospital(id);
}

export async function listDepartments(hospitalId: string): Promise<Department[]> {
  const rows = await db.execute({
    sql: `SELECT d.*, (SELECT COUNT(*) FROM wards w WHERE w.department_id = d.id) AS ward_count
          FROM departments d
          WHERE d.hospital_id = ?
          ORDER BY d.name_ar ASC`,
    args: [hospitalId],
  });
  return rows.rows.map((r) => mapDepartment(r as Record<string, unknown>));
}

export async function getDepartment(id: string, hospitalId: string): Promise<Department | null> {
  const rows = await db.execute({ sql: `SELECT d.* FROM departments d WHERE d.id = ? AND d.hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  if (rows.rows.length === 0) return null;
  return mapDepartment(rows.rows[0] as Record<string, unknown>);
}

export async function createDepartment(input: { name_ar: string; name_en?: string | null }, hospitalId: string): Promise<Department> {
  const id = uuid('dep');
  await db.execute({
    sql: `INSERT INTO departments (id, hospital_id, name_ar, name_en) VALUES (?, ?, ?, ?)`,
    args: [id, hospitalId, input.name_ar, input.name_en ?? null],
  });
  return (await getDepartment(id, hospitalId))!;
}

export async function updateDepartment(id: string, hospitalId: string, input: { name_ar?: string; name_en?: string | null }): Promise<Department | null> {
  const exists = await getDepartment(id, hospitalId);
  if (!exists) return null;
  await db.execute({
    sql: `UPDATE departments SET name_ar = COALESCE(?, name_ar), name_en = COALESCE(?, name_en) WHERE id = ?`,
    args: [input.name_ar ?? null, input.name_en ?? null, id],
  });
  return getDepartment(id, hospitalId);
}

export async function deleteDepartment(id: string, hospitalId: string): Promise<boolean> {
  if (!(await getDepartment(id, hospitalId))) return false;
  const wards = await db.execute({ sql: `SELECT COUNT(*) AS n FROM wards WHERE department_id = ?`, args: [id] });
  if (Number((wards.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف قسم يحتوي على ردهات — احذف الردهات أولاً');
  }
  const adm = await db.execute({ sql: `SELECT COUNT(*) AS n FROM admissions WHERE department_id = ?`, args: [id] });
  if (Number((adm.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف قسم له سجل تنويم — أولِه لتصفير البيانات');
  }
  await db.execute({ sql: `DELETE FROM departments WHERE id = ?`, args: [id] });
  return true;
}

export async function createWard(input: { department_id: string; name_ar: string; name_en?: string | null; ward_type: 'male' | 'female' | 'mixed' }, hospitalId: string): Promise<Ward | null> {
  const dept = await getDepartment(input.department_id, hospitalId);
  if (!dept) throw new HttpConflict('القسم غير موجود');
  const id = uuid('wr');
  await db.execute({
    sql: `INSERT INTO wards (id, department_id, name_ar, name_en, ward_type) VALUES (?, ?, ?, ?, ?)`,
    args: [id, input.department_id, input.name_ar, input.name_en ?? null, input.ward_type],
  });
  return (await getWardById(id, hospitalId)) ?? null;
}

export async function listHospitals(): Promise<Hospital[]> {
  const rows = await db.execute({ sql: `SELECT * FROM hospitals ORDER BY name_ar ASC`, args: [] });
  return rows.rows.length === 0 ? [] : rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name_ar: String(row.name_ar),
      name_en: String(row.name_en),
      code: String(row.code),
      created_at: String(row.created_at),
    };
  });
}

export async function createHospital(input: { name_ar: string; name_en?: string | null; code?: string }, createdBy: string): Promise<Hospital> {
  const id = uuid('hosp');
  const code = input.code ?? generateBedCode(); // reuse bed code generator for hospital code
  await db.execute({
    sql: `INSERT INTO hospitals (id, code, name_ar, name_en, created_by) VALUES (?, ?, ?, ?, ?)`,
    args: [id, code, input.name_ar, input.name_en ?? null, createdBy],
  });
  return await getHospital(id);
}

export async function createHospitalAdmin(hospitalId: string, input: { username: string; password: string; full_name_ar: string; full_name_en?: string; email?: string | null }, createdBy: string): Promise<{ id: string; username: string; full_name_ar: string; is_active: boolean }> {
  // check username uniqueness globally
  const existing = await db.execute({ sql: `SELECT id FROM users WHERE username = ? LIMIT 1`, args: [input.username] });
  if (existing.rows.length > 0) throw new HttpConflict('اسم المستخدم مستخدم بالفعل');
  const userId = uuid('adm');
  await db.execute({
    sql: `INSERT INTO users (id, hospital_id, username, password, full_name_ar, full_name_en, role, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, 'admin', 1, ?)`,
    args: [userId, hospitalId, input.username, input.password, input.full_name_ar, input.full_name_en ?? null, createdBy],
  });
  return {
    id: userId,
    username: input.username,
    full_name_ar: input.full_name_ar,
    is_active: true,
  };
}

export interface PublicTrackBed {
  id: string;
  code: string;
  room: string;
  bed_no: string;
  ward_id: string;
}

export interface PublicTrackData {
  bed: PublicTrackBed;
  hospital: { id: string; name_ar: string; name_en: string };
  ward: { id: string; name_ar: string; name_en: string } | null;
  department: { id: string; name_ar: string; name_en: string } | null;
  occupied: boolean;
  patient: {
    id: string;
    file_number: string;
    full_name_ar: string;
    full_name_en: string;
    gender: string;
    birth_date: string;
    blood_type: string;
    allergies: string[];
    critical_alerts: string[];
  } | null;
  admission: {
    id: string;
    status: string;
    admitted_at: string;
    discharged_at: string | null;
    reason: string | null;
    attending_doctor: string | null;
  } | null;
  vitals: any[];
  notes: any[];
  diagnoses: any[];
  medications: any[];
  labs: any[];
  radiology: any[];
  consultations: any[];
  procedures: any[];
}

export async function getPublicTrackByBedCode(code: string, hospitalId: string): Promise<PublicTrackData | null> {
  // Find bed by code within hospital
  const bedRows = await db.execute({
    sql: `SELECT b.*, w.id AS ward_id, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en, d.id AS department_id, d.name_ar AS department_name_ar, d.name_en AS department_name_en
          FROM beds b
          JOIN wards w ON w.id = b.ward_id
          JOIN departments d ON d.id = w.department_id
          WHERE b.code = ? AND d.hospital_id = ?
          LIMIT 1`,
    args: [code, hospitalId],
  });
  if (bedRows.rows.length === 0) return null;
  const bed = bedRows.rows[0] as Record<string, unknown>;
  const bedInfo: PublicTrackBed = {
    id: String(bed.id),
    code: String(bed.code),
    room: String(bed.room),
    bed_no: String(bed.bed_no),
    ward_id: String(bed.ward_id),
  };
  const wardNameAr = String(bed.ward_name_ar ?? '');
  const wardNameEn = String(bed.ward_name_en ?? '');
  const deptNameAr = String(bed.department_name_ar ?? '');
  const deptNameEn = String(bed.department_name_en ?? '');

  // Find active admission for this bed
  const admissionRows = await db.execute({
    sql: `SELECT a.*, p.id AS patient_id, p.file_number, p.full_name_ar AS patient_name_ar, p.full_name_en AS patient_name_en, p.gender, p.birth_date, p.blood_type, p.allergies_json, p.critical_alerts_json, a.status AS admission_status, a.admitted_at, a.reason, a.attending_doctor_id
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          WHERE a.bed_id = ? AND a.status = 'active' LIMIT 1`,
    args: [String(bed.id)],
  });
  let patient: PublicTrackData['patient'] | null = null;
  let admission: PublicTrackData['admission'] | null = null;
  let vitals: any[] = [];
  let notes: any[] = [];
  let diagnoses: any[] = [];
  let medications: any[] = [];
  let labs: any[] = [];
  let radiology: any[] = [];
  let consultations: any[] = [];
  let procedures: any[] = [];

  if (admissionRows.rows.length > 0) {
    const adj = admissionRows.rows[0] as Record<string, unknown>;
    const patientId = String(adj.patient_id);
    // Get patient details
    const patientRows = await db.execute({
      sql: `SELECT * FROM patients WHERE id = ? LIMIT 1`,
      args: [patientId],
    });
    if (patientRows.rows.length > 0) {
      const pat = patientRows.rows[0] as Record<string, unknown>;
      const allergies = JSON.parse(String((pat as Record<string, unknown>).allergies_json ?? '[]'));
      const criticalAlerts = JSON.parse(String((pat as Record<string, unknown>).critical_alerts_json ?? '[]'));
      patient = {
        id: patientId,
        file_number: String((pat as Record<string, unknown>).file_number ?? ''),
        full_name_ar: String((pat as Record<string, unknown>).full_name_ar ?? ''),
        full_name_en: String((pat as Record<string, unknown>).full_name_en ?? ''),
        gender: String((pat as Record<string, unknown>).gender ?? ''),
        birth_date: String((pat as Record<string, unknown>).birth_date ?? ''),
        blood_type: String((pat as Record<string, unknown>).blood_type ?? ''),
        allergies: allergies.length > 0 ? allergies : [],
        critical_alerts: criticalAlerts.length > 0 ? criticalAlerts : [],
      };
    }
    // Build admission
    const attending = adj.attending_doctor_id ? (await db.execute({ sql: `SELECT full_name_ar FROM users WHERE id = ? LIMIT 1`, args: [adj.attending_doctor_id] }))?.rows[0] as Record<string, unknown> : null;
    admission = {
      id: String(adj.id),
      status: String(adj.admission_status),
      admitted_at: String(adj.admitted_at),
      discharged_at: null,
      reason: String(adj.reason ?? ''),
      attending_doctor: attending ? String(attending.full_name_ar) : null,
    };
    // Load chart data via admissionId
    const adjId = String(adj.id);
    // Vitals
    const vitRows = await db.execute({ sql: `SELECT * FROM vitals WHERE admission_id = ? ORDER BY recorded_at DESC LIMIT 100`, args: [adjId] });
    vitals = vitRows.rows.map((r: Record<string, unknown>) => ({ recorded_at: String(r.recorded_at), temperature: r.temperature, pulse: r.pulse, spo2: r.spo2 }));
    // Notes
    const noteRows = await db.execute({ sql: `SELECT n.*, u.full_name_ar AS author FROM medical_notes n JOIN users u ON u.id = n.author_id WHERE n.admission_id = ? ORDER BY n.recorded_at DESC LIMIT 200`, args: [adjId] });
    notes = noteRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), content: String(r.content), recorded_at: String(r.recorded_at), author: String(r.author) }));
    // Diagnoses
    const diagRows = await db.execute({ sql: `SELECT * FROM diagnoses WHERE admission_id = ? ORDER BY created_at DESC LIMIT 50`, args: [adjId] });
    diagnoses = diagRows.rows.map((r: Record<string, unknown>) => ({ icd10: r.icd10, title_ar: String(r.title_ar), title_en: r.title_en ?? '', status: r.status }));
    // Medications
    const medRows = await db.execute({ sql: `SELECT * FROM medications WHERE admission_id = ? ORDER BY created_at DESC LIMIT 100`, args: [adjId] });
    medications = medRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), name_ar: String(r.name_ar), name_en: r.name_en ?? '', dose: r.dose, route: r.route, frequency: r.frequency, status: r.status }));
    // Labs
    const labRows = await db.execute({ sql: `SELECT * FROM lab_results WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 100`, args: [adjId] });
    labs = labRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), test_name_ar: String(r.test_name_ar), test_name_en: r.test_name_en ?? '', category: r.category ?? '', ordered_by: r.ordered_by ?? '', result: r.result, unit: r.unit, reference_range: r.reference_range, status: r.status }));
    // Radiology
    const radRows = await db.execute({ sql: `SELECT * FROM radiology_reports WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 50`, args: [adjId] });
    radiology = radRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), study_type_ar: String(r.study_type_ar), study_type_en: r.study_type_en ?? '', ordered_by: r.ordered_by ?? '', status: r.status }));
    // Consultations
    const conRows = await db.execute({ sql: `SELECT * FROM consultations WHERE admission_id = ? ORDER BY requested_at DESC LIMIT 50`, args: [adjId] });
    consultations = conRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), requested_by: String(r.requested_by), specialty: r.specialty, reason: r.reason, response: r.response ?? '' }));
    // Procedures
    const procRows = await db.execute({ sql: `SELECT * FROM procedures WHERE admission_id = ? ORDER BY performed_at DESC LIMIT 50`, args: [adjId] });
    procedures = procRows.rows.map((r: Record<string, unknown>) => ({ id: String(r.id), name_ar: String(r.name_ar), name_en: r.name_en ?? '', performed_by: r.performed_by ?? '', performed_at: r.performed_at ?? '', notes: r.notes ?? '' }));
  }

  return {
    bed: bedInfo,
    hospital: { id: hospitalId, name_ar: wardNameAr, name_en: wardNameEn }, // simplified; could fetch actual hospital
    ward: wardNameAr ? { id: bed.ward_id as string, name_ar: wardNameAr, name_en: wardNameEn } : null,
    department: deptNameAr ? { id: bed.department_id as string, name_ar: deptNameAr, name_en: deptNameEn } : null,
    occupied: true,
    patient,
    admission,
    vitals,
    notes,
    diagnoses,
    medications,
    labs,
    radiology,
    consultations,
    procedures,
  };
}

export async function updateWard(id: string, hospitalId: string, input: {
  name_ar?: string;
  name_en?: string | null;
  ward_type?: 'male' | 'female' | 'mixed';
}): Promise<Ward | null> {
  const exists = await getWardById(id, hospitalId);
  if (!exists) return null;
  await db.execute({
    sql: `UPDATE wards SET name_ar = COALESCE(?, name_ar), name_en = COALESCE(?, name_en), ward_type = COALESCE(?, ward_type) WHERE id = ?`,
    args: [input.name_ar ?? null, input.name_en ?? null, input.ward_type ?? null, id],
  });
  return (await getWardById(id, hospitalId)) ?? null;
}

export async function deleteWard(id: string, hospitalId: string): Promise<boolean> {
  const wards = await getWardById(id, hospitalId);
  if (!wards) return false;
  const beds = await db.execute({ sql: `SELECT COUNT(*) AS n FROM beds WHERE ward_id = ?`, args: [id] });
  if (Number((beds.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف ردهة بها أسرّة — احذف الأسرّة أولاً أو انقلها');
  }
  const adm = await db.execute({ sql: `SELECT COUNT(*) AS n FROM admissions WHERE ward_id = ?`, args: [id] });
  if (Number((adm.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف ردهة لها سجل تنويم');
  }
  await db.execute({ sql: `DELETE FROM wards WHERE id = ?`, args: [id] });
  return true;
}

async function getWardById(id: string, hospitalId: string): Promise<Ward | null> {
  const rows = await db.execute({
    sql: `SELECT w.*, d.name_ar AS department_name_ar, d.name_en AS department_name_en
          FROM wards w LEFT JOIN departments d ON d.id = w.department_id
          WHERE w.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    department_id: String(r.department_id),
    department_name_ar: String(r.department_name_ar ?? ''),
    department_name_en: String(r.department_name_en ?? ''),
    name_ar: String(r.name_ar),
    name_en: String(r.name_en),
    type: String(r.ward_type) as Ward['type'],
    beds: [],
  };
}

export async function createBed(input: { ward_id: string; room: string; bed_no: string }, hospitalId: string): Promise<Bed> {
  const rows = await db.execute({ sql: `SELECT id FROM wards w JOIN departments d ON d.id = w.department_id WHERE w.id = ? AND d.hospital_id = ? LIMIT 1`, args: [input.ward_id, hospitalId] });
  if (rows.rows.length === 0) throw new HttpConflict('الردهة غير موجودة');
  const id = uuid('bed');
  const code = generateBedCode();
  await db.execute({
    sql: `INSERT INTO beds (id, ward_id, room, bed_no, status, code) VALUES (?, ?, ?, ?, 'free', ?)`,
    args: [id, input.ward_id, input.room, input.bed_no, code],
  });
  return { id, ward_id: input.ward_id, room: input.room, bed_no: input.bed_no, status: 'free', code };
}

export async function updateBed(id: string, hospitalId: string, input: { room?: string; bed_no?: string }): Promise<Bed | null> {
  const rows = await getBedById(id, hospitalId);
  if (!rows) return null;
  await db.execute({
    sql: `UPDATE beds SET room = COALESCE(?, room), bed_no = COALESCE(?, bed_no) WHERE id = ?`,
    args: [input.room ?? null, input.bed_no ?? null, id],
  });
  return (await getBedById(id, hospitalId)) ?? null;
}

export async function deleteBed(id: string, hospitalId: string): Promise<boolean> {
  const rows = await db.execute({
    sql: `SELECT b.status FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return false;
  if (String((rows.rows[0] as Record<string, unknown>).status) === 'occupied') {
    throw new HttpConflict('لا يمكن حذف سرير مشغول');
  }
  await db.execute({ sql: `DELETE FROM beds WHERE id = ?`, args: [id] });
  return true;
}

async function getBedById(id: string, hospitalId: string): Promise<Bed | null> {
  const rows = await db.execute({
    sql: `SELECT b.* FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { id: String(r.id), ward_id: String(r.ward_id), room: String(r.room), bed_no: String(r.bed_no), status: String(r.status) === 'occupied' ? 'occupied' : 'free', code: String(r.code) };
}

export async function listUnassigned(hospitalId: string): Promise<UnassignedPatient[]> {
  const rows = await db.execute({
    sql: `SELECT a.id AS admission_id, a.patient_id, a.admitted_at, p.full_name_ar AS patient_name_ar
          FROM admissions a JOIN patients p ON p.id = a.patient_id
          WHERE a.status = 'active' AND a.bed_id IS NULL AND p.hospital_id = ? AND p.archived_at IS NULL
          ORDER BY a.admitted_at ASC`,
    args: [hospitalId],
  });
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      admission_id: String(row.admission_id),
      patient_id: String(row.patient_id),
      patient_name_ar: String(row.patient_name_ar),
      admitted_at: String(row.admitted_at),
    };
  });
}

export async function assignBed(bedId: string, admissionId: string, hospitalId: string): Promise<boolean> {
  const bed = await getBedById(bedId, hospitalId);
  if (!bed || bed.status === 'occupied') throw new HttpConflict('السرير غير موجود أو مشغول');
  const adm = await db.execute({
    sql: `SELECT a.status, a.patient_id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? AND p.hospital_id = ? LIMIT 1`,
    args: [admissionId, hospitalId],
  });
  if (adm.rows.length === 0) throw new HttpConflict('التنويم غير موجود');
  const a = adm.rows[0] as Record<string, unknown>;
  if (String(a.status) !== 'active') throw new HttpConflict('التنويم غير نشط');
  await db.execute({
    sql: `UPDATE admissions SET bed_id = ?, ward_id = ?, room = ?, bed_no = ? WHERE id = ?`,
    args: [bedId, bed.ward_id, bed.room, bed.bed_no, admissionId],
  });
  await db.execute({ sql: `UPDATE beds SET status = 'occupied' WHERE id = ?`, args: [bedId] });
  return true;
}

export async function freeBed(bedId: string, hospitalId: string): Promise<boolean> {
  const bed = await getBedById(bedId, hospitalId);
  if (!bed) throw new HttpConflict('السرير غير موجود');
  const adm = await db.execute({
    sql: `SELECT id FROM admissions WHERE bed_id = ? AND status = 'active' LIMIT 1`,
    args: [bedId],
  });
  if (adm.rows.length === 0) {
    if (bed.status === 'occupied') await db.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [bedId] });
    return true;
  }
  const admissionId = String((adm.rows[0] as Record<string, unknown>).id);
  await db.execute({
    sql: `UPDATE admissions SET bed_id = NULL, ward_id = NULL, room = NULL, bed_no = NULL WHERE id = ?`,
    args: [admissionId],
  });
  await db.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [bedId] });
  return true;
}

export async function occupiedByPatient(bedId: string, hospitalId: string): Promise<{ admission_id: string; patient_id: string; patient_name_ar: string } | null> {
  const rows = await db.execute({
    sql: `SELECT a.id AS admission_id, a.patient_id, p.full_name_ar AS patient_name_ar
          FROM admissions a JOIN patients p ON p.id = a.patient_id
          JOIN beds b ON b.id = a.bed_id
          JOIN wards w ON w.id = b.ward_id
          JOIN departments d ON d.id = w.department_id
          WHERE a.bed_id = ? AND a.status = 'active' AND d.hospital_id = ? LIMIT 1`,
    args: [bedId, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { admission_id: String(r.admission_id), patient_id: String(r.patient_id), patient_name_ar: String(r.patient_name_ar) };
}