import { Hono } from 'hono';
import { CreateVitalsSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { db, uuid } from '../../db/index.js';

export const vitalsRoutes = new Hono();

vitalsRoutes.post('/', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, CreateVitalsSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateVitalsSchema)['_output'];
  const session = getSession(c)!;
  const scope = await getAdmissionScope(input.admission_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);

  const id = uuid('vt');
  const recordedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO vitals (id, admission_id, recorded_by, recorded_at, temperature, pulse, respiratory_rate, bp_systolic, bp_diastolic, spo2, weight, glucose)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.admission_id,
      session.user.full_name_ar,
      recordedAt,
      input.temperature ?? null,
      input.pulse ?? null,
      input.respiratory_rate ?? null,
      input.bp_systolic ?? null,
      input.bp_diastolic ?? null,
      input.spo2 ?? null,
      input.weight ?? null,
      input.glucose ?? null,
    ],
  });
  await addTimeline({ admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'تسجيل علامات حيوية', titleEn: 'Vitals recorded' }, recordedAt);
  await writeAudit({ actorId: session.user.id, action: 'vitals_added', resourceType: 'vitals', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.json(
    {
      id,
      admission_id: input.admission_id,
      recorded_at: recordedAt,
      temperature: input.temperature ?? null,
      pulse: input.pulse ?? null,
      respiratory_rate: input.respiratory_rate ?? null,
      bp_systolic: input.bp_systolic ?? null,
      bp_diastolic: input.bp_diastolic ?? null,
      spo2: input.spo2 ?? null,
      weight: input.weight ?? null,
      glucose: input.glucose ?? null,
      recorded_by: session.user.full_name_ar,
    },
    201,
  );
});