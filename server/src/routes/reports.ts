import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getReportOverview } from '../repos/reportsRepo.js';

export const reportRoutes = new Hono();

reportRoutes.get('/overview', requireAuth(), requirePermission('reports.view'), async (c) => {
  const session = getSession(c)!;
  return c.json(await getReportOverview(from, to, session.user.hospital_id), 200);
});