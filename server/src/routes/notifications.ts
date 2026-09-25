import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '../../db/index.js';
import { getSession, requireAuth } from '../middleware/auth.js';

/** إشعارات المستخدم الحالي: الموجّهة له أو لدوره في مستشفاه، آخر 14 يوماً */
export const notificationRoutes = new Hono();

const WINDOW_DAYS = 14;

function scope(c: Context): { where: string; args: string[] } {
  const s = getSession(c)!;
  return {
    where: `n.hospital_id = ? AND n.created_at > ? AND (n.created_by_id IS NULL OR n.created_by_id != ?)
            AND (n.target_user_id = ? OR (n.target_user_id IS NULL AND (',' || n.target_roles || ',') LIKE ?))`,
    args: [s.user.hospital_id, new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString(), s.user.id, s.user.id, `%,${s.user.role},%`],
  };
}

notificationRoutes.get('/', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const { where, args } = scope(c);
  const rows = await db.execute({
    sql: `SELECT n.id, n.kind, n.severity, n.title_ar, n.title_en, n.body_ar, n.body_en, n.link, n.created_at,
                 CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS is_read
          FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
          WHERE ${where}
          ORDER BY n.created_at DESC LIMIT 50`,
    args: [s.user.id, ...args],
  });
  return c.json(rows.rows.map((r) => ({ ...(r as unknown as Record<string, unknown>), is_read: Number((r as unknown as Record<string, unknown>).is_read) === 1 })));
});

notificationRoutes.get('/count', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const { where, args } = scope(c);
  const r = await db.execute({
    sql: `SELECT COUNT(*) AS n, COALESCE(MAX(CASE n.severity WHEN 'critical' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END), 0) AS top
          FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
          WHERE ${where} AND r.user_id IS NULL`,
    args: [s.user.id, ...args],
  });
  const row = r.rows[0] as unknown as Record<string, unknown>;
  return c.json({ unread: Number(row.n ?? 0), top: (['info', 'warning', 'critical'] as const)[Number(row.top ?? 0)] });
});

notificationRoutes.post('/:id/read', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const { where, args } = scope(c);
  // فقط إشعار يخص المستخدم فعلاً
  const ok = await db.execute({ sql: `SELECT 1 FROM notifications n WHERE n.id = ? AND ${where} LIMIT 1`, args: [c.req.param('id'), ...args] });
  if (ok.rows.length === 0) return c.json({ message: 'الإشعار غير موجود' }, 404);
  await db.execute({ sql: `INSERT OR IGNORE INTO notification_reads (notification_id, user_id, read_at) VALUES (?, ?, ?)`, args: [c.req.param('id'), s.user.id, new Date().toISOString()] });
  return c.body(null, 204);
});

notificationRoutes.post('/read-all', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const { where, args } = scope(c);
  await db.execute({
    sql: `INSERT OR IGNORE INTO notification_reads (notification_id, user_id, read_at)
          SELECT n.id, ?, ? FROM notifications n WHERE ${where}`,
    args: [s.user.id, new Date().toISOString(), ...args],
  });
  return c.body(null, 204);
});
