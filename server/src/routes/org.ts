import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  CreateWardSchema,
  UpdateWardSchema,
  CreateBedSchema,
  UpdateBedSchema,
} from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createWard,
  updateWard,
  deleteWard,
  createBed,
  updateBed,
  deleteBed,
  listUnassigned,
  assignBed,
  freeBed,
  occupiedByPatient,
} from '../repos/orgRepo.js';
import { HttpConflict } from '../lib/errors.js';
import { clientIp } from '../config.js';

export const orgRoutes = new Hono();

const AssignBedSchema = z.object({ admission_id: z.string().min(1).max(64) });

async function conflict(c: Context, e: unknown): Promise<Response | null> {
  if (e instanceof HttpConflict) return c.json({ message: e.message }, 409);
  throw e;
}

const actorIp = (c: Context) => clientIp(c);

// ------------------------------ الأقسام

orgRoutes.get('/departments', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  return c.json(await listDepartments(session.user.hospital_id), 200);
});

orgRoutes.post('/departments', requireAuth(), requirePermission('departments.manage'), async (c) => {
  const parsed = await parseBody(c, CreateDepartmentSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateDepartmentSchema)['_output'];
  const session = getSession(c)!;
  const created = await createDepartment(input, session.user.hospital_id);
  await writeAudit({ actorId: session.user.id, action: 'department_created', resourceType: 'department', resourceId: created.id, ip: actorIp(c) });
  return c.json(created, 201);
});

orgRoutes.patch('/departments/:id', requireAuth(), requirePermission('departments.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateDepartmentSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateDepartmentSchema)['_output'];
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const updated = await updateDepartment(id, session.user.hospital_id, input);
  if (!updated) return c.json({ message: 'القسم غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'department_updated', resourceType: 'department', resourceId: id, ip: actorIp(c) });
  return c.json(updated, 200);
});

orgRoutes.delete('/departments/:id', requireAuth(), requirePermission('departments.manage'), async (c) => {
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  try {
    const ok = await deleteDepartment(id, session.user.hospital_id, { id: session.user.id, name: session.user.full_name_ar });
    if (!ok) return c.json({ message: 'القسم غير موجود' }, 404);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'department_deleted', resourceType: 'department', resourceId: id, ip: actorIp(c) });
  return c.body(null, 204);
});

// ------------------------------ الردهات

orgRoutes.post('/wards', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const parsed = await parseBody(c, CreateWardSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateWardSchema)['_output'];
  const session = getSession(c)!;
  try {
    const created = await createWard(input, session.user.hospital_id);
    if (!created) return c.json({ message: 'القسم غير موجود' }, 404);
    await writeAudit({ actorId: session.user.id, action: 'ward_created', resourceType: 'ward', resourceId: created.id, ip: actorIp(c) });
    return c.json(created, 201);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
});

orgRoutes.patch('/wards/:id', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateWardSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateWardSchema)['_output'];
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const updated = await updateWard(id, session.user.hospital_id, input);
  if (!updated) return c.json({ message: 'الردهة غير موجودة' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'ward_updated', resourceType: 'ward', resourceId: id, ip: actorIp(c) });
  return c.json(updated, 200);
});

orgRoutes.delete('/wards/:id', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  try {
    const ok = await deleteWard(id, session.user.hospital_id, { id: session.user.id, name: session.user.full_name_ar });
    if (!ok) return c.json({ message: 'الردهة غير موجودة' }, 404);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'ward_deleted', resourceType: 'ward', resourceId: id, ip: actorIp(c) });
  return c.body(null, 204);
});

// ------------------------------ الأسرّة

orgRoutes.post('/beds', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const parsed = await parseBody(c, CreateBedSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateBedSchema)['_output'];
  const session = getSession(c)!;
  try {
    const created = await createBed(input, session.user.hospital_id);
    await writeAudit({ actorId: session.user.id, action: 'bed_created', resourceType: 'bed', resourceId: created.id, ip: actorIp(c) });
    return c.json(created, 201);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
});

orgRoutes.patch('/beds/:id', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateBedSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateBedSchema)['_output'];
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const updated = await updateBed(id, session.user.hospital_id, input);
  if (!updated) return c.json({ message: 'السرير غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'bed_updated', resourceType: 'bed', resourceId: id, ip: actorIp(c) });
  return c.json(updated, 200);
});

orgRoutes.delete('/beds/:id', requireAuth(), requirePermission('wards.manage'), async (c) => {
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  try {
    const ok = await deleteBed(id, session.user.hospital_id, { id: session.user.id, name: session.user.full_name_ar });
    if (!ok) return c.json({ message: 'السرير غير موجود' }, 404);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'bed_deleted', resourceType: 'bed', resourceId: id, ip: actorIp(c) });
  return c.body(null, 204);
});

// ------------------------------ حجز/تحرير سرير من صفحة الأسرة

orgRoutes.get('/unassigned', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const session = getSession(c)!;
  return c.json(await listUnassigned(session.user.hospital_id), 200);
});

orgRoutes.get('/beds/:id/occupant', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const session = getSession(c)!;
  const occupant = await occupiedByPatient(c.req.param('id')!, session.user.hospital_id);
  return c.json({ occupant }, 200);
});

orgRoutes.post('/beds/:id/assign', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const parsed = await parseBody(c, AssignBedSchema);
  if (!parsed.ok) return parsed.json;
  const { admission_id } = parsed.data as { admission_id: string };
  const bedId = c.req.param('id')!;
  const session = getSession(c)!;
  try {
    await assignBed(bedId, admission_id, session.user.hospital_id);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'bed_assigned', resourceType: 'bed', resourceId: bedId, meta: { admission_id }, ip: actorIp(c) });
  return c.body(null, 204);
});

orgRoutes.post('/beds/:id/free', requireAuth(), requirePermission('admissions.manage'), async (c) => {
  const bedId = c.req.param('id')!;
  const session = getSession(c)!;
  try {
    await freeBed(bedId, session.user.hospital_id);
  } catch (e) {
    const failed = await conflict(c, e);
    if (failed) return failed;
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'bed_freed', resourceType: 'bed', resourceId: bedId, ip: actorIp(c) });
  return c.body(null, 204);
});