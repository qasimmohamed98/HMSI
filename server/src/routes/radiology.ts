import { Hono } from 'hono';
import { imagingSafetyQuestions, imagingSafetyReview, type Modality, type SafetyAnswers } from '@hmsi/shared';
import { PerformImagingSchema } from '@hmsi/shared/validate';
import { db } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { isContrast } from './services.js';

/**
 * قائمة عمل الأشعة (فني الأشعة وطبيبها): كل الطلبات الجارية في المستشفى من كل الزيارات، مرتبة بالأولوية ثم الأقدم.
 * لا علاقة لها بفريق رعاية المريض — قسم الأشعة يرى ما طُلب منه.
 */
export const radiologyRoutes = new Hono();

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const RANK = `CASE rr.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END`;

radiologyRoutes.get('/worklist', requireAuth(), requirePermission('radiology.add_report', 'radiology.perform', 'radiology.verify'), async (c) => {
  const s = getSession(c)!;
  // open = الجارية؛ done = المنتهية آخر 3 أيام
  const done = c.req.query('view') === 'done';
  const modality = c.req.query('modality');
  const where = [`p.hospital_id = ?`];
  const args: (string | number)[] = [s.user.hospital_id];
  if (done) {
    where.push(`rr.stage IN ('reported','verified')`, `COALESCE(rr.performed_at, rr.ordered_at) > ?`);
    args.push(new Date(Date.now() - 3 * 86_400_000).toISOString());
  } else {
    where.push(`rr.stage IN ('ordered','scheduled','performed')`);
  }
  if (modality) {
    where.push(`rr.modality = ?`);
    args.push(modality);
  }
  const rows = await db.execute({
    sql: `SELECT rr.*, a.encounter_type, a.referral_source, a.referring_doctor, a.room, a.bed_no, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 p.id AS patient_id, p.full_name_ar, p.full_name_en, p.file_number, p.gender, p.birth_date,
                 sv.prep_ar, sv.prep_en, sv.meta_json, u.name_ar AS unit_name_ar, u.name_en AS unit_name_en
          FROM radiology_reports rr
          JOIN admissions a ON a.id = rr.admission_id
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN wards w ON w.id = a.ward_id
          LEFT JOIN services sv ON sv.id = rr.service_id
          LEFT JOIN department_units u ON u.id = rr.unit_id
          WHERE ${where.join(' AND ')}
          ORDER BY ${done ? 'COALESCE(rr.performed_at, rr.ordered_at) DESC' : `${RANK}, rr.ordered_at ASC`}
          LIMIT 200`,
    args,
  });
  const ids = rows.rows.map((r) => String((r as unknown as Row).id));
  const files = ids.length
    ? await db.execute({
        sql: `SELECT id, record_id, admission_id, file_name, size FROM attachments WHERE record_type = 'radiology' AND record_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`,
        args: ids,
      })
    : { rows: [] };
  const byRecord = new Map<string, Row[]>();
  for (const f of files.rows) {
    const r = f as unknown as Row;
    byRecord.set(String(r.record_id), [...(byRecord.get(String(r.record_id)) ?? []), r]);
  }
  const counts = await db.execute({
    sql: `SELECT rr.priority, COUNT(*) AS n FROM radiology_reports rr JOIN admissions a ON a.id = rr.admission_id JOIN patients p ON p.id = a.patient_id
          WHERE p.hospital_id = ? AND rr.stage IN ('ordered','scheduled','performed') GROUP BY rr.priority`,
    args: [s.user.hospital_id],
  });
  return c.json({
    counts: Object.fromEntries(counts.rows.map((r) => [String((r as unknown as Row).priority), Number((r as unknown as Row).n)])),
    items: rows.rows.map((row) => {
      const r = row as unknown as Row;
      const modalityV = str(r.modality) as Modality | null;
      const gender = r.gender === 'male' || r.gender === 'female' ? r.gender : null;
      let answers: SafetyAnswers = {};
      try {
        answers = JSON.parse(String(r.safety_json ?? '{}')) as SafetyAnswers;
      } catch {
        /* */
      }
      const questions = imagingSafetyQuestions(modalityV, isContrast(r), gender);
      const review = imagingSafetyReview(questions, answers);
      return {
        id: String(r.id),
        admission_id: String(r.admission_id),
        patient_id: String(r.patient_id),
        full_name_ar: String(r.full_name_ar),
        full_name_en: str(r.full_name_en),
        file_number: String(r.file_number),
        gender,
        birth_date: str(r.birth_date),
        encounter_type: String(r.encounter_type ?? 'inpatient'),
        referral_source: str(r.referral_source),
        room: str(r.room),
        bed_no: str(r.bed_no),
        ward_name_ar: str(r.ward_name_ar),
        ward_name_en: str(r.ward_name_en),
        study_type_ar: String(r.study_type_ar),
        study_type_en: str(r.study_type_en),
        modality: modalityV,
        priority: String(r.priority ?? 'routine'),
        indication: str(r.indication),
        stage: String(r.stage ?? 'ordered'),
        ordered_by: String(r.ordered_by),
        ordered_at: String(r.ordered_at),
        prep_ar: str(r.prep_ar),
        prep_en: str(r.prep_en),
        unit_id: str(r.unit_id),
        unit_name_ar: str(r.unit_name_ar),
        unit_name_en: str(r.unit_name_en),
        exam_done_by: str(r.exam_done_by),
        exam_done_at: str(r.exam_done_at),
        exam_note: str(r.exam_note),
        report: str(r.report),
        performed_by: str(r.performed_by),
        performed_at: str(r.performed_at),
        verified_by: str(r.verified_by),
        safety: {
          questions,
          answers,
          warnings: review.warnings.map((x) => x.key),
          unanswered: review.unanswered.map((x) => x.key),
        },
        files: (byRecord.get(String(r.id)) ?? []).map((f) => ({ id: String(f.id), admission_id: String(f.admission_id), file_name: String(f.file_name), size: Number(f.size) })),
      };
    }),
  });
});

/** تنفيذ الفحص على الجهاز: يبدأ من فني الأشعة، ويُسجَّل الجهاز ومن نفّذ ومتى */
radiologyRoutes.post('/:id/perform', requireAuth(), requirePermission('radiology.perform', 'radiology.verify'), async (c) => {
  const parsed = await parseBody(c, PerformImagingSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof PerformImagingSchema)['_output'];
  const s = getSession(c)!;
  const id = c.req.param('id');
  const r = await db.execute({
    sql: `SELECT rr.id, rr.admission_id, rr.stage, rr.study_type_ar, rr.modality, rr.safety_json, rr.service_id FROM radiology_reports rr
          JOIN admissions a ON a.id = rr.admission_id JOIN patients p ON p.id = a.patient_id WHERE rr.id = ? AND p.hospital_id = ?`,
    args: [id, s.user.hospital_id],
  });
  const row = r.rows[0] as unknown as Row | undefined;
  if (!row) throw new HttpError('طلب الأشعة غير موجود', 404);
  if (!['ordered', 'scheduled'].includes(String(row.stage))) return c.json({ message: 'الفحص نُفِّذ أو أُلغي بالفعل' }, 409);
  if (input.unit_id) {
    const u = await db.execute({ sql: `SELECT status FROM department_units WHERE id = ? AND hospital_id = ?`, args: [input.unit_id, s.user.hospital_id] });
    const unit = u.rows[0] as unknown as Row | undefined;
    if (!unit) throw new HttpError('الجهاز غير موجود', 404);
    if (String(unit.status) !== 'active') return c.json({ message: 'الجهاز غير متاح (في الصيانة أو متوقف) — اختر جهازاً آخر' }, 409);
  }
  // فحص فيه أسئلة أمان مقلقة أو بلا إجابة: لا تنفيذ دون تأكيد الفني مراجعتها
  const sv = row.service_id ? ((await db.execute({ sql: `SELECT * FROM services WHERE id = ?`, args: [String(row.service_id)] })).rows[0] as unknown as Row | undefined) : undefined;
  const gender = ((await db.execute({ sql: `SELECT p.gender FROM patients p JOIN admissions a ON a.patient_id = p.id WHERE a.id = ?`, args: [String(row.admission_id)] })).rows[0] as unknown as Row | undefined)?.gender;
  const questions = imagingSafetyQuestions((str(row.modality) as Modality | null) ?? null, sv ? isContrast(sv) : false, gender === 'male' || gender === 'female' ? gender : null);
  if (questions.length > 0 && !input.safety_confirmed) return c.json({ message: 'أكّد مراجعة أسئلة الأمان قبل تنفيذ الفحص', code: 'safety_not_confirmed' }, 422);

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE radiology_reports SET stage = 'performed', status = 'in_progress', unit_id = ?, exam_note = ?, exam_done_by = ?, exam_done_by_id = ?, exam_done_at = ? WHERE id = ?`,
    args: [input.unit_id ?? null, input.note ?? null, s.user.full_name_ar, s.user.id, now, id],
  });
  await addTimeline({
    admissionId: String(row.admission_id),
    actor: s.user.full_name_ar,
    actorId: s.user.id,
    type: 'radiology',
    titleAr: `نُفّذ فحص الأشعة: ${String(row.study_type_ar)}`,
    titleEn: `Imaging exam performed: ${String(row.study_type_ar)}`,
  });
  await writeAudit({ actorId: s.user.id, action: 'imaging_performed', resourceType: 'radiology_report', resourceId: id, meta: { unit: input.unit_id ?? null }, ip: clientIp(c) });
  return c.body(null, 204);
});
