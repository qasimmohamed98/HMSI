import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { getSession, requireAuth } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { deviceLabel } from '../lib/device.js';
import { IDLE_TIMEOUT_MS } from '../lib/session.js';

/**
 * «الأجهزة وتسجيلات الدخول» في الإعدادات: الجلسات المفتوحة الآن (مع الخروج منها)،
 * الأجهزة المتذكَّرة للتحقق بخطوتين، وآخر عمليات الدخول بما فيها الفاشلة.
 * كل مستخدم يرى ويدير جلساته فقط.
 */
export const sessionRoutes = new Hono();

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
/** أوقات SQLite الافتراضية («2026-09-26 20:51:00» بتوقيت UTC بلا علامة) → ISO بعلامة Z حتى لا يقرأها المتصفح كتوقيت محلي */
const iso = (v: unknown): string | null => {
  const x = str(v);
  if (!x) return null;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(x) ? `${x.replace(' ', 'T')}Z` : x;
};

sessionRoutes.get('/', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const now = new Date().toISOString();
  const idleSince = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString();
  const sessions = await db.execute({
    sql: `SELECT id, ip, user_agent, created_at, last_seen_at FROM sessions
          WHERE user_id = ? AND expires_at > datetime('now') AND (last_seen_at IS NULL OR last_seen_at > ?)
          ORDER BY COALESCE(last_seen_at, created_at) DESC`,
    args: [s.user.id, idleSince],
  });
  const trusted = await db.execute({
    sql: `SELECT id, label, created_at, last_used_at, expires_at FROM trusted_devices WHERE user_id = ? AND expires_at > ? ORDER BY COALESCE(last_used_at, created_at) DESC`,
    args: [s.user.id, now],
  });
  // آخر 15 عملية دخول: الناجحة (actor_id) والفاشلة (باسم المستخدم) وفشل رمز التحقق
  const history = await db.execute({
    sql: `SELECT action, ip, meta_json, created_at FROM audit_logs
          WHERE (actor_id = ? AND action IN ('login', 'mfa_failed', 'logout', 'sessions_revoked'))
             OR (action = 'login_failed' AND resource_id = ?)
          ORDER BY created_at DESC LIMIT 15`,
    args: [s.user.id, s.user.username],
  });
  return c.json({
    sessions: sessions.rows.map((row) => {
      const r = row as unknown as Row;
      return { id: String(r.id), device: deviceLabel(str(r.user_agent)), ip: str(r.ip), created_at: iso(r.created_at)!, last_seen_at: iso(r.last_seen_at), current: String(r.id) === s.sessionId };
    }),
    trusted: trusted.rows.map((row) => {
      const r = row as unknown as Row;
      return { id: String(r.id), device: str(r.label) ?? '—', created_at: iso(r.created_at)!, last_used_at: iso(r.last_used_at), expires_at: iso(r.expires_at)! };
    }),
    history: history.rows.map((row) => {
      const r = row as unknown as Row;
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(String(r.meta_json ?? '{}')) as Record<string, unknown>;
      } catch {
        /* */
      }
      return { action: String(r.action), ip: str(r.ip), device: typeof meta.device === 'string' ? meta.device : null, via: typeof meta.mfa === 'string' ? meta.mfa : null, at: iso(r.created_at)! };
    }),
  });
});

/** الخروج من جلسة معيّنة (أو من هذا الجهاز نفسه) */
sessionRoutes.delete('/:id', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const id = c.req.param('id');
  const r = await db.execute({ sql: `DELETE FROM sessions WHERE id = ? AND user_id = ?`, args: [id, s.user.id] });
  if (r.rowsAffected === 0) return c.json({ message: 'الجلسة غير موجودة' }, 404);
  await writeAudit({ actorId: s.user.id, action: 'sessions_revoked', resourceType: 'session', resourceId: id, meta: { count: 1, self: id === s.sessionId }, ip: clientIp(c) });
  return c.body(null, 204);
});

/** الخروج من كل الأجهزة الأخرى (يبقى هذا الجهاز) */
sessionRoutes.post('/revoke-others', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const r = await db.execute({ sql: `DELETE FROM sessions WHERE user_id = ? AND id != ?`, args: [s.user.id, s.sessionId] });
  await writeAudit({ actorId: s.user.id, action: 'sessions_revoked', resourceType: 'session', resourceId: s.user.id, meta: { count: r.rowsAffected, others: true }, ip: clientIp(c) });
  return c.json({ revoked: r.rowsAffected });
});

/** حذف جهاز متذكَّر واحد (يُطلب عليه رمز التحقق من جديد) */
sessionRoutes.delete('/trusted/:id', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const r = await db.execute({ sql: `DELETE FROM trusted_devices WHERE id = ? AND user_id = ?`, args: [c.req.param('id'), s.user.id] });
  if (r.rowsAffected === 0) return c.json({ message: 'الجهاز غير موجود' }, 404);
  await writeAudit({ actorId: s.user.id, action: 'mfa_devices_forgotten', resourceType: 'user', resourceId: s.user.id, meta: { count: 1 }, ip: clientIp(c) });
  return c.body(null, 204);
});
