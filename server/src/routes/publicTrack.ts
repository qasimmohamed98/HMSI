import { Hono } from 'hono';
import { FamilyPinSchema } from '@hmsi/shared/validate';
import { getPublicTrack, getFamilyTrack } from '../repos/trackRepo.js';
import { isBruteForced, recordLoginAttempt } from '../middleware/security.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';

/**
 * صفحة متابعة ذوي المريض (مسح QR السرير) — بدون تسجيل دخول.
 * - GET: موقع السرير وحالة التنويم والأحرف الأولى فقط.
 * - POST family: الاسم الكامل والطبيب وآخر علامات حيوية بعد إدخال رمز العائلة (6 أرقام).
 * محاولات الرمز محدودة: 5 لكل عنوان و20 للسرير خلال 15 دقيقة.
 */
export const publicTrackRoutes = new Hono();

const CODE_RE = /^[a-z0-9]{6,32}$/i;

publicTrackRoutes.get('/track/:code', async (c) => {
  const code = c.req.param('code');
  if (!CODE_RE.test(code)) return c.json({ message: 'الرمز غير صالح' }, 404);
  const info = await getPublicTrack(code);
  if (!info) return c.json({ message: 'السرير غير موجود' }, 404);
  return c.json(info, 200);
});

publicTrackRoutes.post('/track/:code/family', async (c) => {
  const code = c.req.param('code');
  if (!CODE_RE.test(code)) return c.json({ message: 'الرمز غير صالح' }, 404);
  const parsed = await parseBody(c, FamilyPinSchema);
  if (!parsed.ok) return parsed.json;
  const { pin } = parsed.data as { pin: string };

  const ip = clientIp(c);
  const key = `track:${code}`;
  if (await isBruteForced(key, ip, 5, 20)) {
    return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  }

  const result = await getFamilyTrack(code, pin);
  if (!result.ok) {
    if (result.reason === 'not_found') return c.json({ message: 'السرير غير موجود' }, 404);
    await recordLoginAttempt(key, ip, false);
    return c.json({ message: 'رمز العائلة غير صحيح' }, 403);
  }
  await recordLoginAttempt(key, ip, true);
  await writeAudit({ actorId: null, action: 'family_track_viewed', resourceType: 'bed', resourceId: code, ip });
  return c.json(result.data, 200);
});
