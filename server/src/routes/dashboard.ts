import { Hono } from 'hono';
import { getDashboard } from '../repos/dashboardRepo.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';

export const dashboardRoutes = new Hono();

// فيها أسماء مرضى (الإنذار المبكر، آخر النشاطات): لمن يحق له رؤية المرضى فقط
dashboardRoutes.get('/stats', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  return c.json(await getDashboard(session.user.hospital_id, session.user.role === 'doctor' ? session.user.id : undefined), 200);
});