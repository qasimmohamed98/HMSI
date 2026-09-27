import { Hono } from 'hono';
import type { MedicationCatalogItem } from '@hmsi/shared';
import { MedicationCatalogSchema } from '@hmsi/shared/validate';
import { db, uuid } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { DEFAULT_MEDICATIONS } from '../lib/medicationDefaults.js';

/** قائمة الأدوية المعتمدة (Formulary) لكل مستشفى — يقترحها الطبيب عند الوصف، ويديرها الصيدلي */
export const medicationsCatalogRoutes = new Hono();

const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function mapItem(r: Record<string, unknown>): MedicationCatalogItem {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    generic_name_ar: String(r.generic_name_ar),
    generic_name_en: s(r.generic_name_en),
    brand_name_ar: s(r.brand_name_ar),
    brand_name_en: s(r.brand_name_en),
    form: String(r.form) as MedicationCatalogItem['form'],
    strength: s(r.strength),
    route: s(r.route),
    controlled: Number(r.controlled) === 1,
    is_active: Number(r.is_active) === 1,
  };
}

async function getItem(id: string, hospitalId: string): Promise<MedicationCatalogItem | null> {
  const r = await db.execute({ sql: `SELECT * FROM medications_catalog WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, hospitalId] });
  return r.rows[0] ? mapItem(r.rows[0] as unknown as Record<string, unknown>) : null;
}

/** القائمة (للوصف: الفعّالة فقط؛ للإدارة: ?all=1) — ?q= بحث بالاسم العلمي أو التجاري */
medicationsCatalogRoutes.get('/', requireAuth(), requirePermission('patients.view'), async (c) => {
  const session = getSession(c)!;
  const where = ['hospital_id = ?'];
  const args: (string | number)[] = [session.user.hospital_id];
  if (c.req.query('all') !== '1') where.push('is_active = 1');
  const q = c.req.query('q')?.trim();
  if (q) {
    where.push(`(generic_name_ar LIKE ? OR generic_name_en LIKE ? OR brand_name_ar LIKE ? OR brand_name_en LIKE ?)`);
    const p = `%${q.replace(/[%_]/g, '')}%`;
    args.push(p, p, p, p);
  }
  const r = await db.execute({ sql: `SELECT * FROM medications_catalog WHERE ${where.join(' AND ')} ORDER BY generic_name_ar LIMIT 500`, args });
  return c.json(r.rows.map((x) => mapItem(x as unknown as Record<string, unknown>)));
});

medicationsCatalogRoutes.post('/', requireAuth(), requirePermission('medications.dispense'), async (c) => {
  const parsed = await parseBody(c, MedicationCatalogSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof MedicationCatalogSchema)['_output'];
  const session = getSession(c)!;
  const id = uuid('mdc');
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO medications_catalog (id, hospital_id, generic_name_ar, generic_name_en, brand_name_ar, brand_name_en, form, strength, route, controlled, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, session.user.hospital_id, input.generic_name_ar, input.generic_name_en ?? null, input.brand_name_ar ?? null, input.brand_name_en ?? null,
      input.form, input.strength ?? null, input.route ?? null, input.controlled ? 1 : 0, input.is_active === false ? 0 : 1, now, now,
    ],
  });
  await writeAudit({ actorId: session.user.id, action: 'medication_catalog_created', resourceType: 'medications_catalog', resourceId: id, ip: clientIp(c) });
  return c.json(await getItem(id, session.user.hospital_id), 201);
});

medicationsCatalogRoutes.patch('/:id', requireAuth(), requirePermission('medications.dispense'), async (c) => {
  const parsed = await parseBody(c, MedicationCatalogSchema.partial());
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as Partial<(typeof MedicationCatalogSchema)['_output']>;
  const session = getSession(c)!;
  const before = await getItem(c.req.param('id'), session.user.hospital_id);
  if (!before) return c.json({ message: 'الدواء غير موجود في القائمة' }, 404);
  const next = { ...before, ...input };
  await db.execute({
    sql: `UPDATE medications_catalog SET generic_name_ar = ?, generic_name_en = ?, brand_name_ar = ?, brand_name_en = ?, form = ?, strength = ?, route = ?, controlled = ?, is_active = ?, updated_at = ?
          WHERE id = ? AND hospital_id = ?`,
    args: [
      next.generic_name_ar, next.generic_name_en ?? null, next.brand_name_ar ?? null, next.brand_name_en ?? null, next.form,
      next.strength ?? null, next.route ?? null, next.controlled ? 1 : 0, next.is_active ? 1 : 0, new Date().toISOString(), before.id, session.user.hospital_id,
    ],
  });
  await writeAudit({ actorId: session.user.id, action: 'medication_catalog_updated', resourceType: 'medications_catalog', resourceId: before.id, ip: clientIp(c) });
  return c.json(await getItem(before.id, session.user.hospital_id));
});

/** استيراد الكتالوج الجاهز (لا يغيّر ما هو موجود — يضيف الأسماء الناقصة فقط) */
medicationsCatalogRoutes.post('/import-defaults', requireAuth(), requirePermission('medications.dispense'), async (c) => {
  const session = getSession(c)!;
  const now = new Date().toISOString();
  let added = 0;
  for (const d of DEFAULT_MEDICATIONS) {
    const exists = await db.execute({
      sql: `SELECT 1 FROM medications_catalog WHERE hospital_id = ? AND generic_name_ar = ? AND IFNULL(strength,'') = ?`,
      args: [session.user.hospital_id, d.generic_ar, d.strength ?? ''],
    });
    if (exists.rows.length > 0) continue;
    await db.execute({
      sql: `INSERT INTO medications_catalog (id, hospital_id, generic_name_ar, generic_name_en, brand_name_ar, brand_name_en, form, strength, route, controlled, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [uuid('mdc'), session.user.hospital_id, d.generic_ar, d.generic_en, d.brand_ar ?? null, d.brand_en ?? null, d.form, d.strength ?? null, d.route ?? null, d.controlled ? 1 : 0, now, now],
    });
    added++;
  }
  await writeAudit({ actorId: session.user.id, action: 'medications_catalog_imported', resourceType: 'medications_catalog', resourceId: session.user.hospital_id, meta: { added }, ip: clientIp(c) });
  return c.json({ added, total: DEFAULT_MEDICATIONS.length });
});
