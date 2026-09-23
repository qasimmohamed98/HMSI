import { Hono } from 'hono';
import { getWards } from '../repos/wardRepo.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const wardRoutes = new Hono();

wardRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  return c.json(await getWards(), 200);
});