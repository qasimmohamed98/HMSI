import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { getSession, requireAuth } from '../middleware/auth.js';
import { parseBody, z } from '../lib/validate.js';
import { pushToUsers, removeSubscription, saveSubscription, vapidKeys, type SubscribeInput } from '../lib/push.js';

/** اشتراك جهاز المستخدم في إشعارات الدفع (تصل والنظام مغلق) */
export const pushRoutes = new Hono();

/** أقصى عدد أجهزة للمستخدم الواحد (الأقدم يُحذف) */
const MAX_DEVICES = 10;

const endpoint = z.string().url('رابط الاشتراك غير صالح').max(1000).refine((u) => u.startsWith('https://'), 'رابط الاشتراك غير صالح');

const subscribeSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  lang: z.enum(['ar', 'en']).default('ar'),
  level: z.enum(['all', 'important', 'critical']).default('all'),
  device: z.string().max(80).nullish(),
});

pushRoutes.get('/key', requireAuth(), async (c) => {
  const k = await vapidKeys();
  return c.json({ public_key: k.publicKey });
});

pushRoutes.post('/subscribe', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const parsed = await parseBody(c, subscribeSchema);
  if (!parsed.ok) return parsed.json;
  const d = parsed.data as z.infer<typeof subscribeSchema>;
  const input: SubscribeInput = { endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, lang: d.lang, level: d.level, device: d.device ?? null };
  await saveSubscription(s.user.id, s.user.hospital_id, input);
  await db.execute({
    sql: `DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ${MAX_DEVICES})`,
    args: [s.user.id, s.user.id],
  });
  return c.json({ subscribed: true, level: d.level });
});

/** حالة هذا الجهاز (الرابط في جسم الطلب لا في العنوان) */
pushRoutes.post('/status', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const parsed = await parseBody(c, z.object({ endpoint }));
  if (!parsed.ok) return parsed.json;
  const r = await db.execute({
    sql: `SELECT level FROM push_subscriptions WHERE user_id = ? AND endpoint = ? LIMIT 1`,
    args: [s.user.id, (parsed.data as { endpoint: string }).endpoint],
  });
  const row = r.rows[0] as unknown as { level: string } | undefined;
  const devices = await db.execute({ sql: `SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?`, args: [s.user.id] });
  return c.json({ subscribed: Boolean(row), level: row?.level ?? null, devices: Number((devices.rows[0] as unknown as { n: number }).n) });
});

pushRoutes.post('/unsubscribe', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const parsed = await parseBody(c, z.object({ endpoint }));
  if (!parsed.ok) return parsed.json;
  await removeSubscription(s.user.id, (parsed.data as { endpoint: string }).endpoint);
  return c.body(null, 204);
});

/** إشعار تجريبي لكل أجهزة المستخدم */
pushRoutes.post('/test', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const sent = await pushToUsers([s.user.id], {
    tag: `test-${Date.now()}`,
    kind: 'push_test',
    severity: 'critical',
    titleAr: 'إشعار تجريبي من Q VIREXA',
    titleEn: 'Test notification from Q VIREXA',
    bodyAr: 'الإشعارات تعمل على هذا الجهاز حتى والنظام مغلق.',
    bodyEn: 'Notifications work on this device even when the system is closed.',
    link: '/settings',
  });
  if (sent === 0) return c.json({ message: 'لم يصل الإشعار: هذا الحساب غير مشترك من أي جهاز' }, 409);
  return c.json({ sent });
});
