import { Hono } from 'hono';
import type { ReportTemplate } from '@hmsi/shared';
import { ReportTemplateSchema } from '@hmsi/shared/validate';
import { db, uuid } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { HttpError } from '../lib/errors.js';

/** قوالب تقارير جاهزة حسب نوع الجهاز — نص يُدرج في التقرير ليُعدَّل، ليس بديلاً عن حكم الطبيب */
export const reportTemplateRoutes = new Hono();

const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const map = (r: Record<string, unknown>): ReportTemplate => ({
  id: String(r.id),
  hospital_id: String(r.hospital_id),
  modality: s(r.modality) as ReportTemplate['modality'],
  title_ar: String(r.title_ar),
  title_en: s(r.title_en),
  body_ar: String(r.body_ar),
  body_en: s(r.body_en),
  created_at: String(r.created_at),
});

reportTemplateRoutes.get('/', requireAuth(), requirePermission('radiology.add_report', 'radiology.verify'), async (c) => {
  const session = getSession(c)!;
  const where = ['hospital_id = ?'];
  const args: (string | number)[] = [session.user.hospital_id];
  const modality = c.req.query('modality');
  if (modality) {
    where.push('(modality = ? OR modality IS NULL)');
    args.push(modality);
  }
  const r = await db.execute({ sql: `SELECT * FROM report_templates WHERE ${where.join(' AND ')} ORDER BY modality, title_ar`, args });
  return c.json(r.rows.map((x) => map(x as unknown as Record<string, unknown>)));
});

reportTemplateRoutes.post('/', requireAuth(), requirePermission('radiology.verify'), async (c) => {
  const parsed = await parseBody(c, ReportTemplateSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof ReportTemplateSchema)['_output'];
  const session = getSession(c)!;
  const id = uuid('tpl');
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO report_templates (id, hospital_id, modality, title_ar, title_en, body_ar, body_en, created_by, created_by_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, session.user.hospital_id, input.modality ?? null, input.title_ar, input.title_en ?? null, input.body_ar, input.body_en ?? null, session.user.full_name_ar, session.user.id, now, now],
  });
  await writeAudit({ actorId: session.user.id, action: 'report_template_created', resourceType: 'report_template', resourceId: id, ip: clientIp(c) });
  const row = await db.execute({ sql: `SELECT * FROM report_templates WHERE id = ?`, args: [id] });
  return c.json(map(row.rows[0] as unknown as Record<string, unknown>), 201);
});

reportTemplateRoutes.delete('/:id', requireAuth(), requirePermission('radiology.verify'), async (c) => {
  const session = getSession(c)!;
  const id = c.req.param('id');
  const existing = await db.execute({ sql: `SELECT id FROM report_templates WHERE id = ? AND hospital_id = ?`, args: [id, session.user.hospital_id] });
  if (existing.rows.length === 0) throw new HttpError('القالب غير موجود', 404);
  await db.execute({ sql: `DELETE FROM report_templates WHERE id = ?`, args: [id] });
  await writeAudit({ actorId: session.user.id, action: 'report_template_deleted', resourceType: 'report_template', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
