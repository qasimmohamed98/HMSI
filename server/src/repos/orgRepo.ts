import { randomBytes } from 'node:crypto';
import type { Department, Ward, Bed, UnassignedPatient } from '@hmsi/shared';
import { db, uuid, withTx } from '../../db/index.js';
import { moveToTrash, type TrashActor } from '../lib/trash.js';
import { HttpConflict } from '../lib/errors.js';

function mapDepartment(r: Record<string, unknown>): Department {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    name_ar: String(r.name_ar),
    name_en: String(r.name_en),
    ward_count: r.ward_count === undefined ? undefined : Number(r.ward_count),
  };
}

/** كود QR ثابت لكل سرير — 16 حرفاً عشوائياً (غير قابل للتخمين) */
export function generateBedCode(): string {
  return 'b' + randomBytes(12).toString('base64url').replace(/[-_]/g, '').slice(0, 15).toLowerCase();
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
    args: [id, hospitalId, input.name_ar, input.name_en || input.name_ar],
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

export async function deleteDepartment(id: string, hospitalId: string, actor: TrashActor): Promise<boolean> {
  if (!(await getDepartment(id, hospitalId))) return false;
  const wards = await db.execute({ sql: `SELECT COUNT(*) AS n FROM wards WHERE department_id = ?`, args: [id] });
  if (Number((wards.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف قسم يحتوي على ردهات — احذف الردهات أولاً');
  }
  const adm = await db.execute({ sql: `SELECT COUNT(*) AS n FROM admissions WHERE department_id = ?`, args: [id] });
  if (Number((adm.rows[0] as Record<string, unknown>).n) > 0) {
    throw new HttpConflict('لا يمكن حذف قسم له سجل تنويم — أولِه لتصفير البيانات');
  }
  const dep = await getDepartment(id, hospitalId);
  await moveToTrash({ table: 'departments', id, hospitalId, kind: 'department', label: dep?.name_ar ?? id, actor });
  return true;
}

export async function createWard(input: { department_id: string; name_ar: string; name_en?: string | null; ward_type: 'male' | 'female' | 'mixed' }, hospitalId: string): Promise<Ward | null> {
  const dept = await getDepartment(input.department_id, hospitalId);
  if (!dept) throw new HttpConflict('القسم غير موجود');
  const id = uuid('wr');
  await db.execute({
    sql: `INSERT INTO wards (id, department_id, name_ar, name_en, ward_type) VALUES (?, ?, ?, ?, ?)`,
    args: [id, input.department_id, input.name_ar, input.name_en || input.name_ar, input.ward_type],
  });
  return (await getWardById(id, hospitalId)) ?? null;
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

export async function deleteWard(id: string, hospitalId: string, actor: TrashActor): Promise<boolean> {
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
  const w = await db.execute({ sql: `SELECT name_ar FROM wards WHERE id = ?`, args: [id] });
  await moveToTrash({ table: 'wards', id, hospitalId, kind: 'ward', label: String((w.rows[0] as Record<string, unknown> | undefined)?.name_ar ?? id), actor });
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

export async function deleteBed(id: string, hospitalId: string, actor: TrashActor): Promise<boolean> {
  const rows = await db.execute({
    sql: `SELECT b.status, b.room, b.bed_no, w.name_ar AS ward_name FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return false;
  if (String((rows.rows[0] as Record<string, unknown>).status) === 'occupied') {
    throw new HttpConflict('لا يمكن حذف سرير مشغول');
  }
  const bed = rows.rows[0] as Record<string, unknown>;
  await moveToTrash({ table: 'beds', id, hospitalId, kind: 'bed', label: `${String(bed.ward_name)} · ${String(bed.room)}/${String(bed.bed_no)}`, actor });
  return true;
}

async function getBedById(id: string, hospitalId: string): Promise<Bed | null> {
  const rows = await db.execute({
    sql: `SELECT b.* FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE b.id = ? AND d.hospital_id = ? LIMIT 1`,
    args: [id, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { id: String(r.id), ward_id: String(r.ward_id), room: String(r.room), bed_no: String(r.bed_no), status: String(r.status) === 'occupied' ? 'occupied' : 'free', code: String(r.code ?? '') };
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
  if (!bed) throw new HttpConflict('السرير غير موجود');
  return withTx(async (tx) => {
    const adm = await tx.execute({
      sql: `SELECT a.status, a.bed_id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? AND p.hospital_id = ? LIMIT 1`,
      args: [admissionId, hospitalId],
    });
    if (adm.rows.length === 0) throw new HttpConflict('التنويم غير موجود');
    const a = adm.rows[0] as Record<string, unknown>;
    if (String(a.status) !== 'active') throw new HttpConflict('التنويم غير نشط');
    if (a.bed_id) throw new HttpConflict('المريض لديه سرير بالفعل — استخدم النقل');
    const res = await tx.execute({ sql: `UPDATE beds SET status = 'occupied' WHERE id = ? AND status = 'free'`, args: [bedId] });
    if (res.rowsAffected !== 1) throw new HttpConflict('السرير مشغول');
    await tx.execute({
      sql: `UPDATE admissions SET bed_id = ?, ward_id = ?, room = ?, bed_no = ? WHERE id = ?`,
      args: [bedId, bed.ward_id, bed.room, bed.bed_no, admissionId],
    });
    return true;
  });
}

/** تحرير السرير: المريض يبقى منوّماً لكن بلا سرير (يظهر في قائمة «بلا سرير») */
export async function freeBed(bedId: string, hospitalId: string): Promise<boolean> {
  const bed = await getBedById(bedId, hospitalId);
  if (!bed) throw new HttpConflict('السرير غير موجود');
  return withTx(async (tx) => {
    await tx.execute({
      sql: `UPDATE admissions SET bed_id = NULL, ward_id = NULL, room = NULL, bed_no = NULL WHERE bed_id = ? AND status = 'active'`,
      args: [bedId],
    });
    await tx.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [bedId] });
    return true;
  });
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