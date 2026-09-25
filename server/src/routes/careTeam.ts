import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { db, uuid, withTx } from '../../db/index.js';
import { getSession, requireAuth, requirePermission, sessionHas } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { HttpError, isUniqueViolation } from '../lib/errors.js';
import { activeTeam, addMember, activeNurseId } from '../lib/careTeam.js';
import { notify, notifyAdmission } from '../lib/notify.js';

/**
 * فريق الرعاية لكل تنويم:
 * - أطباء متعددون (تخصصات مختلفة) وأحدهم «رئيسي» (= الطبيب المعالج)
 * - ممرض واحد فعّال فقط؛ الممرض يستلم مريضاً غير معيَّن، والنقل بين الممرضين عبر التسليم والاستلام
 */
export const careTeamRoutes = new Hono();

async function scopeOr404(c: Context, admissionId: string) {
  const scope = await getAdmissionScope(admissionId, getSession(c)!.user.hospital_id);
  if (!scope) throw new HttpError('التنويم غير موجود', 404);
  return scope;
}

async function staffUser(userId: string, hospitalId: string, role: 'doctor' | 'nurse') {
  const r = await db.execute({
    sql: `SELECT id, full_name_ar, full_name_en FROM users WHERE id = ? AND hospital_id = ? AND role = ? AND is_active = 1 LIMIT 1`,
    args: [userId, hospitalId, role],
  });
  return r.rows[0] as unknown as { id: string; full_name_ar: string; full_name_en: string | null } | undefined;
}

/** الأطباء والممرضون في المستشفى مع عدد مرضاهم الحاليين */
careTeamRoutes.get('/staff', requireAuth(), requirePermission('chart.view'), async (c) => {
  const s = getSession(c)!;
  const role = c.req.query('role') === 'nurse' ? 'nurse' : 'doctor';
  const r = await db.execute({
    sql: `SELECT u.id, u.full_name_ar, u.full_name_en,
                 (SELECT COUNT(*) FROM care_team ct JOIN admissions a ON a.id = ct.admission_id
                  WHERE ct.user_id = u.id AND ct.ended_at IS NULL AND a.status = 'active') AS patients
          FROM users u WHERE u.hospital_id = ? AND u.role = ? AND u.is_active = 1
          ORDER BY u.full_name_ar`,
    args: [s.user.hospital_id, role],
  });
  return c.json(r.rows.map((x) => ({ ...(x as unknown as Record<string, unknown>), patients: Number((x as unknown as Record<string, unknown>).patients) })));
});

careTeamRoutes.get('/admissions/:id', requireAuth(), requirePermission('chart.view'), async (c) => {
  await scopeOr404(c, c.req.param('id'));
  const pending = await db.execute({
    sql: `SELECT h.id, h.to_user_id, u.full_name_ar AS to_name_ar, u.full_name_en AS to_name_en
          FROM nurse_handover_items i JOIN nurse_handovers h ON h.id = i.handover_id JOIN users u ON u.id = h.to_user_id
          WHERE i.admission_id = ? AND h.status = 'pending' LIMIT 1`,
    args: [c.req.param('id')],
  });
  return c.json({ members: await activeTeam(c.req.param('id')), pending_handover: pending.rows[0] ?? null });
});

const AddSchema = z.object({
  user_id: z.string().min(1).max(64),
  role: z.enum(['doctor', 'nurse']),
  specialty: z.string().trim().max(80).optional().nullable(),
  primary: z.boolean().optional(),
});

careTeamRoutes.post('/admissions/:id', requireAuth(), requirePermission('chart.view'), async (c) => {
  const parsed = await parseBody(c, AddSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as z.infer<typeof AddSchema>;
  const s = getSession(c)!;
  const admissionId = c.req.param('id');
  const scope = await scopeOr404(c, admissionId);
  if (scope.admission.status !== 'active') throw new HttpError('التنويم غير نشط', 409);
  const target = await staffUser(input.user_id, s.user.hospital_id, input.role);
  if (!target) throw new HttpError(input.role === 'doctor' ? 'الطبيب غير موجود في هذا المستشفى' : 'الممرض غير موجود في هذا المستشفى', 404);
  const isAdmin = sessionHas(c, 'users.manage');

  if (input.role === 'doctor') {
    // إضافة طبيب: من يدير التنويمات (الاستقبال، الأطباء في الفريق، التمريض) أو الإدارة
    if (!isAdmin && !sessionHas(c, 'admissions.manage')) throw new HttpError('لا تملك صلاحية لهذا الإجراء', 403);
  } else {
    // تعيين ممرض: الإدارة، أو ممرض لمريض غير معيَّن (لنفسه أو لزميل)
    if (!isAdmin && s.user.role !== 'nurse') throw new HttpError('تعيين التمريض من صلاحية التمريض أو الإدارة', 403);
    if (await activeNurseId(admissionId)) throw new HttpError('المريض معيَّن لممرض آخر — انقله عبر التسليم والاستلام', 409);
  }

  try {
    await withTx(async (tx) => {
      if (input.role === 'doctor' && input.primary) {
        await tx.execute({ sql: `UPDATE care_team SET is_primary = 0 WHERE admission_id = ? AND role = 'doctor' AND ended_at IS NULL`, args: [admissionId] });
        await tx.execute({ sql: `UPDATE admissions SET attending_doctor_id = ? WHERE id = ?`, args: [input.user_id, admissionId] });
      }
      await addMember(tx, { admissionId, userId: input.user_id, role: input.role, specialty: input.specialty, primary: input.primary, byId: s.user.id });
      if (input.role === 'doctor' && input.primary) {
        await tx.execute({ sql: `UPDATE care_team SET is_primary = 1 WHERE admission_id = ? AND user_id = ? AND ended_at IS NULL`, args: [admissionId, input.user_id] });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError('المريض معيَّن لممرض آخر — انقله عبر التسليم والاستلام', 409);
    throw e;
  }
  const label = input.role === 'doctor' ? `إضافة طبيب للفريق: ${target.full_name_ar}${input.specialty ? ` (${input.specialty})` : ''}` : `تعيين الممرض: ${target.full_name_ar}`;
  const labelEn = input.role === 'doctor' ? `Doctor added to care team: ${target.full_name_en || target.full_name_ar}` : `Nurse assigned: ${target.full_name_en || target.full_name_ar}`;
  await addTimeline({ admissionId, actor: s.user.full_name_ar, actorId: s.user.id, type: 'care_team', titleAr: label, titleEn: labelEn });
  await writeAudit({ actorId: s.user.id, action: 'care_team_added', resourceType: 'admission', resourceId: admissionId, meta: { user_id: input.user_id, role: input.role }, ip: clientIp(c) });
  if (input.user_id !== s.user.id) {
    await notifyAdmission(admissionId, {
      userIds: [input.user_id],
      kind: 'care_team_added',
      titleAr: input.role === 'doctor' ? 'أُضفت لفريق رعاية مريض' : 'عُيِّن لك مريض',
      titleEn: input.role === 'doctor' ? 'You were added to a care team' : 'A patient was assigned to you',
      createdById: s.user.id,
    });
  }
  return c.json({ members: await activeTeam(admissionId) }, 201);
});

const EndSchema = z.object({ reason: z.string().trim().max(200).optional().nullable() });

careTeamRoutes.post('/admissions/:id/members/:memberId/end', requireAuth(), requirePermission('chart.view'), async (c) => {
  const parsed = await parseBody(c, EndSchema);
  if (!parsed.ok) return parsed.json;
  const s = getSession(c)!;
  const admissionId = c.req.param('id');
  await scopeOr404(c, admissionId);
  const r = await db.execute({ sql: `SELECT role, user_id, is_primary FROM care_team WHERE id = ? AND admission_id = ? AND ended_at IS NULL LIMIT 1`, args: [c.req.param('memberId'), admissionId] });
  const m = r.rows[0] as unknown as { role: string; user_id: string; is_primary: number } | undefined;
  if (!m) throw new HttpError('العضو غير موجود', 404);
  const isAdmin = sessionHas(c, 'users.manage');
  // الممرض لا يترك مريضه إلا بتسليمه لزميل؛ الإدارة فقط تنهي التعيين مباشرة
  if (m.role === 'nurse' && !isAdmin) throw new HttpError('لنقل المريض لممرض آخر استخدم التسليم والاستلام', 403);
  if (m.role === 'doctor' && !isAdmin && !sessionHas(c, 'admissions.manage')) throw new HttpError('لا تملك صلاحية لهذا الإجراء', 403);
  await db.execute({ sql: `UPDATE care_team SET ended_at = ?, end_reason = ? WHERE id = ?`, args: [new Date().toISOString(), (parsed.data as { reason?: string }).reason || 'removed', c.req.param('memberId')] });
  if (Number(m.is_primary) === 1) await db.execute({ sql: `UPDATE admissions SET attending_doctor_id = NULL WHERE id = ? AND attending_doctor_id = ?`, args: [admissionId, m.user_id] });
  await addTimeline({ admissionId, actor: s.user.full_name_ar, actorId: s.user.id, type: 'care_team', titleAr: 'تعديل فريق الرعاية', titleEn: 'Care team changed' });
  await writeAudit({ actorId: s.user.id, action: 'care_team_removed', resourceType: 'admission', resourceId: admissionId, meta: { user_id: m.user_id, role: m.role }, ip: clientIp(c) });
  return c.json({ members: await activeTeam(admissionId) });
});

// ---------------------------------------------------------------- التسليم والاستلام بين الممرضين

async function handoverView(where: string, args: string[]) {
  const r = await db.execute({
    sql: `SELECT h.*, fu.full_name_ar AS from_name_ar, fu.full_name_en AS from_name_en, tu.full_name_ar AS to_name_ar, tu.full_name_en AS to_name_en
          FROM nurse_handovers h JOIN users fu ON fu.id = h.from_user_id JOIN users tu ON tu.id = h.to_user_id
          WHERE ${where} ORDER BY h.created_at DESC LIMIT 30`,
    args,
  });
  const out = [];
  for (const row of r.rows) {
    const h = row as unknown as Record<string, unknown>;
    const items = await db.execute({
      sql: `SELECT i.admission_id, p.id AS patient_id, p.full_name_ar, p.full_name_en, a.room, a.bed_no, w.name_ar AS ward_name_ar, w.name_en AS ward_name_en
            FROM nurse_handover_items i JOIN admissions a ON a.id = i.admission_id JOIN patients p ON p.id = a.patient_id LEFT JOIN wards w ON w.id = a.ward_id
            WHERE i.handover_id = ?`,
      args: [String(h.id)],
    });
    out.push({ ...h, items: items.rows });
  }
  return out;
}

careTeamRoutes.get('/handovers', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const s = getSession(c)!;
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  return c.json({
    incoming: await handoverView(`h.to_user_id = ? AND h.status = 'pending'`, [s.user.id]),
    outgoing: await handoverView(`h.from_user_id = ? AND h.status = 'pending'`, [s.user.id]),
    recent: await handoverView(`(h.to_user_id = ? OR h.from_user_id = ?) AND h.status != 'pending' AND h.created_at > ?`, [s.user.id, s.user.id, since]),
  });
});

const HandoverSchema = z.object({
  to_user_id: z.string().min(1).max(64),
  admission_ids: z.array(z.string().min(1).max(64)).min(1).max(40),
  note: z.string().trim().max(1000).optional().nullable(),
});

careTeamRoutes.post('/handovers', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, HandoverSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as z.infer<typeof HandoverSchema>;
  const s = getSession(c)!;
  if (s.user.role !== 'nurse') throw new HttpError('التسليم والاستلام بين الممرضين فقط', 403);
  if (input.to_user_id === s.user.id) throw new HttpError('اختر ممرضاً آخر للاستلام', 400);
  const to = await staffUser(input.to_user_id, s.user.hospital_id, 'nurse');
  if (!to) throw new HttpError('الممرض غير موجود في هذا المستشفى', 404);
  const ids = [...new Set(input.admission_ids)];
  for (const id of ids) {
    await scopeOr404(c, id);
    if ((await activeNurseId(id)) !== s.user.id) throw new HttpError('يمكنك تسليم مرضاك المعيَّنين لك فقط', 403);
    const busy = await db.execute({
      sql: `SELECT 1 FROM nurse_handover_items i JOIN nurse_handovers h ON h.id = i.handover_id WHERE i.admission_id = ? AND h.status = 'pending' LIMIT 1`,
      args: [id],
    });
    if (busy.rows.length) throw new HttpError('أحد المرضى في تسليم معلّق بالفعل', 409);
  }
  const hid = uuid('nh');
  await withTx(async (tx) => {
    await tx.execute({
      sql: `INSERT INTO nurse_handovers (id, hospital_id, from_user_id, to_user_id, status, note, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      args: [hid, s.user.hospital_id, s.user.id, input.to_user_id, input.note || null, new Date().toISOString()],
    });
    for (const id of ids) await tx.execute({ sql: `INSERT INTO nurse_handover_items (handover_id, admission_id) VALUES (?, ?)`, args: [hid, id] });
  });
  await writeAudit({ actorId: s.user.id, action: 'nurse_handover_sent', resourceType: 'nurse_handover', resourceId: hid, meta: { to: input.to_user_id, count: ids.length }, ip: clientIp(c) });
  await notify({
    hospitalId: s.user.hospital_id,
    userId: input.to_user_id,
    kind: 'handover_request',
    severity: 'warning',
    titleAr: `طلب استلام ${ids.length} ${ids.length === 1 ? 'مريض' : 'مرضى'} من ${s.user.full_name_ar}`,
    titleEn: `${s.user.full_name_en || s.user.full_name_ar} is handing over ${ids.length} patient(s) to you`,
    bodyAr: input.note || null,
    link: '/handover?tab=nurses',
    createdById: s.user.id,
  });
  return c.json({ id: hid }, 201);
});

async function loadPending(c: Context, id: string) {
  const r = await db.execute({ sql: `SELECT * FROM nurse_handovers WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, getSession(c)!.user.hospital_id] });
  const h = r.rows[0] as unknown as { id: string; from_user_id: string; to_user_id: string; status: string } | undefined;
  if (!h) throw new HttpError('التسليم غير موجود', 404);
  if (h.status !== 'pending') throw new HttpError('تمت معالجة هذا التسليم بالفعل', 409);
  return h;
}

careTeamRoutes.post('/handovers/:id/accept', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const s = getSession(c)!;
  const h = await loadPending(c, c.req.param('id'));
  if (h.to_user_id !== s.user.id) throw new HttpError('الاستلام للممرض المستلِم فقط', 403);
  const items = await db.execute({ sql: `SELECT admission_id FROM nurse_handover_items WHERE handover_id = ?`, args: [h.id] });
  const now = new Date().toISOString();
  const moved: string[] = [];
  await withTx(async (tx) => {
    for (const row of items.rows) {
      const aid = String((row as unknown as Record<string, unknown>).admission_id);
      const active = await tx.execute({ sql: `SELECT status FROM admissions WHERE id = ?`, args: [aid] });
      if (String((active.rows[0] as unknown as Record<string, unknown> | undefined)?.status) !== 'active') continue;
      // تنتقل المسؤولية فقط إن كان المريض ما زال مع المسلِّم
      const upd = await tx.execute({
        sql: `UPDATE care_team SET ended_at = ?, end_reason = 'handover' WHERE admission_id = ? AND user_id = ? AND role = 'nurse' AND ended_at IS NULL`,
        args: [now, aid, h.from_user_id],
      });
      if (upd.rowsAffected === 0) continue;
      await addMember(tx, { admissionId: aid, userId: s.user.id, role: 'nurse', byId: h.from_user_id });
      moved.push(aid);
    }
    await tx.execute({ sql: `UPDATE nurse_handovers SET status = 'accepted', responded_at = ? WHERE id = ?`, args: [now, h.id] });
  });
  const from = await db.execute({ sql: `SELECT full_name_ar, full_name_en FROM users WHERE id = ?`, args: [h.from_user_id] });
  const fromName = String((from.rows[0] as unknown as Record<string, unknown>)?.full_name_ar ?? '');
  for (const aid of moved) {
    await addTimeline({ admissionId: aid, actor: s.user.full_name_ar, actorId: s.user.id, type: 'care_team', titleAr: `استلام التمريض من ${fromName}`, titleEn: 'Nursing handover accepted' });
  }
  await writeAudit({ actorId: s.user.id, action: 'nurse_handover_accepted', resourceType: 'nurse_handover', resourceId: h.id, meta: { moved: moved.length }, ip: clientIp(c) });
  await notify({
    hospitalId: s.user.hospital_id,
    userId: h.from_user_id,
    kind: 'handover_accepted',
    titleAr: `${s.user.full_name_ar} استلم المرضى (${moved.length})`,
    titleEn: `${s.user.full_name_en || s.user.full_name_ar} accepted the handover (${moved.length})`,
    link: '/handover?tab=nurses',
    createdById: s.user.id,
  });
  return c.json({ moved: moved.length });
});

const RejectSchema = z.object({ reason: z.string().trim().min(2).max(300) });

careTeamRoutes.post('/handovers/:id/reject', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, RejectSchema);
  if (!parsed.ok) return parsed.json;
  const s = getSession(c)!;
  const h = await loadPending(c, c.req.param('id'));
  if (h.to_user_id !== s.user.id) throw new HttpError('الرفض للممرض المستلِم فقط', 403);
  const reason = (parsed.data as { reason: string }).reason;
  await db.execute({ sql: `UPDATE nurse_handovers SET status = 'rejected', response_note = ?, responded_at = ? WHERE id = ?`, args: [reason, new Date().toISOString(), h.id] });
  await writeAudit({ actorId: s.user.id, action: 'nurse_handover_rejected', resourceType: 'nurse_handover', resourceId: h.id, meta: { reason }, ip: clientIp(c) });
  await notify({
    hospitalId: s.user.hospital_id,
    userId: h.from_user_id,
    kind: 'handover_rejected',
    severity: 'warning',
    titleAr: `${s.user.full_name_ar} رفض الاستلام`,
    titleEn: `${s.user.full_name_en || s.user.full_name_ar} declined the handover`,
    bodyAr: reason,
    link: '/handover?tab=nurses',
    createdById: s.user.id,
  });
  return c.body(null, 204);
});

careTeamRoutes.post('/handovers/:id/cancel', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const s = getSession(c)!;
  const h = await loadPending(c, c.req.param('id'));
  if (h.from_user_id !== s.user.id) throw new HttpError('الإلغاء للممرض المسلِّم فقط', 403);
  await db.execute({ sql: `UPDATE nurse_handovers SET status = 'cancelled', responded_at = ? WHERE id = ?`, args: [new Date().toISOString(), h.id] });
  await writeAudit({ actorId: s.user.id, action: 'nurse_handover_cancelled', resourceType: 'nurse_handover', resourceId: h.id, ip: clientIp(c) });
  return c.body(null, 204);
});

// ---------------------------------------------------------------- الخطة العلاجية

const PlanSchema = z.object({
  goals: z.string().trim().max(2000).optional().nullable(),
  diet: z.string().trim().max(500).optional().nullable(),
  activity: z.string().trim().max(500).optional().nullable(),
  monitoring: z.string().trim().max(1000).optional().nullable(),
  nursing_instructions: z.string().trim().max(2000).optional().nullable(),
  vitals_interval_hours: z.number().int().min(1).max(24).optional().nullable(),
  review_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
});

careTeamRoutes.get('/plans/:id', requireAuth(), requirePermission('chart.view'), async (c) => {
  await scopeOr404(c, c.req.param('id'));
  const r = await db.execute({ sql: `SELECT * FROM care_plans WHERE admission_id = ?`, args: [c.req.param('id')] });
  return c.json(r.rows[0] ?? null);
});

careTeamRoutes.put('/plans/:id', requireAuth(), async (c) => {
  const s = getSession(c)!;
  // الخطة العلاجية يضعها الطبيب؛ الممرض يعدّل تكرار قياس العلامات الحيوية فقط
  const doctor = sessionHas(c, 'notes.write.doctor');
  const nurse = sessionHas(c, 'vitals.write');
  if (!doctor && !nurse) throw new HttpError('لا تملك صلاحية لهذا الإجراء', 403);
  const parsed = await parseBody(c, PlanSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as z.infer<typeof PlanSchema>;
  const admissionId = c.req.param('id');
  const scope = await scopeOr404(c, admissionId);
  if (scope.admission.status !== 'active') throw new HttpError('التنويم غير نشط', 409);
  const cur = ((await db.execute({ sql: `SELECT * FROM care_plans WHERE admission_id = ?`, args: [admissionId] })).rows[0] ?? {}) as Record<string, unknown>;
  const pick = (k: keyof typeof input) => (doctor ? (input[k] === undefined ? cur[k] ?? null : input[k] ?? null) : cur[k] ?? null);
  const interval = input.vitals_interval_hours === undefined ? cur.vitals_interval_hours ?? null : input.vitals_interval_hours;
  await db.execute({
    sql: `INSERT INTO care_plans (admission_id, goals, diet, activity, monitoring, nursing_instructions, vitals_interval_hours, review_at, updated_by, updated_by_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(admission_id) DO UPDATE SET goals = excluded.goals, diet = excluded.diet, activity = excluded.activity, monitoring = excluded.monitoring,
            nursing_instructions = excluded.nursing_instructions, vitals_interval_hours = excluded.vitals_interval_hours, review_at = excluded.review_at,
            updated_by = excluded.updated_by, updated_by_id = excluded.updated_by_id, updated_at = excluded.updated_at`,
    args: [
      admissionId,
      pick('goals') as string | null,
      pick('diet') as string | null,
      pick('activity') as string | null,
      pick('monitoring') as string | null,
      pick('nursing_instructions') as string | null,
      interval as number | null,
      pick('review_at') as string | null,
      s.user.full_name_ar,
      s.user.id,
      new Date().toISOString(),
    ],
  });
  await addTimeline({ admissionId, actor: s.user.full_name_ar, actorId: s.user.id, type: 'plan', titleAr: 'تحديث الخطة العلاجية', titleEn: 'Care plan updated' });
  await writeAudit({ actorId: s.user.id, action: 'care_plan_updated', resourceType: 'admission', resourceId: admissionId, ip: clientIp(c) });
  await notifyAdmission(admissionId, {
    toNurse: true,
    kind: 'care_plan_updated',
    titleAr: 'تحديث الخطة العلاجية',
    titleEn: 'Care plan updated',
    createdById: s.user.id,
  });
  return c.json((await db.execute({ sql: `SELECT * FROM care_plans WHERE admission_id = ?`, args: [admissionId] })).rows[0]);
});
