import { Hono } from 'hono';
import { ReportRangeSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getReportOverview } from '../repos/reportsRepo.js';
import { getDetailedReport, REPORT_TYPES, type ReportType } from '../repos/reportsDetail.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';

export const reportRoutes = new Hono();

reportRoutes.get('/overview', requireAuth(), requirePermission('reports.view'), async (c) => {
  const parsed = ReportRangeSchema.safeParse({ from: c.req.query('from'), to: c.req.query('to') });
  if (!parsed.success) return c.json({ message: parsed.error.issues[0]?.message ?? 'مدى تاريخ غير صالح' }, 422);
  const session = getSession(c)!;
  return c.json(await getReportOverview(parsed.data.from, parsed.data.to, session.user.hospital_id), 200);
});

/** تقرير تفصيلي بالصفوف: /api/reports/detail/:type?from&to&tz&department&doctor */
reportRoutes.get('/detail/:type', requireAuth(), requirePermission('reports.view'), async (c) => {
  const type = c.req.param('type') as ReportType;
  if (!(REPORT_TYPES as readonly string[]).includes(type)) return c.json({ message: 'نوع التقرير غير معروف' }, 404);
  const parsed = ReportRangeSchema.safeParse({ from: c.req.query('from'), to: c.req.query('to') });
  if (!parsed.success) return c.json({ message: parsed.error.issues[0]?.message ?? 'مدى تاريخ غير صالح' }, 422);
  const tz = Number(c.req.query('tz') ?? 180);
  const session = getSession(c)!;
  const report = await getDetailedReport(type, session.user.hospital_id, {
    from: parsed.data.from,
    to: parsed.data.to,
    tzMinutes: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : 180,
    departmentId: c.req.query('department') || undefined,
    doctorId: c.req.query('doctor') || undefined,
  });
  await writeAudit({ actorId: session.user.id, action: 'report_viewed', resourceType: 'report', resourceId: type, ip: clientIp(c), meta: { from: parsed.data.from, to: parsed.data.to } });
  return c.json(report, 200);
});
