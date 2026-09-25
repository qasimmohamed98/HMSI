import type { Transaction } from '@libsql/client';
import { db, uuid, withTx } from '../../db/index.js';
import { HttpError } from './errors.js';

/**
 * سلة المحذوفات — لا يُحذف شيء نهائياً من النظام.
 * الحذف = نقل الصف كاملاً (JSON) إلى جدول trash ثم إزالته من جدوله، داخل transaction واحدة.
 * الاستعادة (مدير المستشفى فقط) = إعادة إدخال الصف كما كان.
 */

/** الجداول المسموح نقلها إلى السلة واستعادتها — لا أسماء جداول من مدخلات المستخدم */
export const TRASHABLE_TABLES = [
  'medical_notes',
  'diagnoses',
  'medications',
  'medication_administrations',
  'lab_results',
  'radiology_reports',
  'consultations',
  'procedures',
  'vitals',
  'fluid_entries',
  'attachments',
  'departments',
  'wards',
  'beds',
] as const;
export type TrashableTable = (typeof TRASHABLE_TABLES)[number];

type Row = Record<string, unknown>;

const PARENTS: Partial<Record<TrashableTable, { table: string; column: string; message: string }>> = {
  beds: { table: 'wards', column: 'ward_id', message: 'الردهة التي كان فيها السرير محذوفة — استعد الردهة أولاً' },
  wards: { table: 'departments', column: 'department_id', message: 'القسم الذي كانت فيه الردهة محذوف — استعد القسم أولاً' },
  medication_administrations: { table: 'medications', column: 'medication_id', message: 'الدواء المرتبط محذوف — استعد الدواء أولاً' },
};

export interface TrashActor {
  id: string;
  name: string;
}

export interface TrashInput {
  table: TrashableTable;
  id: string;
  hospitalId: string;
  kind: string;
  label: string;
  actor: TrashActor;
  patientId?: string | null;
  admissionId?: string | null;
}

/** ينقل الصف إلى السلة ويحذفه من جدوله. يعيد false إن لم يوجد الصف. */
export async function moveToTrash(input: TrashInput, tx?: Transaction): Promise<boolean> {
  const run = async (t: Transaction) => {
    const rows = await t.execute({ sql: `SELECT * FROM ${input.table} WHERE id = ? LIMIT 1`, args: [input.id] });
    if (rows.rows.length === 0) return false;
    const data = { ...(rows.rows[0] as Row) };
    await t.execute({
      sql: `INSERT INTO trash (id, hospital_id, table_name, record_id, mode, kind, label, patient_id, admission_id, data_json, deleted_by, deleted_by_id, deleted_at)
            VALUES (?, ?, ?, ?, 'delete', ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuid('tr'),
        input.hospitalId,
        input.table,
        input.id,
        input.kind,
        input.label.slice(0, 200),
        input.patientId ?? null,
        input.admissionId ?? (typeof data.admission_id === 'string' ? data.admission_id : null),
        JSON.stringify(data),
        input.actor.name,
        input.actor.id,
        new Date().toISOString(),
      ],
    });
    await t.execute({ sql: `DELETE FROM ${input.table} WHERE id = ?`, args: [input.id] });
    return true;
  };
  return tx ? run(tx) : withTx(run);
}

/** أرشفة المريض تُسجَّل في السلة أيضاً لتظهر مع المحذوفات وتُستعاد منها */
export async function recordArchive(
  input: { patientId: string; hospitalId: string; label: string; previousStatus: string; actor: TrashActor },
  exec: Pick<Transaction, 'execute'> = db,
): Promise<void> {
  await exec.execute({
    sql: `INSERT INTO trash (id, hospital_id, table_name, record_id, mode, kind, label, patient_id, data_json, deleted_by, deleted_by_id, deleted_at)
          VALUES (?, ?, 'patients', ?, 'archive', 'patient', ?, ?, ?, ?, ?, ?)`,
    args: [
      uuid('tr'),
      input.hospitalId,
      input.patientId,
      input.label.slice(0, 200),
      input.patientId,
      JSON.stringify({ status: input.previousStatus }),
      input.actor.name,
      input.actor.id,
      new Date().toISOString(),
    ],
  });
}

export interface TrashEntry {
  id: string;
  table_name: string;
  record_id: string;
  mode: 'delete' | 'archive';
  kind: string;
  label: string;
  patient_id: string | null;
  admission_id: string | null;
  deleted_by: string;
  deleted_by_id: string | null;
  deleted_at: string;
  restore_requested_by: string | null;
  restore_requested_at: string | null;
  restore_request_note: string | null;
  restored_by: string | null;
  restored_at: string | null;
  patient_name_ar: string | null;
  patient_name_en: string | null;
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function mapEntry(r: Row): TrashEntry {
  return {
    id: String(r.id),
    table_name: String(r.table_name),
    record_id: String(r.record_id),
    mode: String(r.mode) === 'archive' ? 'archive' : 'delete',
    kind: String(r.kind),
    label: String(r.label),
    patient_id: str(r.patient_id),
    admission_id: str(r.admission_id),
    deleted_by: String(r.deleted_by),
    deleted_by_id: str(r.deleted_by_id),
    deleted_at: String(r.deleted_at),
    restore_requested_by: str(r.restore_requested_by),
    restore_requested_at: str(r.restore_requested_at),
    restore_request_note: str(r.restore_request_note),
    restored_by: str(r.restored_by),
    restored_at: str(r.restored_at),
    patient_name_ar: str(r.patient_name_ar),
    patient_name_en: str(r.patient_name_en),
  };
}

export async function listTrash(hospitalId: string, opts: { restored?: boolean; deletedById?: string } = {}): Promise<TrashEntry[]> {
  const where = ['hospital_id = ?', opts.restored ? 'restored_at IS NOT NULL' : 'restored_at IS NULL'];
  const args: string[] = [hospitalId];
  if (opts.deletedById) {
    where.push('deleted_by_id = ?');
    args.push(opts.deletedById);
  }
  const rows = await db.execute({
    sql: `SELECT t.id, t.table_name, t.record_id, t.mode, t.kind, t.label, COALESCE(t.patient_id, a.patient_id) AS patient_id, t.admission_id, t.deleted_by, t.deleted_by_id, t.deleted_at,
                 t.restore_requested_by, t.restore_requested_at, t.restore_request_note, t.restored_by, t.restored_at,
                 p.full_name_ar AS patient_name_ar, p.full_name_en AS patient_name_en
          FROM trash t
          LEFT JOIN admissions a ON a.id = t.admission_id
          LEFT JOIN patients p ON p.id = COALESCE(t.patient_id, a.patient_id)
          WHERE ${where.map((w) => `t.${w}`).join(' AND ')}
          ORDER BY (t.restore_requested_at IS NULL), t.deleted_at DESC LIMIT 300`,
    args,
  });
  return rows.rows.map((r) => mapEntry(r as Row));
}

async function loadEntry(id: string, hospitalId: string): Promise<Row> {
  const rows = await db.execute({ sql: `SELECT * FROM trash WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  if (rows.rows.length === 0) throw new HttpError('العنصر غير موجود في المحذوفات', 404);
  const r = { ...(rows.rows[0] as Row) };
  if (r.restored_at) throw new HttpError('تمت استعادة هذا العنصر مسبقاً', 409);
  return r;
}

/** طلب استعادة من أي موظف (يراجعه مدير المستشفى) */
export async function requestRestore(id: string, hospitalId: string, actor: TrashActor, note: string | null): Promise<void> {
  await loadEntry(id, hospitalId);
  await db.execute({
    sql: `UPDATE trash SET restore_requested_by = ?, restore_requested_by_id = ?, restore_requested_at = ?, restore_request_note = ? WHERE id = ?`,
    args: [actor.name, actor.id, new Date().toISOString(), note, id],
  });
}

/** استعادة العنصر (مدير المستشفى فقط) */
export async function restoreFromTrash(id: string, hospitalId: string, actor: TrashActor): Promise<TrashEntry> {
  const entry = await loadEntry(id, hospitalId);
  const table = String(entry.table_name);
  await withTx(async (tx) => {
    if (String(entry.mode) === 'archive') {
      const prev = JSON.parse(String(entry.data_json)) as { status?: string };
      const res = await tx.execute({
        sql: `UPDATE patients SET archived_at = NULL, status = ? WHERE id = ? AND hospital_id = ? AND archived_at IS NOT NULL`,
        args: [prev.status ?? 'discharged', String(entry.record_id), hospitalId],
      });
      if (res.rowsAffected === 0) throw new HttpError('المريض غير مؤرشف أو غير موجود', 409);
    } else {
      if (!(TRASHABLE_TABLES as readonly string[]).includes(table)) throw new HttpError('نوع غير قابل للاستعادة', 400);
      const data = JSON.parse(String(entry.data_json)) as Row;
      // القاعدة لا تفرض المفاتيح الأجنبية، فنتحقق يدوياً أن الأصل ما زال موجوداً
      const parent = PARENTS[table as TrashableTable];
      if (parent) {
        const pid = data[parent.column];
        const found = await tx.execute({ sql: `SELECT 1 FROM ${parent.table} WHERE id = ? LIMIT 1`, args: [String(pid ?? '')] });
        if (found.rows.length === 0) throw new HttpError(parent.message, 409);
      }
      const cols = Object.keys(data);
      // أعمدة الجدول الحالية فقط (قد تكون migration لاحقة أضافت أو أزالت أعمدة)
      const info = await tx.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
      const existing = new Set(info.rows.map((r) => String((r as Row).name)));
      const use = cols.filter((c) => existing.has(c));
      try {
        await tx.execute({
          sql: `INSERT INTO ${table} (${use.join(', ')}) VALUES (${use.map(() => '?').join(', ')})`,
          args: use.map((c) => data[c] as string | number | null),
        });
      } catch (e) {
        const msg = String((e as Error)?.message ?? '');
        if (/UNIQUE|PRIMARY/i.test(msg)) throw new HttpError('يوجد سجل بنفس المعرّف أو الرمز حالياً — لا يمكن الاستعادة', 409);
        if (/FOREIGN KEY/i.test(msg)) throw new HttpError('العنصر مرتبط بسجل لم يعد موجوداً (استعد السجل الأصلي أولاً)', 409);
        throw e;
      }
    }
    await tx.execute({ sql: `UPDATE trash SET restored_by = ?, restored_at = ? WHERE id = ?`, args: [actor.name, new Date().toISOString(), id] });
  });
  return (await listTrash(hospitalId, { restored: true })).find((e) => e.id === id)!;
}

/** وصف مختصر للسجل المحذوف ليُعرف في السلة */
export function recordLabel(row: Row): string {
  for (const k of ['name_ar', 'title_ar', 'test_name_ar', 'study_type_ar', 'file_name', 'specialty']) {
    if (row[k]) return String(row[k]);
  }
  if (row.content) return String(row.content).slice(0, 80);
  if (row.recorded_at) return String(row.recorded_at).slice(0, 16).replace('T', ' ');
  return String(row.id ?? '');
}
