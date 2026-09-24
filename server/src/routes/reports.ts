import { Hono } from 'hono';
import { ReportRangeSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getReportOverview } from '../repos/reportsRepo.js';

export const reportRoutes = new Hono();

reportRoutes.get('/overview', requireAuth(), requirePermission('reports.view'), async (c) => {
  const parsed = ReportRangeSchema.safeParse({ from: c.req.query('from'), to: c.req.query('to') });
  if (!parsed.success) return c.json({ message: parsed.error.issues[0]?.message ?? 'مدى تاريخ غير صالح' }, 422);
  const session = getSession(c)!;
  return c.json(await getReportOverview(parsed.data.from, parsed.data.to, session.user.hospital_id), 200);
});
