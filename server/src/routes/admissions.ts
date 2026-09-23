import { Hono } from 'hono';
import type { Context } from 'hono';
import { DischargeSchema, AdmitPatientSchema, TransferPatientSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { admitPatient, transferAdmission, HttpConflict } from '../repos/admissionRepo.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { db } from '../../db/index.js';

export const admissionRoutes = new Hono();

async function conflict(c: Context, e: unknown): Promise<Response | null> {
  if (e instanceof HttpConflict) return c.json({ message: e.message }, 409);
  throw e;
}

admissionRoutes.post('/', requireAuth(), requirePermission('admissions.manage'), async (c: Context) => {
  const parsed = await parseBody(c, AdmitPatientSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AdmitPatientSchema)['_output'];
  const session = getSession(c)!;
  try {
    const result = await admitPatient(input, session.user.hospital_id);
    await addTimeline(
      {
        admissionId: result.admission_id,
        actor: session.user.full_name_ar,
        actorId: session.user.id,
        type: 'admission',
        titleAr: 'إدخال المريض إلى المستشفى',
        titleEn: 'Patient admitted',
      },
      new Date().toISOString(),
    );
    await writeAudit({ actorId: session.user.id, action: 'patient_admitted', resourceType: 'admission', resourceId: result.admission_id, meta: { bed_id: input.bed_id }, ip: c.req.header('x-forwarded-for') });
    return c.json(result, 201);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
});

admissionRoutes.post('/:id/transfer', requireAuth(), requirePermission('admissions.manage'), async (c: Context) => {
  const parsed = await parseBody(c, TransferPatientSchema.omit({ admission_id: true }));
  if (!parsed.ok) return parsed.json;
  const { bed_id } = parsed.data as (typeof TransferPatientSchema)['_output'];
  const admissionId = c.req.param('id')!;
  const session = getSession(c)!;

  const scope = await getAdmissionScope(admissionId, session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);

  try {
    await transferAdmission(admissionId, bed_id, session.user.hospital_id);
    await addTimeline(
      {
        admissionId,
        actor: session.user.full_name_ar,
        actorId: session.user.id,
        type: 'transfer',
        titleAr: 'نقل المريض إلى سرير آخر',
        titleEn: 'Patient transferred',
      },
      new Date().toISOString(),
    );
    await writeAudit({ actorId: session.user.id, action: 'patient_transferred', resourceType: 'admission', resourceId: admissionId, meta: { bed_id }, ip: c.req.header('x-forwarded-for') });
    return c.body(null, 204);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
});

admissionRoutes.post('/:id/discharge', requireAuth(), requirePermission('discharge.approve'), async (c: Context) => {
  const parsed = await parseBody(c, DischargeSchema.omit({ admission_id: true }));
  if (!parsed.ok) return parsed.json;
  const { discharge_type, summary } = parsed.data as (typeof DischargeSchema)['_output'];
  const admissionId = c.req.param('id')!;
  const session = getSession(c)!;

  const scope = await getAdmissionScope(admissionId, session.user.hospital_id);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  if (scope.admission.status === 'discharged') return c.json({ message: 'الخروج مسجّل مسبقاً' }, 409);

  const dischargedAt = new Date().toISOString();
  const bedRows = await db.execute({ sql: `SELECT bed_id FROM admissions WHERE id = ? LIMIT 1`, args: [admissionId] });
  const oldBed = bedRows.rows.length > 0 ? String((bedRows.rows[0] as Record<string, unknown>).bed_id ?? '') : '';
  await db.execute({
    sql: `UPDATE admissions SET status = 'discharged', discharge_type = ?, discharged_at = ?, reason = ?, bed_id = NULL WHERE id = ?`,
    args: [discharge_type, dischargedAt, summary ?? null, admissionId],
  });
  await db.execute({ sql: `UPDATE patients SET status = 'discharged' WHERE id = ?`, args: [scope.patientId] });
  if (oldBed) await db.execute({ sql: `UPDATE beds SET status = 'free' WHERE id = ?`, args: [oldBed] });

  await addTimeline(
    {
      admissionId,
      actor: session.user.full_name_ar,
      actorId: session.user.id,
      type: 'discharge',
      titleAr: 'تسجيل خروج المريض',
      titleEn: 'Patient discharged',
    },
    dischargedAt,
  );
  await writeAudit({ actorId: session.user.id, action: 'patient_discharged', resourceType: 'admission', resourceId: admissionId, meta: { discharge_type }, ip: c.req.header('x-forwarded-for') });
  return c.body(null, 204);
});