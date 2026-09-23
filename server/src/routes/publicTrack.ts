import { Hono } from 'hono';
import { getPublicTrackByBedCode } from '../repos/orgRepo.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';

export const publicTrackRoutes = new Hono();

publicTrackRoutes.get('/beds/:code/chart', requireAuth(), async (c) => {
  const code = c.req.param('code');
  const session = getSession(c)!;
  const track = await getPublicTrackByBedCode(code, session.user.hospital_id);
  if (!track) return c.json({ message: 'السرير أو الكود غير موجود' }, 404);
  return c.json(track, 200);
});