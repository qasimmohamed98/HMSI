import { Hono } from 'hono';
import { z } from 'zod';
import { getSession, requireAuth, requirePermission, sessionHas } from '../middleware/auth.js';
import { listTrash, requestRestore, restoreFromTrash } from '../lib/trash.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit, addTimeline } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { clientIp } from '../config.js';
import { db } from '../../db/index.js';

/**
 * سلة المحذوفات.
 * - مدير المستشفى (trash.manage): يرى كل المحذوفات ويستعيدها.
 * - بقية الطاقم: يرون ما حذفوه بأنفسهم ويطلبون استعادته (يظهر الطلب للمدير).
 */
export const trashRoutes = new Hono();

const RequestSchema = z.object({ note: z.string().max(300).nullable().optional() });

trashRoutes.get('/', requireAuth(), async (c) => {
  const s = getSession(c)!;
  const manager = sessionHas(c, 'trash.manage');
  const restored = c.req.query('restored') === '1';
  const items = await listTrash(s.user.hospital_id, { restored, deletedById: manager ? undefined : s.user.id });
  return c.json({ items, canRestore: manager }, 200);
});

trashRoutes.post('/:id/request', requireAuth(), async (c) => {
  const parsed = await parseBody(c, RequestSchema);
  if (!parsed.ok) return parsed.json;
  const { note } = parsed.data as z.infer<typeof RequestSchema>;
  const s = getSession(c)!;
  const id = c.req.param('id');
  if (!sessionHas(c, 'trash.manage')) {
    const own = await db.execute({ sql: `SELECT 1 FROM trash WHERE id = ? AND hospital_id = ? AND deleted_by_id = ? LIMIT 1`, args: [id, s.user.hospital_id, s.user.id] });
    if (own.rows.length === 0) throw new HttpError('العنصر غير موجود في المحذوفات', 404);
  }
  await requestRestore(id, s.user.hospital_id, { id: s.user.id, name: s.user.full_name_ar }, note?.trim() || null);
  await writeAudit({ actorId: s.user.id, action: 'restore_requested', resourceType: 'trash', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});

trashRoutes.post('/:id/restore', requireAuth(), requirePermission('trash.manage'), async (c) => {
  const s = getSession(c)!;
  const id = c.req.param('id');
  const entry = await restoreFromTrash(id, s.user.hospital_id, { id: s.user.id, name: s.user.full_name_ar });
  if (entry.admission_id) {
    await addTimeline({ admissionId: entry.admission_id, actor: s.user.full_name_ar, actorId: s.user.id, type: 'restore', titleAr: `استعادة من المحذوفات: ${entry.label}`, titleEn: `Restored from trash: ${entry.label}` });
  }
  await writeAudit({ actorId: s.user.id, action: 'trash_restored', resourceType: entry.table_name, resourceId: entry.record_id, ip: clientIp(c), meta: { trash_id: id } });
  return c.json(entry, 200);
});
