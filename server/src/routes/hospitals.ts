import { Hono } from 'hono';
import { z } from 'zod';
import { UpdateHospitalSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import {
  listHospitals,
  createHospital,
  createHospitalAdmin,
  getHospital,
  updateHospital,
} from '../repos/orgRepo.js';

export const hospitalRoutes = new Hono();

hospitalRoutes.get('/me', requireAuth(), async (c) => {
  const hospital = await getHospital(getSession(c)!.user.hospital_id);
  if (!hospital) return c.json({ message: 'المستشفى غير موجود' }, 404);
  return c.json(hospital, 200);
});

hospitalRoutes.patch('/me', requireAuth(), requirePermission('settings.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateHospitalSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateHospitalSchema)['_output'];
  const session = getSession(c)!;
  const hospital = await updateHospital(session.user.hospital_id, input);
  if (!hospital) return c.json({ message: 'المستشفى غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'settings_changed', resourceType: 'hospital', resourceId: hospital.id, meta: input, ip: c.req.header('x-forwarded-for') });
  return c.json(hospital, 200);
});

// ------------------------------ مدير النظام (super_admin only)

const hospitalIdSchema = z.object({ id: z.string().min(1) });

hospitalRoutes.get('/', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const hospitals = await listHospitals();
  return c.json(hospitals, 200);
});

hospitalRoutes.post('/', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, CreateHospitalSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateHospitalSchema)['_output'];
  const hospital = await createHospital(input, getSession(c)!.user.id);
  await writeAudit({ actorId: getSession(c)!.user.id, action: 'hospital_created', resourceType: 'hospital', resourceId: hospital.id, ip: c.req.header('x-forwarded-for') });
  return c.json(hospital, 201);
});

hospitalRoutes.post('/:id/admins', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const { id } = c.req.param();
  const parsed = await parseBody(c, CreateHospitalAdminSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateHospitalAdminSchema)['_output'];
  const admin = await createHospitalAdmin(id, input, getSession(c)!.user.id);
  await writeAudit({ actorId: getSession(c)!.user.id, action: 'hospital_admin_created', resourceType: 'hospital_admin', resourceId: admin.id, ip: c.req.header('x-forwarded-for') });
  return c.json(admin, 201);
});