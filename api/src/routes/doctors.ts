import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { listDoctors } from '../repos/admissionRepo.js';

export const doctorRoutes = new Hono();

doctorRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  return c.json(await listDoctors(), 200);
});