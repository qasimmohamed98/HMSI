import { Hono } from 'hono';
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
  RespondConsultationSchema,
} from '@hmsi/shared/validate';
import type { Context } from 'hono';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { db, uuid } from '../../db/index.js';

export const recordRoutes = new Hono();

async function guard(c: Context, admissionId: string): Promise<Response | null> {
  if (c.req.param('admissionId') !== admissionId) {
    return c.json({ message: 'معرّف الطلب غير مطابق' }, 400);
  }
  const scope = await getAdmissionScope(admissionId);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  return null;
}

async function ownsRecord(table: string, id: string, admissionId: string, actorId: string, isSuper: boolean): Promise<{ row: Record<string, unknown> | null; authorized: boolean }> {
  const rows = await db.execute({ sql: `SELECT * FROM ${table} WHERE id = ? AND admission_id = ? LIMIT 1`, args: [id, admissionId] });
  if (rows.rows.length === 0) return { row: null, authorized: false };
  const row = rows.rows[0] as Record<string, unknown>;
  const owned = isSuper || (row.author_id ? String(row.author_id) === actorId : true);
  return { row, authorized: owned };
}

recordRoutes.post('/:admissionId/notes', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, CreateNoteSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateNoteSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('nt');
  await db.execute({
    sql: `INSERT INTO medical_notes (id, admission_id, kind, author_id, recorded_at, content, corrected_by)
          VALUES (?, ?, ?, ?, datetime('now'), ?, NULL)`,
    args: [id, input.admission_id, input.kind, session.user.id, input.content],
  });
  await addTimeline(
    {
      admissionId: input.admission_id,
      actor: session.user.full_name_ar,
      actorId: session.user.id,
      type: 'note',
      titleAr: input.kind === 'doctor' ? 'ملاحظة طبية' : 'ملاحظة تمريض',
      titleEn: input.kind === 'doctor' ? 'Doctor note' : 'Nursing note',
    },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'note_created', resourceType: 'medical_note', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, kind: input.kind, author: session.user.full_name_ar, recorded_at: new Date().toISOString(), content: input.content, corrected_by: null }, 201);
});

recordRoutes.post('/:admissionId/diagnoses', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, CreateDiagnosisSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateDiagnosisSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('dg');
  await db.execute({
    sql: `INSERT INTO diagnoses (id, admission_id, icd10, title_ar, title_en, status, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [id, input.admission_id, input.icd10 ?? null, input.title_ar, input.title_en ?? null, input.status ?? 'suspected', session.user.full_name_ar],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'diagnosis', titleAr: `إضافة تشخيص: ${input.title_ar}`, titleEn: `Diagnosis added: ${input.title_en ?? input.title_ar}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'diagnosis_added', resourceType: 'diagnosis', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, icd10: input.icd10 ?? null, title_ar: input.title_ar, title_en: input.title_en ?? null, status: input.status ?? 'suspected', added_by: session.user.full_name_ar, created_at: new Date().toISOString() }, 201);
});

recordRoutes.post('/:admissionId/medications', requireAuth(), requirePermission('medications.manage'), async (c) => {
  const parsed = await parseBody(c, CreateMedicationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateMedicationSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('md');
  await db.execute({
    sql: `INSERT INTO medications (id, admission_id, name_ar, name_en, dose, route, frequency, start_at, end_at, status, prescribed_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))`,
    args: [id, input.admission_id, input.name_ar, input.name_en ?? null, input.dose, input.route, input.frequency, input.start_at, input.end_at ?? null, session.user.full_name_ar],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'medication', titleAr: `وصف دواء: ${input.name_ar}`, titleEn: `Medication: ${input.name_en ?? input.name_ar}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'medication_prescribed', resourceType: 'medication', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, name_ar: input.name_ar, name_en: input.name_en ?? null, dose: input.dose, route: input.route, frequency: input.frequency, start_at: input.start_at, end_at: input.end_at ?? null, status: 'active', prescribed_by: session.user.full_name_ar }, 201);
});

recordRoutes.post('/:admissionId/labs', requireAuth(), requirePermission('lab.add_result'), async (c) => {
  const parsed = await parseBody(c, AddLabResultSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AddLabResultSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('lb');
  await db.execute({
    sql: `INSERT INTO lab_results (id, admission_id, test_name_ar, test_name_en, category, ordered_by, ordered_at, result, unit, reference_range, status)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), NULL, NULL, NULL, 'ordered')`,
    args: [id, input.admission_id, input.test_name_ar, input.test_name_en ?? null, input.category ?? '', session.user.full_name_ar],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'lab', titleAr: `طلب مختبر: ${input.test_name_ar}`, titleEn: `Lab ordered: ${input.test_name_en ?? input.test_name_ar}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'lab_ordered', resourceType: 'lab_result', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, test_name_ar: input.test_name_ar, test_name_en: input.test_name_en ?? null, category: input.category ?? '', ordered_by: session.user.full_name_ar, ordered_at: new Date().toISOString(), result: null, unit: null, reference_range: null, status: 'ordered', resulted_by: null, resulted_at: null }, 201);
});

recordRoutes.post('/:admissionId/radiology', requireAuth(), requirePermission('radiology.add_report'), async (c) => {
  const parsed = await parseBody(c, RadiologyReportSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof RadiologyReportSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('rd');
  await db.execute({
    sql: `INSERT INTO radiology_reports (id, admission_id, study_type, study_type_ar, study_type_en, ordered_by, ordered_at, report, status)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), NULL, 'ordered')`,
    args: [id, input.admission_id, input.study_type_ar, input.study_type_ar, input.study_type_en ?? null, session.user.full_name_ar],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'radiology', titleAr: `طلب أشعة: ${input.study_type_ar}`, titleEn: `Radiology ordered: ${input.study_type_en ?? input.study_type_ar}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'radiology_ordered', resourceType: 'radiology_report', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, study_type_ar: input.study_type_ar, study_type_en: input.study_type_en ?? null, ordered_by: session.user.full_name_ar, ordered_at: new Date().toISOString(), report: null, status: 'ordered', performed_by: null }, 201);
});

recordRoutes.post('/:admissionId/consultations', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, ConsultationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof ConsultationSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('cn');
  await db.execute({
    sql: `INSERT INTO consultations (id, admission_id, requested_by, specialty, reason, response, requested_at, responded_by)
          VALUES (?, ?, ?, ?, ?, NULL, datetime('now'), NULL)`,
    args: [id, input.admission_id, session.user.full_name_ar, input.specialty, input.reason],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'consultation', titleAr: `طلب استشارة: ${input.specialty}`, titleEn: `Consultation: ${input.specialty}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'consultation_requested', resourceType: 'consultation', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, requested_by: session.user.full_name_ar, specialty: input.specialty, reason: input.reason, response: null, requested_at: new Date().toISOString(), responded_by: null }, 201);
});

recordRoutes.post('/:admissionId/procedures', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, CreateProcedureSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateProcedureSchema)['_output'];
  const session = getSession(c)!;
  const failed = await guard(c, input.admission_id);
  if (failed) return failed;

  const id = uuid('pc');
  await db.execute({
    sql: `INSERT INTO procedures (id, admission_id, name_ar, name_en, performed_by, performed_at, notes)
          VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
    args: [id, input.admission_id, input.name_ar, input.name_en ?? null, session.user.full_name_ar, input.notes ?? null],
  });
  await addTimeline(
    { admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'procedure', titleAr: `إجراء: ${input.name_ar}`, titleEn: `Procedure: ${input.name_en ?? input.name_ar}` },
    new Date().toISOString(),
  );
  await writeAudit({ actorId: session.user.id, action: 'procedure_added', resourceType: 'procedure', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json({ id, admission_id: input.admission_id, name_ar: input.name_ar, name_en: input.name_en ?? null, notes: input.notes ?? null, performed_by: session.user.full_name_ar, performed_at: new Date().toISOString() }, 201);
});

// ---------------------------------------------------------------- تحديث/حذف السجلات

recordRoutes.patch('/:admissionId/labs/:id', requireAuth(), requirePermission('lab.add_result'), async (c) => {
  const parsed = await parseBody(c, UpdateLabResultSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateLabResultSchema)['_output'];
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('lab_results', id, admissionId, session.user.id, session.user.role === 'super_admin');
  void row;
  if (!authorized) return c.json({ message: 'السجل غير موجود' }, 404);
  if ((row as Record<string, unknown>).admission_id !== admissionId) return c.json({ message: 'السجل غير موجود' }, 404);
  await db.execute({
    sql: `UPDATE lab_results SET result = ?, unit = ?, reference_range = ?, status = 'resulted', resulted_by = ?, resulted_at = datetime('now') WHERE id = ?`,
    args: [input.result, input.unit ?? null, input.reference_range ?? null, session.user.full_name_ar, id],
  });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'lab', titleAr: 'إدخال نتيجة مختبر', titleEn: 'Lab result entered' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'lab_result_updated', resourceType: 'lab_result', resourceId: id, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({ sql: `SELECT * FROM lab_results WHERE id = ? LIMIT 1`, args: [id] });
  return c.json(updated.rows[0], 200);
});

recordRoutes.patch('/:admissionId/radiology/:id', requireAuth(), requirePermission('radiology.add_report'), async (c) => {
  const parsed = await parseBody(c, UpdateRadiologySchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateRadiologySchema)['_output'];
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('radiology_reports', id, admissionId, session.user.id, session.user.role === 'super_admin');
  void row;
  if (!authorized) return c.json({ message: 'السجل غير موجود' }, 404);
  await db.execute({
    sql: `UPDATE radiology_reports SET report = ?, status = 'resulted', performed_by = ?, performed_at = datetime('now') WHERE id = ?`,
    args: [input.report, session.user.full_name_ar, id],
  });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'radiology', titleAr: 'إعداد تقرير أشعة', titleEn: 'Radiology report ready' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'radiology_report_updated', resourceType: 'radiology_report', resourceId: id, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({ sql: `SELECT * FROM radiology_reports WHERE id = ? LIMIT 1`, args: [id] });
  return c.json(updated.rows[0], 200);
});

recordRoutes.patch('/:admissionId/medications/:id', requireAuth(), requirePermission('medications.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateMedicationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateMedicationSchema)['_output'];
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('medications', id, admissionId, session.user.id, session.user.role === 'super_admin');
  void row;
  if (!authorized) return c.json({ message: 'السجل غير موجود' }, 404);
  await db.execute({
    sql: `UPDATE medications SET status = ?, end_at = COALESCE(?, end_at) WHERE id = ?`,
    args: [input.status, input.end_at ?? null, id],
  });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'medication', titleAr: 'تحديث حالة دواء', titleEn: 'Medication status updated' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'medication_updated', resourceType: 'medication', resourceId: id, meta: { status: input.status }, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({ sql: `SELECT * FROM medications WHERE id = ? LIMIT 1`, args: [id] });
  return c.json(updated.rows[0], 200);
});

recordRoutes.patch('/:admissionId/notes/:id', requireAuth(), async (c) => {
  const parsed = await parseBody(c, UpdateNoteSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateNoteSchema)['_output'];
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('medical_notes', id, admissionId, session.user.id, session.user.role === 'super_admin');
  if (!row) return c.json({ message: 'السجل غير موجود' }, 404);
  if (!authorized) return c.json({ message: 'غير مصرح لك بتعديل هذه الملاحظة' }, 403);
  await db.execute({
    sql: `UPDATE medical_notes SET content = ?, corrected_by = ?, recorded_at = datetime('now') WHERE id = ?`,
    args: [input.content, session.user.id, id],
  });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'note', titleAr: 'تصحيح ملاحظة طبية', titleEn: 'Medical note corrected' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'note_updated', resourceType: 'medical_note', resourceId: id, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({
    sql: `SELECT n.*, u.full_name_ar AS author FROM medical_notes n JOIN users u ON u.id = n.author_id WHERE n.id = ? LIMIT 1`,
    args: [id],
  });
  return c.json(updated.rows[0], 200);
});

recordRoutes.patch('/:admissionId/consultations/:id', requireAuth(), requirePermission('notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, RespondConsultationSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof RespondConsultationSchema)['_output'];
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('consultations', id, admissionId, session.user.id, session.user.role === 'super_admin');
  void row;
  if (!authorized) return c.json({ message: 'السجل غير موجود' }, 404);
  await db.execute({
    sql: `UPDATE consultations SET response = ?, responded_by = ?, responded_at = datetime('now') WHERE id = ?`,
    args: [input.response, session.user.full_name_ar, id],
  });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'consultation', titleAr: 'رد الاستشارة', titleEn: 'Consultation answered' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'consultation_responded', resourceType: 'consultation', resourceId: id, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({ sql: `SELECT * FROM consultations WHERE id = ? LIMIT 1`, args: [id] });
  return c.json(updated.rows[0], 200);
});

recordRoutes.delete('/:admissionId/notes/:id', requireAuth(), async (c) => {
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const { row, authorized } = await ownsRecord('medical_notes', id, admissionId, session.user.id, session.user.role === 'super_admin');
  if (!row) return c.json({ message: 'السجل غير موجود' }, 404);
  if (!authorized) return c.json({ message: 'غير مصرح لك بحذف هذه الملاحظة' }, 403);
  await db.execute({ sql: `DELETE FROM medical_notes WHERE id = ?`, args: [id] });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'note', titleAr: 'حذف ملاحظة طبية', titleEn: 'Medical note deleted' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'note_deleted', resourceType: 'medical_note', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.body(null, 204);
});

async function deleteAudit(c: Context, table: string, action: string, resourceType: string, timelineType: string, titleAr: string, titleEn: string): Promise<Response> {
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const rows = await db.execute({ sql: `SELECT id FROM ${table} WHERE id = ? AND admission_id = ? LIMIT 1`, args: [id, admissionId] });
  if (rows.rows.length === 0) return c.json({ message: 'السجل غير موجود' }, 404);
  await db.execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [id] });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: timelineType, titleAr, titleEn }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action, resourceType, resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.body(null, 204);
}

recordRoutes.delete('/:admissionId/diagnoses/:id', requireAuth(), requirePermission('notes.write.doctor'), (c) => deleteAudit(c, 'diagnoses', 'diagnosis_deleted', 'diagnosis', 'diagnosis', 'حذف تشخيص', 'Diagnosis deleted'));
recordRoutes.delete('/:admissionId/procedures/:id', requireAuth(), requirePermission('notes.write.doctor'), (c) => deleteAudit(c, 'procedures', 'procedure_deleted', 'procedure', 'procedure', 'حذف إجراء', 'Procedure deleted'));
recordRoutes.delete('/:admissionId/consultations/:id', requireAuth(), requirePermission('notes.write.doctor'), (c) => deleteAudit(c, 'consultations', 'consultation_deleted', 'consultation', 'consultation', 'حذف استشارة', 'Consultation deleted'));
recordRoutes.delete('/:admissionId/labs/:id', requireAuth(), requirePermission('lab.add_result'), (c) => deleteAudit(c, 'lab_results', 'lab_deleted', 'lab_result', 'lab', 'حذف طلب مختبر', 'Lab order deleted'));
recordRoutes.delete('/:admissionId/radiology/:id', requireAuth(), requirePermission('radiology.add_report'), (c) => deleteAudit(c, 'radiology_reports', 'radiology_deleted', 'radiology_report', 'radiology', 'حذف طلب أشعة', 'Radiology order deleted'));
recordRoutes.delete('/:admissionId/medications/:id', requireAuth(), requirePermission('medications.manage'), (c) => deleteAudit(c, 'medications', 'medication_deleted', 'medication', 'medication', 'حذف دواء', 'Medication deleted'));