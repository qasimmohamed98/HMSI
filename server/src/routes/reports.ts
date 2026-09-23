import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getReportOverview } from '../repos/reportsRepo.js';

export const reportRoutes = new Hono();

reportRoutes.get('/overview', requireAuth(), requirePermission('reports.view'), async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = c.req.query('from') ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ message: 'تاريخ غير صالح' }, 400);
  }
  return c.json(await getReportOverview(from, to), 200);
});