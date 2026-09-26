import { Hono } from 'hono';
import type { ServiceItem } from '@hmsi/shared';
import { ServiceSchema } from '@hmsi/shared/validate';
import { db, uuid } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { HttpConflict } from '../lib/errors.js';
import { DEFAULT_SERVICES } from '../lib/catalogDefaults.js';

/** كتالوج الخدمات والأسعار لكل مستشفى: فحوص المختبر والأشعة والإجراءات والإقامة */
export const serviceRoutes = new Hono();

const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function mapService(r: Record<string, unknown>): ServiceItem {
  return {
    id: String(r.id),
    kind: String(r.kind) as ServiceItem['kind'],
    code: String(r.code),
    name_ar: String(r.name_ar),
    name_en: s(r.name_en),
    modality: s(r.modality) as ServiceItem['modality'],
    body_part: s(r.body_part),
    department_id: s(r.department_id),
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    prep_ar: s(r.prep_ar),
    prep_en: s(r.prep_en),
    is_active: Number(r.is_active) === 1,
  };
}

async function getService(id: string, hospitalId: string): Promise<ServiceItem | null> {
  const r = await db.execute({ sql: `SELECT * FROM services WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  return r.rows[0] ? mapService(r.rows[0] as unknown as Record<string, unknown>) : null;
}

async function checkDepartment(departmentId: string | null | undefined, hospitalId: string) {
  if (!departmentId) return;
  const d = await db.execute({ sql: `SELECT 1 FROM departments WHERE id = ? AND hospital_id = ?`, args: [departmentId, hospitalId] });
  if (d.rows.length === 0) throw new HttpConflict('القسم غير موجود');
}

/** القائمة (للطلب: الفعّالة فقط؛ للإدارة: ?all=1) — ?kind=imaging&modality=CT&q= */
serviceRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  const where = ['hospital_id = ?'];
  const args: (string | number)[] = [session.user.hospital_id];
  const kind = c.req.query('kind');
  if (kind) {
    where.push('kind = ?');
    args.push(kind);
  }
  const modality = c.req.query('modality');
  if (modality) {
    where.push('modality = ?');
    args.push(modality);
  }
  if (c.req.query('all') !== '1') where.push('is_active = 1');
  const q = c.req.query('q')?.trim();
  if (q) {
    where.push(`(name_ar LIKE ? OR name_en LIKE ? OR code LIKE ?)`);
    const p = `%${q.replace(/[%_]/g, '')}%`;
    args.push(p, p, p);
  }
  const r = await db.execute({ sql: `SELECT * FROM services WHERE ${where.join(' AND ')} ORDER BY kind, modality, name_ar LIMIT 500`, args });
  return c.json(r.rows.map((x) => mapService(x as unknown as Record<string, unknown>)));
});

serviceRoutes.post('/', requireAuth(), requirePermission('services.manage'), async (c) => {
  const parsed = await parseBody(c, ServiceSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof ServiceSchema)['_output'];
  const session = getSession(c)!;
  await checkDepartment(input.department_id, session.user.hospital_id);
  const id = uuid('svc');
  const now = new Date().toISOString();
  try {
    await db.execute({
      sql: `INSERT INTO services (id, hospital_id, kind, code, name_ar, name_en, modality, body_part, department_id, price, prep_ar, prep_en, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, session.user.hospital_id, input.kind, input.code.toUpperCase(), input.name_ar, input.name_en ?? null, input.modality ?? null, input.body_part ?? null,
        input.department_id ?? null, input.price ?? null, input.prep_ar ?? null, input.prep_en ?? null, input.is_active === false ? 0 : 1, now, now,
      ],
    });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HttpConflict('هذا الرمز مستخدم لخدمة أخرى');
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'service_created', resourceType: 'service', resourceId: id, meta: { code: input.code, price: input.price ?? null }, ip: clientIp(c) });
  return c.json(await getService(id, session.user.hospital_id), 201);
});

serviceRoutes.patch('/:id', requireAuth(), requirePermission('services.manage'), async (c) => {
  const parsed = await parseBody(c, ServiceSchema.partial());
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as Partial<(typeof ServiceSchema)['_output']>;
  const session = getSession(c)!;
  const before = await getService(c.req.param('id'), session.user.hospital_id);
  if (!before) return c.json({ message: 'الخدمة غير موجودة' }, 404);
  await checkDepartment(input.department_id, session.user.hospital_id);
  const next = { ...before, ...input, code: (input.code ?? before.code).toUpperCase() };
  try {
    await db.execute({
      sql: `UPDATE services SET kind = ?, code = ?, name_ar = ?, name_en = ?, modality = ?, body_part = ?, department_id = ?, price = ?, prep_ar = ?, prep_en = ?, is_active = ?, updated_at = ?
            WHERE id = ? AND hospital_id = ?`,
      args: [
        next.kind, next.code, next.name_ar, next.name_en ?? null, next.modality ?? null, next.body_part ?? null, next.department_id ?? null, next.price ?? null,
        next.prep_ar ?? null, next.prep_en ?? null, next.is_active ? 1 : 0, new Date().toISOString(), before.id, session.user.hospital_id,
      ],
    });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HttpConflict('هذا الرمز مستخدم لخدمة أخرى');
    throw e;
  }
  // تغيير السعر يُسجَّل بقيمتيه (قبل/بعد) في التدقيق
  await writeAudit({
    actorId: session.user.id,
    action: 'service_updated',
    resourceType: 'service',
    resourceId: before.id,
    meta: before.price !== next.price ? { price_from: before.price, price_to: next.price } : { code: next.code },
    ip: clientIp(c),
  });
  return c.json(await getService(before.id, session.user.hospital_id));
});

/** استيراد الكتالوج الجاهز (لا يغيّر ما هو موجود — يضيف الرموز الناقصة فقط) */
serviceRoutes.post('/import-defaults', requireAuth(), requirePermission('services.manage'), async (c) => {
  const session = getSession(c)!;
  const now = new Date().toISOString();
  let added = 0;
  for (const d of DEFAULT_SERVICES) {
    const r = await db.execute({
      sql: `INSERT OR IGNORE INTO services (id, hospital_id, kind, code, name_ar, name_en, modality, body_part, prep_ar, prep_en, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [uuid('svc'), session.user.hospital_id, d.kind, d.code, d.ar, d.en, d.modality ?? null, d.body_part ?? null, d.prep_ar ?? null, d.prep_en ?? null, now, now],
    });
    added += r.rowsAffected;
  }
  await writeAudit({ actorId: session.user.id, action: 'services_imported', resourceType: 'service', resourceId: session.user.hospital_id, meta: { added }, ip: clientIp(c) });
  return c.json({ added, total: DEFAULT_SERVICES.length });
});
