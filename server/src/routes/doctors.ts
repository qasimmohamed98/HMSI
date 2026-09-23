import { Hono } from 'hono';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { listDoctors } from '../repos/admissionRepo.js';

export const doctorRoutes = new Hono();

doctorRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  return c.json(await listDoctors(session.user.hospital_id), 200);
});