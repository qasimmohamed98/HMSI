import { Hono } from 'hono';
import { getDashboard } from '../repos/dashboardRepo.js';
import { getSession, requireAuth } from '../middleware/auth.js';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/stats', requireAuth(), async (c) => {
  const session = getSession(c)!;
  return c.json(await getDashboard(session.user.hospital_id), 200);
});