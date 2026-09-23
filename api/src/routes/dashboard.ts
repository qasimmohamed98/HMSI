import { Hono } from 'hono';
import { getDashboard } from '../repos/dashboardRepo.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/stats', requireAuth(), async (c) => {
  return c.json(await getDashboard(), 200);
});