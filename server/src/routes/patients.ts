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
  const list = await listPatients(session.user.hospital_id, { search, admitted });
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
  return c.json({ ...patient, activeAdmission: hidePin(c, patient.activeAdmission) }, 200);
});

patientRoutes.patch('/:id', requireAuth(), requirePermission('patients.update'), async (c) => {
  const parsed = await parseBody(c, UpdatePatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdatePatientSchema)['_output'];
  const id = c.req.param('id');
  const session = getSession(c)!;
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
