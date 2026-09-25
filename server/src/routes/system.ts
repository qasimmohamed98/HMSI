import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { buildHospitalExport, listBackups, readBackup, runBackup, RETENTION } from '../lib/backup.js';
import { recordError } from '../lib/monitor.js';
import { MIGRATIONS } from '../../db/migrations.js';
import { DEMO_HOSPITAL_IDS, purgeDemoData } from '../lib/purge.js';

/** صحة النظام والنسخ الاحتياطي (المدير العام) + تصدير بيانات المستشفى (مدير المستشفى) */
export const systemRoutes = new Hono();

/** فحص عام خفيف لأدوات مراقبة التوفر — بلا أي معلومات حساسة */
export const healthRoutes = new Hono();
healthRoutes.get('/', async (c) => {
  const t0 = Date.now();
  try {
    await db.execute('SELECT 1');
    return c.json({ ok: true, db: 'ok', db_ms: Date.now() - t0, time: new Date().toISOString() });
  } catch {
    return c.json({ ok: false, db: 'down', time: new Date().toISOString() }, 503);
  }
});

const count = async (sql: string, args: string[] = []) => Number((await db.execute({ sql, args })).rows[0]?.n ?? 0);

systemRoutes.get('/health', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const t0 = Date.now();
  await db.execute('SELECT 1');
  const dbMs = Date.now() - t0;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [applied, hospitals, users, patients, activeAdmissions, sessions, errors24, errorsTotal] = await Promise.all([
    count(`SELECT COUNT(*) AS n FROM schema_migrations`),
    count(`SELECT COUNT(*) AS n FROM hospitals`),
    count(`SELECT COUNT(*) AS n FROM users WHERE is_active = 1`),
    count(`SELECT COUNT(*) AS n FROM patients`),
    count(`SELECT COUNT(*) AS n FROM admissions WHERE status = 'active'`),
    count(`SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now') AND last_seen_at > ?`, [new Date(Date.now() - 30 * 60_000).toISOString()]),
    count(`SELECT COALESCE(SUM(count), 0) AS n FROM error_events WHERE last_seen_at > ?`, [since]),
    count(`SELECT COUNT(*) AS n FROM error_events`),
  ]);
  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let backupError: string | null = null;
  try {
    backups = await listBackups();
  } catch (e) {
    backupError = e instanceof Error ? e.message : String(e);
  }
  return c.json({
    db: { ok: true, ms: dbMs, migrations_applied: applied, migrations_known: MIGRATIONS.length },
    counts: { hospitals, users, patients, active_admissions: activeAdmissions, online_sessions: sessions },
    errors: { last_24h: errors24, groups: errorsTotal },
    backup: { latest: backups[0] ?? null, count: backups.length, retention: RETENTION, encrypted: Boolean(process.env.BACKUP_KEY), error: backupError },
    runtime: { node: process.version, netlify: Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME), time: new Date().toISOString() },
  });
});

systemRoutes.get('/errors', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const source = c.req.query('source');
  const rows = await db.execute({
    sql: `SELECT e.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en
          FROM error_events e LEFT JOIN hospitals h ON h.id = e.hospital_id
          ${source ? 'WHERE e.source = ?' : ''}
          ORDER BY e.last_seen_at DESC LIMIT 200`,
    args: source ? [source] : [],
  });
  return c.json(rows.rows);
});

systemRoutes.delete('/errors', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const s = getSession(c)!;
  await db.execute(`DELETE FROM error_events`);
  await writeAudit({ actorId: s.user.id, action: 'errors_cleared', resourceType: 'system', ip: clientIp(c) });
  return c.body(null, 204);
});

const ClientErrorSchema = z.object({
  message: z.string().min(1).max(500),
  detail: z.string().max(4000).optional().nullable(),
  path: z.string().max(300).optional().nullable(),
});

/** أخطاء الواجهة (لأي مستخدم مسجّل) */
systemRoutes.post('/client-errors', requireAuth(), async (c) => {
  const parsed = await parseBody(c, ClientErrorSchema);
  if (!parsed.ok) return parsed.json;
  const s = getSession(c)!;
  const d = parsed.data as z.infer<typeof ClientErrorSchema>;
  await recordError({ source: 'client', message: d.message, detail: d.detail, path: d.path, hospitalId: s.user.hospital_id, userId: s.user.id, userAgent: c.req.header('user-agent') });
  return c.body(null, 204);
});

systemRoutes.get('/backups', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  return c.json({ backups: await listBackups(), retention: RETENTION, encrypted: Boolean(process.env.BACKUP_KEY) });
});

systemRoutes.post('/backups', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const s = getSession(c)!;
  const r = await runBackup('manual');
  await writeAudit({ actorId: s.user.id, action: 'backup_created', resourceType: 'system', resourceId: r.key, ip: clientIp(c), meta: { size: r.size, ms: r.ms } });
  return c.json(r, 201);
});

systemRoutes.get('/backups/:key', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const s = getSession(c)!;
  const key = c.req.param('key');
  const bytes = await readBackup(key);
  if (!bytes) return c.json({ message: 'النسخة غير موجودة' }, 404);
  await writeAudit({ actorId: s.user.id, action: 'backup_downloaded', resourceType: 'system', resourceId: key, ip: clientIp(c) });
  return c.body(new Uint8Array(bytes), 200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${key}"`,
  });
});

/** تصدير كل بيانات المستشفى (ملكه) كملف JSON — متاح حتى بعد انتهاء الاشتراك */
systemRoutes.get('/export', requireAuth(), requirePermission('settings.manage'), async (c) => {
  const s = getSession(c)!;
  const data = await buildHospitalExport(s.user.hospital_id);
  await writeAudit({ actorId: s.user.id, action: 'hospital_exported', resourceType: 'hospital', resourceId: s.user.hospital_id, ip: clientIp(c), meta: { counts: data.counts } });
  const name = `hmsi-export-${new Date().toISOString().slice(0, 10)}.json`;
  return c.body(JSON.stringify(data), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${name}"`,
  });
});

// ---------------------------------------------------------------- البيانات التجريبية والحذف النهائي

/** هل ما زالت بيانات التجربة موجودة؟ (للتنبيه في صفحة صحة النظام) */
systemRoutes.get('/demo-status', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const r = await db.execute({
    sql: `SELECT h.id, h.name_ar, h.name_en,
                 (SELECT COUNT(*) FROM patients p WHERE p.hospital_id = h.id) AS patients,
                 (SELECT COUNT(*) FROM users u WHERE u.hospital_id = h.id AND u.role != 'super_admin') AS users
          FROM hospitals h WHERE h.id IN (?, ?)`,
    args: [...DEMO_HOSPITAL_IDS],
  });
  const hospitals = r.rows.map((x) => {
    const o = x as unknown as Record<string, unknown>;
    return { id: String(o.id), name_ar: String(o.name_ar), name_en: String(o.name_en), patients: Number(o.patients), users: Number(o.users) };
  });
  return c.json({ present: hospitals.some((h) => h.patients > 0 || h.users > 0), hospitals });
});

export const PURGE_DEMO_PHRASE = 'DELETE DEMO DATA';
const PurgeDemoSchema = z.object({ confirm: z.literal(PURGE_DEMO_PHRASE) });

/** حذف بيانات التجربة نهائياً — بعد نسخة احتياطية تلقائية (يُلغى الحذف إن فشلت النسخة) */
systemRoutes.post('/purge-demo', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, PurgeDemoSchema);
  if (!parsed.ok) return c.json({ message: 'اكتب عبارة التأكيد كما هي' }, 422);
  const s = getSession(c)!;
  const backup = await runBackup('manual');
  const result = await purgeDemoData();
  await writeAudit({ actorId: s.user.id, action: 'demo_purged', resourceType: 'system', ip: clientIp(c), meta: { backup: backup.key, ...result } });
  return c.json({ ...result, backup: backup.key });
});
