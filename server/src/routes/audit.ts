import { Hono } from 'hono';
import type { AuditEntry } from '@hmsi/shared';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { db } from '../../db/index.js';

/** سجل التدقيق لمستشفى المستخدم (للقراءة فقط) — مرتب من الأحدث، مع ترقيم عبر before */
export const auditRoutes = new Hono();

function toIsoUtc(v: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? `${v.replace(' ', 'T')}Z` : v;
}

auditRoutes.get('/', requireAuth(), requirePermission('audit.view'), async (c) => {
  const session = getSession(c)!;
  const hospitalId = session.user.hospital_id;
  const before = c.req.query('before');
  const action = c.req.query('action');
  const limit = Math.min(Number(c.req.query('limit') ?? 100) || 100, 200);

  const where = [
    `(u.hospital_id = ? OR (a.actor_id IS NULL AND a.action = 'login_failed' AND a.resource_id IN (SELECT username FROM users WHERE hospital_id = ?)))`,
  ];
  const args: (string | number)[] = [hospitalId, hospitalId];
  if (before) {
    where.push('a.created_at < ?');
    args.push(before);
  }
  if (action) {
    where.push('a.action = ?');
    args.push(action.slice(0, 64));
  }
  args.push(limit);

  const rows = await db.execute({
    sql: `SELECT a.*, u.full_name_ar AS actor_name
          FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
          WHERE ${where.join(' AND ')}
          ORDER BY a.created_at DESC LIMIT ?`,
    args,
  });
  const list: AuditEntry[] = rows.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      actor_id: r.actor_id ? String(r.actor_id) : null,
      actor_name: r.actor_name ? String(r.actor_name) : null,
      action: String(r.action),
      resource_type: String(r.resource_type),
      resource_id: r.resource_id ? String(r.resource_id) : null,
      meta_json: String(r.meta_json ?? '{}'),
      ip: r.ip ? String(r.ip) : null,
      // datetime('now') في SQLite بدون منطقة زمنية (UTC) — نحوّله إلى ISO حتى لا يُقرأ كتوقيت محلي
      created_at: toIsoUtc(String(r.created_at)),
    };
  });
  return c.json(list, 200);
});
