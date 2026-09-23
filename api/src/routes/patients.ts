import { Hono } from 'hono';
import { CreatePatientSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { listPatients, getPatientById, createPatient } from '../repos/patientRepo.js';
import { getChart } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';

export const patientRoutes = new Hono();

patientRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const search = c.req.query('search') ?? undefined;
  const admitted = c.req.query('admitted') === '1';
  return c.json(await listPatients({ search, admitted }), 200);
});

patientRoutes.post('/', requireAuth(), requirePermission('patients.create'), async (c) => {
  const parsed = await parseBody(c, CreatePatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreatePatientSchema)['_output'];
  const session = getSession(c)!;
  const patient = await createPatient(input, session.user.id);
  await writeAudit({ actorId: session.user.id, action: 'patient_created', resourceType: 'patient', resourceId: patient.id, ip: c.req.header('x-forwarded-for') });
  return c.json(patient, 201);
});

patientRoutes.get('/:id/chart', requireAuth(), requirePermission('chart.view'), async (c) => {
  const id = c.req.param('id');
  const chart = await getChart(id);
  if (!chart) return c.json({ message: 'المريض غير موجود' }, 404);
  const session = getSession(c)!;
  await writeAudit({ actorId: session.user.id, action: 'patient_viewed', resourceType: 'patient', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json(chart, 200);
});

patientRoutes.get('/:id', requireAuth(), requirePermission('patients.view'), async (c) => {
  const id = c.req.param('id');
  const patient = await getPatientById(id);
  if (!patient) return c.json({ message: 'المريض غير موجود' }, 404);
  return c.json(patient, 200);
});