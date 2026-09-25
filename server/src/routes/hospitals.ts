import { Hono } from 'hono';
import { UpdateHospitalSchema, CreateHospitalSchema, CreateHospitalAdminSchema, AdminUpdateHospitalSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { listHospitals, createHospital, createHospitalAdmin, getHospital, updateHospital, setActiveHospital, setHospitalLogo, clearHospitalLogo, MAX_LOGO_BYTES } from '../repos/hospitalRepo.js';
import { contentMatchesMime } from './attachments.js';

export const hospitalRoutes = new Hono();

// ------------------------------ المستشفى الحالي (مدير المستشفى)

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
  await writeAudit({ actorId: session.user.id, action: 'settings_changed', resourceType: 'hospital', resourceId: hospital.id, meta: input, ip: clientIp(c) });
  return c.json(hospital, 200);
});

/** رفع شعار المستشفى (multipart: file) */
hospitalRoutes.post('/me/logo', requireAuth(), requirePermission('settings.manage'), async (c) => {
  const session = getSession(c)!;
  if (Number(c.req.header('content-length') ?? 0) > MAX_LOGO_BYTES + 64 * 1024) return c.json({ message: 'حجم الشعار يتجاوز 300 كيلوبايت' }, 413);
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return c.json({ message: 'الملف مطلوب' }, 400);
  const hospital = await setHospitalLogo(session.user.hospital_id, new Uint8Array(await file.arrayBuffer()), file.type, contentMatchesMime);
  await writeAudit({ actorId: session.user.id, action: 'hospital_logo_changed', resourceType: 'hospital', resourceId: session.user.hospital_id, ip: clientIp(c) });
  return c.json(hospital, 200);
});

hospitalRoutes.delete('/me/logo', requireAuth(), requirePermission('settings.manage'), async (c) => {
  const session = getSession(c)!;
  const hospital = await clearHospitalLogo(session.user.hospital_id);
  await writeAudit({ actorId: session.user.id, action: 'hospital_logo_removed', resourceType: 'hospital', resourceId: session.user.hospital_id, ip: clientIp(c) });
  return c.json(hospital, 200);
});

// ------------------------------ المدير العام (hospitals.manage)

hospitalRoutes.get('/', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  return c.json(await listHospitals(), 200);
});

hospitalRoutes.post('/', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, CreateHospitalSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateHospitalSchema)['_output'];
  const session = getSession(c)!;
  const hospital = await createHospital(input);
  await writeAudit({ actorId: session.user.id, action: 'hospital_created', resourceType: 'hospital', resourceId: hospital.id, ip: clientIp(c) });
  return c.json(hospital, 201);
});

hospitalRoutes.patch('/:id', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, AdminUpdateHospitalSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof AdminUpdateHospitalSchema)['_output'];
  const session = getSession(c)!;
  const id = c.req.param('id');
  if (input.is_active === false && id === session.user.home_hospital_id) {
    return c.json({ message: 'لا يمكن تعطيل مستشفى المدير العام' }, 400);
  }
  if (!(await getHospital(id))) return c.json({ message: 'المستشفى غير موجود' }, 404);
  const hospital = await updateHospital(id, input);
  await writeAudit({ actorId: session.user.id, action: 'hospital_updated', resourceType: 'hospital', resourceId: id, meta: input, ip: clientIp(c) });
  return c.json(hospital, 200);
});

hospitalRoutes.post('/:id/admins', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, CreateHospitalAdminSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateHospitalAdminSchema)['_output'];
  const session = getSession(c)!;
  const admin = await createHospitalAdmin(c.req.param('id'), input);
  await writeAudit({ actorId: session.user.id, action: 'hospital_admin_created', resourceType: 'user', resourceId: admin.id, meta: { hospital_id: c.req.param('id'), username: admin.username }, ip: clientIp(c) });
  return c.json(admin, 201);
});

/** الدخول إلى مستشفى والعمل فيه كمدير (للمدير العام). استخدام مستشفاه الأصلي = العودة. */
hospitalRoutes.post('/:id/switch', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const session = getSession(c)!;
  const id = c.req.param('id');
  const hospital = await getHospital(id);
  if (!hospital) return c.json({ message: 'المستشفى غير موجود' }, 404);
  await setActiveHospital(session.sessionId, id === session.user.home_hospital_id ? null : id);
  await writeAudit({ actorId: session.user.id, action: 'hospital_switched', resourceType: 'hospital', resourceId: id, ip: clientIp(c) });
  return c.json(hospital, 200);
});
