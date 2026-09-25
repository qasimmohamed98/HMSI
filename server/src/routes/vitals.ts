import { Hono } from 'hono';
import { CreateVitalsSchema, UpdateVitalsSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { db, uuid } from '../../db/index.js';
import { clientIp } from '../config.js';
import { resolveRecordedAt, existingClientRecord } from '../lib/offline.js';
import { moveToTrash } from '../lib/trash.js';

export const vitalsRoutes = new Hono();

vitalsRoutes.post('/', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const parsed = await parseBody(c, CreateVitalsSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateVitalsSchema)['_output'];
  const session = getSession(c)!;
  const scope = await getAdmissionScope(input.admission_id, session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  // إعادة إرسال نفس الإدخال من طابور العمل دون اتصال تعيد السجل الموجود
  const id = input.client_id ?? uuid('vt');
  if (input.client_id && (await existingClientRecord('vitals', id, input.admission_id))) {
    return c.json(await fetchVitals(id), 200);
  }
  if (scope.admission.status !== 'active') return c.json({ message: 'التنويم منتهٍ — لا يمكن تسجيل علامات حيوية' }, 409);
  const recordedAt = resolveRecordedAt(input.recorded_at);
  await db.execute({
    sql: `INSERT INTO vitals (id, admission_id, recorded_by, recorded_at, temperature, pulse, respiratory_rate, bp_systolic, bp_diastolic, spo2, weight, glucose, pain_score, consciousness)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.pain_score ?? null,
      input.consciousness ?? null,
    ],
  });
  await addTimeline({ admissionId: input.admission_id, actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'تسجيل علامات حيوية', titleEn: 'Vitals recorded' }, recordedAt);
  await writeAudit({ actorId: session.user.id, action: 'vitals_added', resourceType: 'vitals', resourceId: id, ip: clientIp(c) });
  return c.json(await fetchVitals(id), 201);
});

async function fetchVitals(id: string): Promise<Record<string, unknown>> {
  const rows = await db.execute({ sql: `SELECT * FROM vitals WHERE id = ? LIMIT 1`, args: [id] });
  return { ...(rows.rows[0] as Record<string, unknown>) };
}

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
    pain_score: 'pain_score',
  };
  for (const [col, key] of Object.entries(cols)) {
    const v = input[key];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v === null ? null : Number(v));
    }
  }
  if (input.consciousness !== undefined) {
    sets.push('consciousness = ?');
    args.push(input.consciousness);
  }
  if (sets.length === 0) return c.json({ message: 'لا توجد بيانات للتحديث' }, 400);
  args.push(id);
  await db.execute({ sql: `UPDATE vitals SET ${sets.join(', ')} WHERE id = ?`, args });
  await addTimeline({ admissionId: String(row.admission_id), actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'تعديل علامات حيوية', titleEn: 'Vitals updated' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'vitals_updated', resourceType: 'vitals', resourceId: id, ip: clientIp(c) });
  return c.json(await fetchVitals(id), 200);
});

vitalsRoutes.delete('/:id', requireAuth(), requirePermission('vitals.write'), async (c) => {
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const rows = await db.execute({ sql: `SELECT admission_id, recorded_at FROM vitals WHERE id = ? LIMIT 1`, args: [id] });
  if (rows.rows.length === 0) return c.json({ message: 'السجل غير موجود' }, 404);
  const admissionId = String((rows.rows[0] as Record<string, unknown>).admission_id);
  const scope = await getAdmissionScope(admissionId, session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  const at = String((rows.rows[0] as Record<string, unknown>).recorded_at).slice(0, 16).replace('T', ' ');
  await moveToTrash({ table: 'vitals', id, hospitalId: session.user.hospital_id, kind: 'vitals', label: at, actor: { id: session.user.id, name: session.user.full_name_ar }, admissionId });
  await addTimeline({ admissionId, actor: session.user.full_name_ar, actorId: session.user.id, type: 'vitals', titleAr: 'حذف علامات حيوية', titleEn: 'Vitals deleted' }, new Date().toISOString());
  await writeAudit({ actorId: session.user.id, action: 'vitals_deleted', resourceType: 'vitals', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});