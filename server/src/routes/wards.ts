import { Hono } from 'hono';
import { getWards } from '../repos/wardRepo.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';

export const wardRoutes = new Hono();

wardRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  return c.json(await getWards(session.user.hospital_id), 200);
});