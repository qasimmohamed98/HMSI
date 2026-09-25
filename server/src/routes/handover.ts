import { Hono } from 'hono';
import { z } from 'zod';
import { calcMews, type Consciousness } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { doctorAccessSql, isRestricted } from '../lib/access.js';

/**
 * تسليم المناوبة: ملخص كل مريض منوّم في الردهة (التشخيص، الحساسية، آخر علامات حيوية وMEWS،
 * الطلبات المعلقة، آخر ملاحظة تمريض) + ملاحظة تسليم بصيغة SBAR.
 */
export const handoverRoutes = new Hono();

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const parseList = (v: unknown): string[] => {
  try {
    const x = JSON.parse(String(v ?? '[]'));
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
};

handoverRoutes.get('/', requireAuth(), requirePermission('chart.view'), async (c) => {
  const s = getSession(c)!;
  const ward = c.req.query('ward');
  const since24 = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const extra: string[] = [];
  const extraArgs: string[] = [];
  if (isRestricted(s.user)) {
    const acc = doctorAccessSql('p', s.user.id);
    extra.push(acc.sql);
    extraArgs.push(...acc.args);
  }
  if (c.req.query('mine') === '1') {
    extra.push(`EXISTS (SELECT 1 FROM care_team cm WHERE cm.admission_id = a.id AND cm.user_id = ? AND cm.ended_at IS NULL)`);
    extraArgs.push(s.user.id);
  }
  const rows = await db.execute({
    sql: `SELECT a.id AS admission_id, a.admitted_at, a.reason, a.room, a.bed_no, a.ward_id,
                 w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 p.id AS patient_id, p.full_name_ar, p.full_name_en, p.file_number, p.birth_date, p.gender, p.allergies_json, p.critical_alerts_json,
                 u.full_name_ar AS doctor_ar, u.full_name_en AS doctor_en,
                 (SELECT group_concat(COALESCE(d.title_ar, ''), '، ') FROM diagnoses d WHERE d.admission_id = a.id AND d.status != 'resolved') AS diagnoses_ar,
                 (SELECT group_concat(COALESCE(d.title_en, d.title_ar), ', ') FROM diagnoses d WHERE d.admission_id = a.id AND d.status != 'resolved') AS diagnoses_en,
                 v.recorded_at AS v_at, v.temperature, v.pulse, v.respiratory_rate, v.bp_systolic, v.bp_diastolic, v.spo2, v.pain_score, v.consciousness,
                 (SELECT COUNT(*) FROM lab_results l WHERE l.admission_id = a.id AND l.status IN ('ordered','in_progress')) AS pending_labs,
                 (SELECT COUNT(*) FROM lab_results l WHERE l.admission_id = a.id AND l.status = 'abnormal' AND l.resulted_at > ?) AS abnormal_labs_24h,
                 (SELECT COUNT(*) FROM radiology_reports r WHERE r.admission_id = a.id AND r.status = 'ordered') AS pending_radiology,
                 (SELECT COUNT(*) FROM medications m WHERE m.admission_id = a.id AND m.status = 'active') AS active_meds,
                 (SELECT n.content FROM medical_notes n WHERE n.admission_id = a.id AND n.kind = 'nursing' ORDER BY n.recorded_at DESC LIMIT 1) AS last_nursing_note,
                 (SELECT un.full_name_ar FROM care_team ct JOIN users un ON un.id = ct.user_id WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_ar,
                 (SELECT un.full_name_en FROM care_team ct JOIN users un ON un.id = ct.user_id WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_en,
                 (SELECT ct.user_id FROM care_team ct WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1) AS nurse_id,
                 cp.nursing_instructions, cp.vitals_interval_hours,
                 h.id AS h_id, h.situation, h.background, h.assessment, h.recommendation, h.author AS h_author, h.created_at AS h_at
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN wards w ON w.id = a.ward_id
          LEFT JOIN users u ON u.id = a.attending_doctor_id
          LEFT JOIN vitals v ON v.id = (SELECT id FROM vitals WHERE admission_id = a.id ORDER BY recorded_at DESC LIMIT 1)
          LEFT JOIN care_plans cp ON cp.admission_id = a.id
          LEFT JOIN handover_notes h ON h.id = (SELECT id FROM handover_notes WHERE admission_id = a.id ORDER BY created_at DESC LIMIT 1)
          WHERE p.hospital_id = ? AND a.status = 'active' ${ward ? 'AND a.ward_id = ?' : ''}${extra.length ? ` AND ${extra.join(' AND ')}` : ''}
          ORDER BY w.name_ar, a.room, a.bed_no`,
    args: [since24, s.user.hospital_id, ...(ward ? [ward] : []), ...extraArgs],
  });
  return c.json(
    rows.rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const mews = r.v_at
        ? calcMews({ bp_systolic: num(r.bp_systolic), pulse: num(r.pulse), respiratory_rate: num(r.respiratory_rate), temperature: num(r.temperature), consciousness: (r.consciousness as Consciousness | null) ?? null })
        : null;
      return {
        admission_id: r.admission_id,
        admitted_at: r.admitted_at,
        reason: r.reason,
        room: r.room,
        bed_no: r.bed_no,
        ward_id: r.ward_id,
        ward_name_ar: r.ward_name_ar,
        ward_name_en: r.ward_name_en,
        patient_id: r.patient_id,
        full_name_ar: r.full_name_ar,
        full_name_en: r.full_name_en,
        file_number: r.file_number,
        birth_date: r.birth_date,
        gender: r.gender,
        allergies: parseList(r.allergies_json),
        alerts: parseList(r.critical_alerts_json),
        nurse_ar: r.nurse_ar ?? null,
        nurse_en: r.nurse_en ?? null,
        nurse_id: r.nurse_id ?? null,
        nursing_instructions: r.nursing_instructions ?? null,
        vitals_interval_hours: num(r.vitals_interval_hours),
        doctor_ar: r.doctor_ar,
        doctor_en: r.doctor_en,
        diagnoses_ar: r.diagnoses_ar || null,
        diagnoses_en: r.diagnoses_en || null,
        vitals: r.v_at
          ? { recorded_at: r.v_at, temperature: num(r.temperature), pulse: num(r.pulse), respiratory_rate: num(r.respiratory_rate), bp_systolic: num(r.bp_systolic), bp_diastolic: num(r.bp_diastolic), spo2: num(r.spo2), pain_score: num(r.pain_score), consciousness: r.consciousness ?? null }
          : null,
        mews: mews ? { score: mews.score, level: mews.level } : null,
        pending_labs: Number(r.pending_labs ?? 0),
        abnormal_labs_24h: Number(r.abnormal_labs_24h ?? 0),
        pending_radiology: Number(r.pending_radiology ?? 0),
        active_meds: Number(r.active_meds ?? 0),
        last_nursing_note: r.last_nursing_note ?? null,
        handover: r.h_id
          ? { id: r.h_id, situation: r.situation, background: r.background, assessment: r.assessment, recommendation: r.recommendation, author: r.h_author, created_at: r.h_at }
          : null,
      };
    }),
  );
});

const HandoverSchema = z.object({
  situation: z.string().trim().min(2).max(1000),
  background: z.string().trim().max(1000).optional().nullable(),
  assessment: z.string().trim().max(1000).optional().nullable(),
  recommendation: z.string().trim().max(1000).optional().nullable(),
});

handoverRoutes.post('/:admissionId', requireAuth(), requirePermission('notes.write.nursing', 'notes.write.doctor'), async (c) => {
  const parsed = await parseBody(c, HandoverSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as z.infer<typeof HandoverSchema>;
  const s = getSession(c)!;
  const scope = await getAdmissionScope(c.req.param('admissionId'), s.user.hospital_id);
  if (!scope) return c.json({ message: 'التنويم غير موجود' }, 404);
  if (scope.admission.status !== 'active') return c.json({ message: 'التنويم غير نشط' }, 409);
  const id = uuid('ho');
  const at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO handover_notes (id, admission_id, situation, background, assessment, recommendation, author, author_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, scope.admission.id, input.situation, input.background || null, input.assessment || null, input.recommendation || null, s.user.full_name_ar, s.user.id, at],
  });
  await addTimeline({ admissionId: scope.admission.id, actor: s.user.full_name_ar, actorId: s.user.id, type: 'note', titleAr: 'تسليم مناوبة', titleEn: 'Shift handover' }, at);
  await writeAudit({ actorId: s.user.id, action: 'handover_written', resourceType: 'handover_note', resourceId: id, ip: clientIp(c) });
  return c.json({ id, admission_id: scope.admission.id, ...input, author: s.user.full_name_ar, created_at: at }, 201);
});
