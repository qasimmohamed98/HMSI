import { Hono } from 'hono';
import { DischargeSchema, AdmitPatientSchema, TransferPatientSchema, FamilyShareSchema } from '@hmsi/shared/validate';
import { FAMILY_SHARE_CATEGORIES, FAMILY_SHARE_DOCTOR_ONLY, type FamilyShareCategory } from '@hmsi/shared';
import { getSession, requireAuth, requirePermission, sessionHas } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { HttpError } from '../lib/errors.js';
import { db } from '../../db/index.js';
import { admitPatient, transferAdmission, dischargeAdmission, regenerateFamilyPin } from '../repos/admissionRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { clientIp } from '../config.js';

export const admissionRoutes = new Hono();

const DischargeBody = DischargeSchema.omit({ admission_id: true });
const TransferBody = TransferPatientSchema.omit({ admission_id: true });

admissionRoutes.post('/', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const parsed = await parseBody(c, AdmitPatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AdmitPatientSchema)['_output'];
  const session = getSession(c)!;
  const result = await admitPatient(input, session.user.hospital_id);
  await addTimeline({
    admissionId: result.admission_id,
    actor: session.user.full_name_ar,
    actorId: session.user.id,
    type: 'admission',
    titleAr: 'إدخال المريض إلى المستشفى',
    titleEn: 'Patient admitted',
  });
  await writeAudit({ actorId: session.user.id, action: 'patient_admitted', resourceType: 'admission', resourceId: result.admission_id, meta: { bed_id: input.bed_id }, ip: clientIp(c) });
  return c.json(result, 201);
});

admissionRoutes.post('/:id/transfer', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const parsed = await parseBody(c, TransferBody);
  if (!parsed.ok) return parsed.json;
  const { bed_id } = parsed.data as (typeof TransferBody)['_output'];
  const admissionId = c.req.param('id');
  const session = getSession(c)!;
  await transferAdmission(admissionId, bed_id, session.user.hospital_id);
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'transfer', titleAr: 'نقل المريض إلى سرير آخر', titleEn: 'Patient transferred' });
  await writeAudit({ actorId: session.user.id, action: 'patient_transferred', resourceType: 'admission', resourceId: admissionId, meta: { bed_id }, ip: clientIp(c) });
  return c.body(null, 204);
});

admissionRoutes.post('/:id/discharge', requireAuth(), requirePermission('discharge.approve'), async (c) => {
  const parsed = await parseBody(c, DischargeBody);
  if (!parsed.ok) return parsed.json;
  const { discharge_type, summary } = parsed.data as (typeof DischargeBody)['_output'];
  const admissionId = c.req.param('id');
  const session = getSession(c)!;
  const { dischargedAt } = await dischargeAdmission(admissionId, session.user.hospital_id, { discharge_type, summary });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'discharge', titleAr: 'تسجيل خروج المريض', titleEn: 'Patient discharged' }, dischargedAt);
  await writeAudit({ actorId: session.user.id, action: 'patient_discharged', resourceType: 'admission', resourceId: admissionId, meta: { discharge_type }, ip: clientIp(c) });
  return c.body(null, 204);
});

/** إصدار رمز جديد لمتابعة ذوي المريض — يُبطل الرمز السابق */
admissionRoutes.post('/:id/family-pin', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const admissionId = c.req.param('id');
  const session = getSession(c)!;
  const pin = await regenerateFamilyPin(admissionId, session.user.hospital_id);
  await writeAudit({ actorId: session.user.id, action: 'family_pin_regenerated', resourceType: 'admission', resourceId: admissionId, ip: clientIp(c) });
  return c.json({ family_pin: pin }, 200);
});

/**
 * ما يراه ذوو المريض في صفحة المتابعة (بعد رمز العائلة).
 * الطبيب يتحكم بكل الفئات؛ التمريض بالعلامات الحيوية والرسالة فقط (الفئات السريرية قرار الطبيب).
 */
admissionRoutes.patch('/:id/family-share', requireAuth(), requirePermission('family.share'), async (c) => {
  const parsed = await parseBody(c, FamilyShareSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof FamilyShareSchema)['_output'];
  const session = getSession(c)!;
  const admissionId = c.req.param('id');
  const scope = await getAdmissionScope(admissionId, session.user.hospital_id);
  if (!scope) throw new HttpError('التنويم غير موجود', 404);
  if (scope.admission.status !== 'active') throw new HttpError('التنويم منتهٍ', 409);

  const current = scope.admission.family_share ?? {};
  const next = { ...current };
  const changed: FamilyShareCategory[] = [];
  for (const k of FAMILY_SHARE_CATEGORIES) {
    const v = input.share?.[k];
    if (v === undefined || Boolean(current[k]) === v) continue;
    if (FAMILY_SHARE_DOCTOR_ONLY.includes(k) && !sessionHas(c, 'notes.write.doctor')) {
      throw new HttpError('مشاركة المعلومات السريرية مع ذوي المريض قرار الطبيب المعالج', 403);
    }
    if (v) next[k] = true;
    else delete next[k];
    changed.push(k);
  }

  const sets = ['family_share = ?'];
  const args: (string | null)[] = [JSON.stringify(next)];
  if (input.message !== undefined) {
    const text = input.message?.trim() || null;
    sets.push('family_message = ?', 'family_message_by = ?', 'family_message_at = ?');
    args.push(text, text ? session.user.full_name_ar : null, text ? new Date().toISOString() : null);
  }
  await db.execute({ sql: `UPDATE admissions SET ${sets.join(', ')} WHERE id = ?`, args: [...args, admissionId] });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'family', titleAr: 'تحديث ما يُعرض لذوي المريض', titleEn: 'Family view updated' });
  await writeAudit({
    actorId: session.user.id,
    action: 'family_share_updated',
    resourceType: 'admission',
    resourceId: admissionId,
    ip: clientIp(c),
    meta: { share: next, changed, message: input.message !== undefined },
  });
  return c.json({ family_share: next, family_message: input.message !== undefined ? input.message?.trim() || null : (scope.admission.family_message ?? null) }, 200);
});
