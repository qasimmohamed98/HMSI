import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AdmissionSummary } from '@hmsi/shared';
import { CreatePatientSchema, UpdatePatientSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission, sessionHas } from '../middleware/auth.js';
import { listPatients, getPatientById, createPatient, updatePatient, archivePatient } from '../repos/patientRepo.js';
import { getChart } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { assertPatientAccess, grantEmergencyAccess, isRestricted, EMERGENCY_ACCESS_HOURS } from '../lib/access.js';
import { notify } from '../lib/notify.js';
import { z } from 'zod';

export const patientRoutes = new Hono();

/** رمز العائلة يظهر فقط لمن يدير التنويم (استقبال/تمريض/أطباء/إدارة) */
function hidePin(c: Context, a: AdmissionSummary | null | undefined): AdmissionSummary | null {
  if (!a) return null;
  return sessionHas(c, 'admissions.manage') ? a : { ...a, family_pin: null };
}

patientRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const search = c.req.query('search')?.slice(0, 100) || undefined;
  const admitted = c.req.query('admitted') === '1';
  const session = getSession(c)!;
  const mine = c.req.query('mine') === '1';
  const list = await listPatients(session.user.hospital_id, {
    search,
    admitted,
    doctorId: isRestricted(session.user) ? session.user.id : undefined,
    nurseId: mine && session.user.role === 'nurse' ? session.user.id : undefined,
  });
  return c.json(list.map((p) => ({ ...p, activeAdmission: hidePin(c, p.activeAdmission) })), 200);
});

patientRoutes.post('/', requireAuth(), requirePermission('patients.create'), async (c) => {
  const parsed = await parseBody(c, CreatePatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreatePatientSchema)['_output'];
  const session = getSession(c)!;
  const patient = await createPatient(input, session.user.id, session.user.hospital_id);
  await writeAudit({ actorId: session.user.id, action: 'patient_created', resourceType: 'patient', resourceId: patient.id, ip: clientIp(c) });
  return c.json(patient, 201);
});

patientRoutes.get('/:id/chart', requireAuth(), requirePermission('chart.view'), async (c) => {
  const id = c.req.param('id');
  const admissionId = c.req.query('admission') || undefined;
  const session = getSession(c)!;
  const chart = await getChart(id, session.user.hospital_id, admissionId);
  if (!chart) return c.json({ message: 'المريض غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'patient_viewed', resourceType: 'patient', resourceId: id, meta: admissionId ? { admission_id: admissionId } : undefined, ip: clientIp(c) });
  return c.json(
    {
      ...chart,
      patient: { ...chart.patient, admission: hidePin(c, chart.patient.admission), activeAdmission: hidePin(c, chart.patient.activeAdmission) },
      admissions: chart.admissions.map((a) => hidePin(c, a)),
    },
    200,
  );
});

patientRoutes.get('/:id', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  const patient = await getPatientById(c.req.param('id'), session.user.hospital_id);
  if (!patient) return c.json({ message: 'المريض غير موجود' }, 404);
  await assertPatientAccess(patient.id);
  return c.json({ ...patient, activeAdmission: hidePin(c, patient.activeAdmission) }, 200);
});

/**
 * الوصول الطارئ: طبيب يحتاج ملف مريض ليس من مرضاه (طوارئ، تغطية زميل).
 * يُمنح لمدة محدودة بسبب مكتوب، ويُسجَّل في التدقيق ويُبلَّغ مدير المستشفى.
 */
const EmergencySchema = z.object({ reason: z.string().trim().min(5).max(300) });
patientRoutes.post('/:id/emergency-access', requireAuth(), requirePermission('chart.view'), async (c) => {
  const parsed = await parseBody(c, EmergencySchema);
  if (!parsed.ok) return parsed.json;
  const { reason } = parsed.data as z.infer<typeof EmergencySchema>;
  const session = getSession(c)!;
  const id = c.req.param('id');
  const patient = await getPatientById(id, session.user.hospital_id);
  if (!patient) return c.json({ message: 'المريض غير موجود' }, 404);
  const expires = await grantEmergencyAccess(session.user, id, reason);
  await writeAudit({ actorId: session.user.id, action: 'emergency_access', resourceType: 'patient', resourceId: id, meta: { reason, hours: EMERGENCY_ACCESS_HOURS }, ip: clientIp(c) });
  await notify({
    hospitalId: session.user.hospital_id,
    roles: ['admin'],
    kind: 'emergency_access',
    severity: 'warning',
    titleAr: `وصول طارئ: ${session.user.full_name_ar}`,
    titleEn: `Emergency access: ${session.user.full_name_en || session.user.full_name_ar}`,
    bodyAr: `${patient.full_name_ar} · ${reason}`,
    bodyEn: `${patient.full_name_en || patient.full_name_ar} · ${reason}`,
    link: '/audit',
    createdById: session.user.id,
  });
  return c.json({ expires_at: expires }, 201);
});

patientRoutes.patch('/:id', requireAuth(), requirePermission('patients.update'), async (c) => {
  const parsed = await parseBody(c, UpdatePatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdatePatientSchema)['_output'];
  const id = c.req.param('id');
  const session = getSession(c)!;
  await assertPatientAccess(id);
  const updated = await updatePatient(id, session.user.hospital_id, input);
  if (!updated) return c.json({ message: 'المريض غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'patient_updated', resourceType: 'patient', resourceId: id, meta: { fields: Object.keys(input) }, ip: clientIp(c) });
  return c.json({ ...updated, activeAdmission: hidePin(c, updated.activeAdmission) }, 200);
});

patientRoutes.delete('/:id', requireAuth(), requirePermission('patients.archive'), async (c) => {
  const id = c.req.param('id');
  const session = getSession(c)!;
  const archived = await archivePatient(id, session.user.hospital_id, { id: session.user.id, name: session.user.full_name_ar });
  if (!archived) return c.json({ message: 'المريض غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'patient_archived', resourceType: 'patient', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
