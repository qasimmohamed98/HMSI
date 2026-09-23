import { Hono } from 'hono';
import { CreateVitalsSchema, UpdateVitalsSchema } from '@hmsi/shared/validate';
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
  const scope = await getAdmissionScope(input.admission_id, session.user.hospital_id);
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

vitalsRoutes.patch('/:id', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, UpdateVitalsSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateVitalsSchema)['_output'];
  const id = c.req.param('id')!;
  const session = getSession(c)!;

  const rows = await db.execute({ sql: `SELECT * FROM vitals WHERE id = ? LIMIT 1`, args: [id] });
  if (rows.rows.length === 0) return c.json({ message: 'السجل غير موجود' }, 404);
  const row = rows.rows[0] as Record<string, unknown>;
  const scope = await getAdmissionScope(String(row.admission_id), session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const cols: Record<string, keyof typeof input> = {
    temperature: 'temperature',
    pulse: 'pulse',
    respiratory_rate: 'respiratory_rate',
    bp_systolic: 'bp_systolic',
    bp_diastolic: 'bp_diastolic',
    spo2: 'spo2',
    weight: 'weight',
    glucose: 'glucose',
  };
  for (const [col, key] of Object.entries(cols)) {
    const v = input[key];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v === null ? null : Number(v));
    }
  }
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  args.push(id);
  await db.execute({ sql: `UPDATE vitals SET ${sets.join(', ')} WHERE id = ?`, args });
  await addTimeline({ admissionId: String(row.admission_id), actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'تعديل علامات حيوية', titleEn: 'Vitals updated' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'vitals_updated', resourceType: 'vitals', resourceId: id, ip: c.req.header('x-forwarded-for') });
  const updated = await db.execute({ sql: `SELECT * FROM vitals WHERE id = ? LIMIT 1`, args: [id] });
  return c.json(updated.rows[0], 200);
});

vitalsRoutes.delete('/:id', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const rows = await db.execute({ sql: `SELECT admission_id FROM vitals WHERE id = ? LIMIT 1`, args: [id] });
  if (rows.rows.length === 0) return c.json({ message: 'السجل غير موجود' }, 404);
  const admissionId = String((rows.rows[0] as Record<string, unknown>).admission_id);
  const scope = await getAdmissionScope(admissionId, session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  await db.execute({ sql: `DELETE FROM vitals WHERE id = ?`, args: [id] });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'حذف علامات حيوية', titleEn: 'Vitals deleted' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'vitals_deleted', resourceType: 'vitals', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.body(null, 204);
});