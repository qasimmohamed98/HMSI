import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  CreateNoteSchema,
  CreateDiagnosisSchema,
  CreateMedicationSchema,
  AddLabResultSchema,
  RadiologyReportSchema,
  ConsultationSchema,
  CreateProcedureSchema,
  UpdateLabResultSchema,
  UpdateRadiologySchema,
  UpdateMedicationSchema,
  UpdateNoteSchema,
  UpdateDiagnosisSchema,
  UpdateProcedureSchema,
  UpdateConsultationSchema,
  CreateFluidSchema,
  AdministerMedicationSchema,
} from '@hmsi/shared/validate';
import { findAllergyConflicts, type AllergyConflict, type AdmissionSummary, type Permission } from '@hmsi/shared';
import { getSession, requireAuth, requirePermission, sessionHas, type SessionUser } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { clientIp } from '../config.js';
import { db, uuid } from '../../db/index.js';
import { resolveRecordedAt, existingClientRecord } from '../lib/offline.js';
import { moveToTrash, recordLabel, type TrashableTable } from '../lib/trash.js';
import { notifyAdmission } from '../lib/notify.js';

export const recordRoutes = new Hono();

type Row = Record<string, unknown>;

/**
 * يتحقق أن التنويم موجود وتابع لمستشفى المستخدم (عزل المستشفيات)،
 * وأن admission_id في الجسم (إن وُجد) يطابق المسار.
 */
async function loadAdmission(c: Context, bodyAdmissionId?: string): Promise<AdmissionSummary> {
  const admissionId = c.req.param('admissionId') ?? '';
  if (bodyAdmissionId !== undefined && bodyAdmissionId !== admissionId) {
    throw new HttpError('معرّف التنويم غير مطابق', 400);
  }
  const scope = await getAdmissionScope(admissionId, getSession(c)!.user.hospital_id);
  if (!scope) throw new HttpError('التنويم غير موجود', 404);
  return scope.admission;
}

/** لا تُضاف أوامر علاجية جديدة لتنويم منتهٍ (الملاحظات والنتائج المتأخرة مسموحة) */
function requireActive(a: AdmissionSummary): void {
  if (a.status !== 'active') throw new HttpError('التنويم منتهٍ — لا يمكن إضافة أوامر جديدة', 409);
}

async function findRecord(table: string, id: string, admissionId: string): Promise<Row> {
  const rows = await db.execute({ sql: `SELECT * FROM ${table} WHERE id = ? AND admission_id = ? LIMIT 1`, args: [id, admissionId] });
  if (rows.rows.length === 0) throw new HttpError('السجل غير موجود', 404);
  return { ...(rows.rows[0] as Row) };
}

async function fetchRow(table: string, id: string): Promise<Row> {
  const rows = await db.execute({ sql: `SELECT * FROM ${table} WHERE id = ? LIMIT 1`, args: [id] });
  return { ...(rows.rows[0] as Row) };
}

function track(c: Context, s: SessionUser, admissionId: string, type: string, titleAr: string, titleEn: string, action: string, resourceType: string, resourceId: string) {
  return Promise.all([
    addTimeline({ admissionId, actor: s.user.full_name_ar, actorId: s.user.id, type, titleAr, titleEn }),
    writeAudit({ actorId: s.user.id, action, resourceType, resourceId, ip: clientIp(c) }),
  ]);
}

/** يبني UPDATE من الحقول المعرّفة فقط (undefined = لا تغيير، null = مسح) */
function buildSets(input: Record<string, unknown>, cols: readonly string[]): { sets: string[]; args: (string | null)[] } {
  const sets: string[] = [];
  const args: (string | null)[] = [];
  for (const col of cols) {
    const v = input[col];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v === null ? null : String(v));
    }
  }
  return { sets, args };
}

const notePermission = (kind: 'doctor' | 'nursing'): Permission => (kind === 'doctor' ? 'notes.write.doctor' : 'notes.write.nursing');

// ---------------------------------------------------------------- الملاحظات

recordRoutes.post('/:admissionId/notes', requireAuth(), requirePermission('notes.write.doctor', 'notes.write.nursing'), async (c) => {
  const parsed = await parseBody(c, CreateNoteSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateNoteSchema)['_output'];
  const s = getSession(c)!;
  // الطبيب يكتب ملاحظة طبية، والممرض ملاحظة تمريض
  if (!sessionHas(c, notePermission(input.kind))) return c.json({ message: 'لا تملك صلاحية كتابة هذا النوع من الملاحظات' }, 403);
  await loadAdmission(c, input.admission_id);

  const id = uuid('nt');
  const at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO medical_notes (id, admission_id, kind, author_id, recorded_at, content, corrected_by) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    args: [id, input.admission_id, input.kind, s.user.id, at, input.content],
  });
  await track(c, s, input.admission_id, 'note', input.kind === 'doctor' ? 'ملاحظة طبية' : 'ملاحظة تمريض', input.kind === 'doctor' ? 'Doctor note' : 'Nursing note', 'note_created', 'medical_note', id);
  return c.json({ id, admission_id: input.admission_id, kind: input.kind, author: s.user.full_name_ar, author_id: s.user.id, recorded_at: at, content: input.content, corrected_by: null }, 201);
});

/** تعديل/حذف الملاحظة: لكاتبها فقط، وبشرط أنه ما زال يملك صلاحية نوعها */
async function ownNote(c: Context): Promise<{ admissionId: string; id: string }> {
  const a = await loadAdmission(c);
  const id = c.req.param('id') ?? '';
  const note = await findRecord('medical_notes', id, a.id);
  const s = getSession(c)!;
  if (String(note.author_id) !== s.user.id || !sessionHas(c, notePermission(note.kind === 'doctor' ? 'doctor' : 'nursing'))) {
    throw new HttpError('يمكن لكاتب الملاحظة فقط تعديلها أو حذفها', 403);
  }
  return { admissionId: a.id, id };
}

recordRoutes.patch('/:admissionId/notes/:id', requireAuth(), async (c) => {
  const parsed = await parseBody(c, UpdateNoteSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateNoteSchema)['_output'];
  const s = getSession(c)!;
  const { admissionId, id } = await ownNote(c);
  await db.execute({
    sql: `UPDATE medical_notes SET content = ?, corrected_by = ?, recorded_at = ? WHERE id = ?`,
    args: [input.content, s.user.id, new Date().toISOString(), id],
  });
  await track(c, s, admissionId, 'note', 'تصحيح ملاحظة', 'Note corrected', 'note_updated', 'medical_note', id);
  const updated = await db.execute({
    sql: `SELECT n.*, u.full_name_ar AS author, cu.full_name_ar AS corrected_by
          FROM medical_notes n JOIN users u ON u.id = n.author_id LEFT JOIN users cu ON cu.id = n.corrected_by WHERE n.id = ? LIMIT 1`,
    args: [id],
  });
  return c.json({ ...(updated.rows[0] as Row) }, 200);
});

recordRoutes.delete('/:admissionId/notes/:id', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const { admissionId, id } = await ownNote(c);
  const note = await findRecord('medical_notes', id, admissionId);
  await moveToTrash({ table: 'medical_notes', id, hospitalId: s.user.hospital_id, kind: 'medical_note', label: recordLabel(note), actor: { id: s.user.id, name: s.user.full_name_ar }, admissionId });
  await track(c, s, admissionId, 'note', 'حذف ملاحظة', 'Note deleted', 'note_deleted', 'medical_note', id);
  return c.body(null, 204);
});

// ---------------------------------------------------------------- التشخيص

recordRoutes.post('/:admissionId/diagnoses', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, CreateDiagnosisSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateDiagnosisSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  const id = uuid('dg');
  const at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO diagnoses (id, admission_id, icd10, title_ar, title_en, status, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.admission_id, input.icd10 ?? null, input.title_ar, input.title_en ?? null, input.status, s.user.full_name_ar, at],
  });
  await track(c, s, input.admission_id, 'diagnosis', `إضافة تشخيص: ${input.title_ar}`, `Diagnosis added: ${input.title_en ?? input.title_ar}`, 'diagnosis_added', 'diagnosis', id);
  return c.json(await fetchRow('diagnoses', id), 201);
});

recordRoutes.patch('/:admissionId/diagnoses/:id', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, UpdateDiagnosisSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateDiagnosisSchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  await findRecord('diagnoses', id, a.id);
  const { sets, args } = buildSets(input, ['icd10', 'title_ar', 'title_en', 'status']);
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  await db.execute({ sql: `UPDATE diagnoses SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  await track(c, s, a.id, 'diagnosis', 'تعديل تشخيص', 'Diagnosis updated', 'diagnosis_updated', 'diagnosis', id);
  return c.json(await fetchRow('diagnoses', id), 200);
});

// ---------------------------------------------------------------- الأدوية

/** تعارض الدواء مع حساسيات المريض المسجلة */
async function allergyConflicts(admissionId: string, names: (string | null | undefined)[]): Promise<AllergyConflict[]> {
  const r = await db.execute({
    sql: `SELECT p.allergies_json FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?`,
    args: [admissionId],
  });
  let allergies: string[] = [];
  try {
    allergies = JSON.parse(String(r.rows[0]?.allergies_json ?? '[]'));
  } catch {
    /* بيانات قديمة غير صالحة */
  }
  return findAllergyConflicts(names, Array.isArray(allergies) ? allergies.map(String) : []);
}

/**
 * لا يُوصف دواء يتعارض مع حساسية مسجلة إلا بسبب مكتوب (409 وإلا).
 * يعيد JSON التجاوز للحفظ مع الدواء، أو null إن لم يوجد تعارض.
 */
async function allergyGate(c: Context, s: SessionUser, admissionId: string, names: (string | null | undefined)[], reason: string | null | undefined, medId: string): Promise<{ override: string | null } | Response> {
  const conflicts = await allergyConflicts(admissionId, names);
  if (conflicts.length === 0) return { override: null };
  if (!reason) {
    return c.json({ message: 'الدواء يتعارض مع حساسية مسجلة للمريض — راجع الوصف أو اذكر سبب التجاوز', code: 'allergy_conflict', conflicts }, 409);
  }
  await writeAudit({ actorId: s.user.id, action: 'allergy_override', resourceType: 'medication', resourceId: medId, ip: clientIp(c), meta: { reason, conflicts, drug: names.filter(Boolean) } });
  return { override: JSON.stringify({ reason, conflicts, by: s.user.full_name_ar, by_en: s.user.full_name_en ?? null, at: new Date().toISOString() }) };
}

recordRoutes.post('/:admissionId/medications', requireAuth(), requirePermission('medications.manage'), async (c) => {
  const parsed = await parseBody(c, CreateMedicationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateMedicationSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  const id = uuid('md');
  const gate = await allergyGate(c, s, input.admission_id, [input.name_ar, input.name_en], input.allergy_override_reason, id);
  if (gate instanceof Response) return gate;
  await db.execute({
    sql: `INSERT INTO medications (id, admission_id, name_ar, name_en, dose, route, frequency, start_at, end_at, status, prescribed_by, created_at, allergy_override_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    args: [id, input.admission_id, input.name_ar, input.name_en ?? null, input.dose, input.route, input.frequency, input.start_at, input.end_at ?? null, s.user.full_name_ar, new Date().toISOString(), gate.override],
  });
  await track(c, s, input.admission_id, 'medication', `وصف دواء: ${input.name_ar}`, `Medication: ${input.name_en ?? input.name_ar}`, 'medication_prescribed', 'medication', id);
  await notifyAdmission(input.admission_id, {
    roles: ['pharmacist'],
    toNurse: true,
    kind: 'medication_prescribed',
    severity: gate.override ? 'warning' : 'info',
    titleAr: `دواء جديد للصرف: ${input.name_ar}`,
    titleEn: `New medication to dispense: ${input.name_en ?? input.name_ar}`,
    bodyAr: gate.override ? 'وُصف رغم تحذير حساسية' : undefined,
    bodyEn: gate.override ? 'Prescribed despite an allergy warning' : undefined,
    createdById: s.user.id,
  });
  return c.json(await fetchRow('medications', id), 201);
});

recordRoutes.patch('/:admissionId/medications/:id', requireAuth(), requirePermission('medications.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateMedicationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as Record<string, unknown>;
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  const current = await findRecord('medications', id, a.id);
  const { sets, args } = buildSets(input, ['name_ar', 'name_en', 'dose', 'route', 'frequency', 'start_at', 'status', 'end_at']);
  // تغيير اسم الدواء يعيد فحص الحساسية
  if (input.name_ar !== undefined || input.name_en !== undefined) {
    const names = [(input.name_ar ?? current.name_ar) as string, (input.name_en !== undefined ? input.name_en : current.name_en) as string | null];
    const gate = await allergyGate(c, s, a.id, names, input.allergy_override_reason as string | null | undefined, id);
    if (gate instanceof Response) return gate;
    sets.push('allergy_override_json = ?');
    args.push(gate.override);
  }
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  await db.execute({ sql: `UPDATE medications SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  await track(c, s, a.id, 'medication', 'تحديث دواء', 'Medication updated', 'medication_updated', 'medication', id);
  return c.json(await fetchRow('medications', id), 200);
});

/** صرف الدواء من الصيدلية (مرة واحدة لكل وصفة) */
recordRoutes.post('/:admissionId/medications/:id/dispense', requireAuth(), requirePermission('medications.dispense'), async (c) => {
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  requireActive(a);
  const id = c.req.param('id');
  const med = await findRecord('medications', id, a.id);
  if (String(med.status) !== 'active') throw new HttpError('لا يمكن صرف دواء موقوف أو مكتمل', 409);
  if (med.dispensed_at) throw new HttpError('تم صرف هذا الدواء مسبقاً', 409);
  await db.execute({
    sql: `UPDATE medications SET dispensed_by = ?, dispensed_at = ? WHERE id = ? AND dispensed_at IS NULL`,
    args: [s.user.full_name_ar, new Date().toISOString(), id],
  });
  await track(c, s, a.id, 'medication', `صرف دواء: ${String(med.name_ar)}`, `Dispensed: ${String(med.name_en ?? med.name_ar)}`, 'medication_dispensed', 'medication', id);
  return c.json(await fetchRow('medications', id), 200);
});

// ---------------------------------------------------------------- سجل إعطاء الأدوية (MAR)

const ADMIN_TITLES = {
  given: ['إعطاء جرعة', 'Dose given'],
  held: ['تأجيل جرعة', 'Dose held'],
  refused: ['رفض المريض الجرعة', 'Dose refused'],
} as const;

recordRoutes.post('/:admissionId/medications/:id/administrations', requireAuth(), requirePermission('medications.administer'), async (c) => {
  const parsed = await parseBody(c, AdministerMedicationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AdministerMedicationSchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = input.client_id ?? uuid('ma');
  if (input.client_id && (await existingClientRecord('medication_administrations', id, a.id))) {
    return c.json(await fetchRow('medication_administrations', id), 200);
  }
  requireActive(a);
  const medId = c.req.param('id');
  const med = await findRecord('medications', medId, a.id);
  if (String(med.status) !== 'active') throw new HttpError('الدواء موقوف أو مكتمل — لا تُسجَّل له جرعات', 409);
  const at = resolveRecordedAt(input.administered_at);
  await db.execute({
    sql: `INSERT INTO medication_administrations (id, medication_id, admission_id, status, note, administered_by, administered_by_id, administered_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, medId, a.id, input.status, input.note?.trim() || null, s.user.full_name_ar, s.user.id, at, new Date().toISOString()],
  });
  const [ar, en] = ADMIN_TITLES[input.status];
  await addTimeline({ admissionId: a.id, actor: s.user.full_name_ar, actorId: s.user.id, type: 'medication', titleAr: `${ar}: ${String(med.name_ar)}`, titleEn: `${en}: ${String(med.name_en ?? med.name_ar)}` }, at);
  await writeAudit({ actorId: s.user.id, action: `medication_${input.status}`, resourceType: 'medication_administration', resourceId: id, ip: clientIp(c) });
  return c.json(await fetchRow('medication_administrations', id), 201);
});

/** تصحيح إدخال خاطئ: صاحب الإدخال فقط وخلال ساعة من تسجيله */
recordRoutes.delete('/:admissionId/administrations/:id', requireAuth(), requirePermission('medications.administer'), async (c) => {
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  const row = await findRecord('medication_administrations', id, a.id);
  if (String(row.administered_by_id) !== s.user.id || Date.now() - Date.parse(String(row.created_at)) > 3600_000) {
    throw new HttpError('يمكن تصحيح الإدخال من قِبل مسجّله خلال ساعة فقط', 403);
  }
  await moveToTrash({ table: 'medication_administrations', id, hospitalId: s.user.hospital_id, kind: 'medication_administration', label: `${String(row.status)} · ${String(row.administered_at).slice(0, 16).replace('T', ' ')}`, actor: { id: s.user.id, name: s.user.full_name_ar }, admissionId: a.id });
  await track(c, s, a.id, 'medication', 'إلغاء تسجيل جرعة', 'Dose entry removed', 'medication_administration_deleted', 'medication_administration', id);
  return c.body(null, 204);
});

// ---------------------------------------------------------------- ميزان السوائل (Intake / Output)

recordRoutes.post('/:admissionId/fluids', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, CreateFluidSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateFluidSchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c, input.admission_id);
  const id = input.client_id ?? uuid('fl');
  if (input.client_id && (await existingClientRecord('fluid_entries', id, a.id))) {
    return c.json(await fetchRow('fluid_entries', id), 200);
  }
  requireActive(a);
  const at = resolveRecordedAt(input.recorded_at);
  await db.execute({
    sql: `INSERT INTO fluid_entries (id, admission_id, direction, kind, volume_ml, note, recorded_by, recorded_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, a.id, input.direction, input.kind, input.volume_ml, input.note?.trim() || null, s.user.full_name_ar, at, new Date().toISOString()],
  });
  await writeAudit({ actorId: s.user.id, action: 'fluid_recorded', resourceType: 'fluid_entry', resourceId: id, ip: clientIp(c) });
  return c.json(await fetchRow('fluid_entries', id), 201);
});

// ---------------------------------------------------------------- المختبر: الطبيب يطلب، الفني يُدخل النتيجة

recordRoutes.post('/:admissionId/labs', requireAuth(), requirePermission('lab.order', 'lab.add_result'), async (c) => {
  const parsed = await parseBody(c, AddLabResultSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AddLabResultSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  // فني المختبر يستطيع إدخال فحص مع نتيجته مباشرة؛ غيره يُنشئ طلباً فقط
  const withResult = Boolean(input.result?.trim()) && sessionHas(c, 'lab.add_result');
  const id = uuid('lb');
  const at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO lab_results (id, admission_id, test_name_ar, test_name_en, category, ordered_by, ordered_at, result, unit, reference_range, status, resulted_by, resulted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, input.admission_id, input.test_name_ar, input.test_name_en ?? null, input.category ?? null, s.user.full_name_ar, at,
      withResult ? input.result!.trim() : null,
      input.unit ?? null,
      input.reference_range ?? null,
      withResult ? 'resulted' : 'ordered',
      withResult ? s.user.full_name_ar : null,
      withResult ? at : null,
    ],
  });
  await track(c, s, input.admission_id, 'lab', withResult ? `نتيجة مختبر: ${input.test_name_ar}` : `طلب مختبر: ${input.test_name_ar}`, withResult ? `Lab result: ${input.test_name_en ?? input.test_name_ar}` : `Lab ordered: ${input.test_name_en ?? input.test_name_ar}`, 'lab_ordered', 'lab_result', id);
  await notifyAdmission(
    input.admission_id,
    withResult
      ? { toAttending: true, kind: 'lab_resulted', titleAr: `نتيجة مختبر: ${input.test_name_ar}`, titleEn: `Lab result: ${input.test_name_en ?? input.test_name_ar}`, createdById: s.user.id }
      : { roles: ['lab'], kind: 'lab_ordered', titleAr: `طلب فحص جديد: ${input.test_name_ar}`, titleEn: `New lab order: ${input.test_name_en ?? input.test_name_ar}`, createdById: s.user.id },
  );
  return c.json(await fetchRow('lab_results', id), 201);
});

recordRoutes.patch('/:admissionId/labs/:id', requireAuth(), requirePermission('lab.add_result'), async (c) => {
  const parsed = await parseBody(c, UpdateLabResultSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateLabResultSchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  const lab = await findRecord('lab_results', id, a.id);
  await db.execute({
    sql: `UPDATE lab_results SET result = ?, unit = ?, reference_range = ?, status = ?, resulted_by = ?, resulted_at = ? WHERE id = ?`,
    args: [input.result, input.unit ?? null, input.reference_range ?? null, input.abnormal ? 'abnormal' : 'resulted', s.user.full_name_ar, new Date().toISOString(), id],
  });
  await track(c, s, a.id, 'lab', 'إدخال نتيجة مختبر', 'Lab result entered', 'lab_result_updated', 'lab_result', id);
  await notifyAdmission(a.id, {
    toAttending: true,
    kind: input.abnormal ? 'lab_abnormal' : 'lab_resulted',
    severity: input.abnormal ? 'warning' : 'info',
    titleAr: `${input.abnormal ? 'نتيجة غير طبيعية' : 'نتيجة مختبر'}: ${String(lab.test_name_ar)}`,
    titleEn: `${input.abnormal ? 'Abnormal result' : 'Lab result'}: ${String(lab.test_name_en ?? lab.test_name_ar)}`,
    bodyAr: `${input.result}${input.unit ? ` ${input.unit}` : ''}`,
    createdById: s.user.id,
  });
  return c.json(await fetchRow('lab_results', id), 200);
});

// ---------------------------------------------------------------- الأشعة: الطبيب يطلب، الفني يكتب التقرير

recordRoutes.post('/:admissionId/radiology', requireAuth(), requirePermission('radiology.order', 'radiology.add_report'), async (c) => {
  const parsed = await parseBody(c, RadiologyReportSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof RadiologyReportSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  const withReport = Boolean(input.report?.trim()) && sessionHas(c, 'radiology.add_report');
  const id = uuid('rd');
  const at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO radiology_reports (id, admission_id, study_type, study_type_ar, study_type_en, ordered_by, ordered_at, report, status, performed_by, performed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, input.admission_id, input.study_type_ar, input.study_type_ar, input.study_type_en ?? null, s.user.full_name_ar, at,
      withReport ? input.report!.trim() : null,
      withReport ? 'resulted' : 'ordered',
      withReport ? s.user.full_name_ar : null,
      withReport ? at : null,
    ],
  });
  await track(c, s, input.admission_id, 'radiology', withReport ? `تقرير أشعة: ${input.study_type_ar}` : `طلب أشعة: ${input.study_type_ar}`, withReport ? `Radiology report: ${input.study_type_en ?? input.study_type_ar}` : `Radiology ordered: ${input.study_type_en ?? input.study_type_ar}`, 'radiology_ordered', 'radiology_report', id);
  await notifyAdmission(
    input.admission_id,
    withReport
      ? { toAttending: true, kind: 'radiology_reported', titleAr: `تقرير أشعة: ${input.study_type_ar}`, titleEn: `Radiology report: ${input.study_type_en ?? input.study_type_ar}`, createdById: s.user.id }
      : { roles: ['radiology'], kind: 'radiology_ordered', titleAr: `طلب أشعة جديد: ${input.study_type_ar}`, titleEn: `New imaging order: ${input.study_type_en ?? input.study_type_ar}`, createdById: s.user.id },
  );
  return c.json(await fetchRow('radiology_reports', id), 201);
});

recordRoutes.patch('/:admissionId/radiology/:id', requireAuth(), requirePermission('radiology.add_report'), async (c) => {
  const parsed = await parseBody(c, UpdateRadiologySchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateRadiologySchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  const study = await findRecord('radiology_reports', id, a.id);
  await db.execute({
    sql: `UPDATE radiology_reports SET report = ?, status = 'resulted', performed_by = ?, performed_at = ? WHERE id = ?`,
    args: [input.report, s.user.full_name_ar, new Date().toISOString(), id],
  });
  await track(c, s, a.id, 'radiology', 'إعداد تقرير أشعة', 'Radiology report ready', 'radiology_report_updated', 'radiology_report', id);
  await notifyAdmission(a.id, {
    toAttending: true,
    kind: 'radiology_reported',
    titleAr: `تقرير أشعة جاهز: ${String(study.study_type_ar ?? study.study_type)}`,
    titleEn: `Radiology report ready: ${String(study.study_type_en ?? study.study_type_ar ?? study.study_type)}`,
    createdById: s.user.id,
  });
  return c.json(await fetchRow('radiology_reports', id), 200);
});

// ---------------------------------------------------------------- الاستشارات

recordRoutes.post('/:admissionId/consultations', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, ConsultationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof ConsultationSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  const id = uuid('cn');
  await db.execute({
    sql: `INSERT INTO consultations (id, admission_id, requested_by, specialty, reason, response, requested_at, responded_by) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`,
    args: [id, input.admission_id, s.user.full_name_ar, input.specialty, input.reason, new Date().toISOString()],
  });
  await track(c, s, input.admission_id, 'consultation', `طلب استشارة: ${input.specialty}`, `Consultation: ${input.specialty}`, 'consultation_requested', 'consultation', id);
  return c.json(await fetchRow('consultations', id), 201);
});

recordRoutes.patch('/:admissionId/consultations/:id', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, UpdateConsultationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateConsultationSchema)['_output'];
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  const row = await findRecord('consultations', id, a.id);
  const alreadyResponded = Boolean(row.response);

  if (input.response !== undefined) {
    if (alreadyResponded) return c.json({ message: 'تم الرد على الاستشارة مسبقاً' }, 409);
    await db.execute({
      sql: `UPDATE consultations SET response = ?, responded_by = ?, responded_at = ? WHERE id = ?`,
      args: [input.response.trim(), s.user.full_name_ar, new Date().toISOString(), id],
    });
    await track(c, s, a.id, 'consultation', 'رد الاستشارة', 'Consultation answered', 'consultation_responded', 'consultation', id);
    return c.json(await fetchRow('consultations', id), 200);
  }

  if (alreadyResponded) return c.json({ message: 'لا يمكن تعديل استشارة تم الرد عليها' }, 409);
  const { sets, args } = buildSets(input, ['specialty', 'reason']);
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  await db.execute({ sql: `UPDATE consultations SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  await track(c, s, a.id, 'consultation', 'تعديل طلب استشارة', 'Consultation request updated', 'consultation_updated', 'consultation', id);
  return c.json(await fetchRow('consultations', id), 200);
});

// ---------------------------------------------------------------- الإجراءات

recordRoutes.post('/:admissionId/procedures', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, CreateProcedureSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateProcedureSchema)['_output'];
  const s = getSession(c)!;
  requireActive(await loadAdmission(c, input.admission_id));

  const id = uuid('pc');
  await db.execute({
    sql: `INSERT INTO procedures (id, admission_id, name_ar, name_en, performed_by, performed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.admission_id, input.name_ar, input.name_en ?? null, s.user.full_name_ar, new Date().toISOString(), input.notes ?? null],
  });
  await track(c, s, input.admission_id, 'procedure', `إجراء: ${input.name_ar}`, `Procedure: ${input.name_en ?? input.name_ar}`, 'procedure_added', 'procedure', id);
  return c.json(await fetchRow('procedures', id), 201);
});

recordRoutes.patch('/:admissionId/procedures/:id', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, UpdateProcedureSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as Record<string, unknown>;
  const s = getSession(c)!;
  const a = await loadAdmission(c);
  const id = c.req.param('id');
  await findRecord('procedures', id, a.id);
  const { sets, args } = buildSets(input, ['name_ar', 'name_en', 'notes']);
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  await db.execute({ sql: `UPDATE procedures SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  await track(c, s, a.id, 'procedure', 'تعديل إجراء', 'Procedure updated', 'procedure_updated', 'procedure', id);
  return c.json(await fetchRow('procedures', id), 200);
});

// ---------------------------------------------------------------- الحذف

interface DeleteSpec {
  table: string;
  resourceType: string;
  timelineType: string;
  titleAr: string;
  titleEn: string;
  /** قيد إضافي — مثلاً: الطبيب يلغي طلب مختبر لم تصدر نتيجته فقط */
  check?: (c: Context, row: Row) => void | Promise<void>;
}

function deleteRoute(path: string, permissions: Permission[], spec: DeleteSpec) {
  recordRoutes.delete(`/:admissionId/${path}/:id`, requireAuth(), requirePermission(...permissions), async (c) => {
    const s = getSession(c)!;
    const a = await loadAdmission(c);
    const id = c.req.param('id') ?? '';
    const row = await findRecord(spec.table, id, a.id);
    await spec.check?.(c, row);
    // لا حذف نهائي: السجل ينتقل إلى سلة المحذوفات
    await moveToTrash({ table: spec.table as TrashableTable, id, hospitalId: s.user.hospital_id, kind: spec.resourceType, label: recordLabel(row), actor: { id: s.user.id, name: s.user.full_name_ar }, admissionId: a.id });
    await track(c, s, a.id, spec.timelineType, spec.titleAr, spec.titleEn, `${spec.resourceType}_deleted`, spec.resourceType, id);
    return c.body(null, 204);
  });
}

const onlyPendingUnless = (perm: Permission) => (c: Context, row: Row) => {
  if (!sessionHas(c, perm) && String(row.status) !== 'ordered') {
    throw new HttpError('لا يمكن إلغاء طلب صدرت نتيجته', 409);
  }
};

deleteRoute('diagnoses', ['notes.write.doctor'], { table: 'diagnoses', resourceType: 'diagnosis', timelineType: 'diagnosis', titleAr: 'حذف تشخيص', titleEn: 'Diagnosis deleted' });
deleteRoute('procedures', ['notes.write.doctor'], { table: 'procedures', resourceType: 'procedure', timelineType: 'procedure', titleAr: 'حذف إجراء', titleEn: 'Procedure deleted' });
deleteRoute('consultations', ['notes.write.doctor'], { table: 'consultations', resourceType: 'consultation', timelineType: 'consultation', titleAr: 'حذف استشارة', titleEn: 'Consultation deleted' });
deleteRoute('medications', ['medications.manage'], {
  table: 'medications',
  resourceType: 'medication',
  timelineType: 'medication',
  titleAr: 'حذف دواء',
  titleEn: 'Medication deleted',
  // دواء أُعطيت منه جرعات جزء من السجل الطبي: يُوقف ولا يُحذف
  check: async (_c, row) => {
    const n = await db.execute({ sql: `SELECT 1 FROM medication_administrations WHERE medication_id = ? LIMIT 1`, args: [String(row.id)] });
    if (n.rows.length > 0) throw new HttpError('سُجّلت جرعات لهذا الدواء — أوقفه بدلاً من حذفه', 409);
  },
});
deleteRoute('fluids', ['vitals.write'], { table: 'fluid_entries', resourceType: 'fluid_entry', timelineType: 'vitals', titleAr: 'حذف إدخال سوائل', titleEn: 'Fluid entry deleted' });
deleteRoute('labs', ['lab.order', 'lab.add_result'], { table: 'lab_results', resourceType: 'lab_result', timelineType: 'lab', titleAr: 'حذف طلب مختبر', titleEn: 'Lab order deleted', check: onlyPendingUnless('lab.add_result') });
deleteRoute('radiology', ['radiology.order', 'radiology.add_report'], { table: 'radiology_reports', resourceType: 'radiology_report', timelineType: 'radiology', titleAr: 'حذف طلب أشعة', titleEn: 'Radiology order deleted', check: onlyPendingUnless('radiology.add_report') });
