import { Hono } from 'hono';
import type { Context } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config.js';
import { runMigrations } from '../seed/migrate.js';
import { runSeed } from '../seed/run.js';

/**
 * نقاط صيانة محمية بـ SEED_TOKEN (رأس x-staff-token). تُعيد 404 إن لم يُضبط التوكن أو كان خاطئاً.
 * - POST /migrate : تطبيق الـ migrations فقط (آمن على بيانات الإنتاج)
 * - POST /seed    : ⚠ يمسح كل البيانات ويزرع بيانات تجريبية — يتطلب {"confirm":"WIPE_ALL_DATA"}
 */
export const staffRoutes = new Hono();

function authorized(c: Context): boolean {
  if (!env.seedToken) return false;
  const a = Buffer.from(c.req.header('x-staff-token') ?? '');
  const b = Buffer.from(env.seedToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

staffRoutes.post('/migrate', async (c) => {
  if (!authorized(c)) return c.json({ message: 'المسار غير موجود' }, 404);
  const migrations = await runMigrations();
  return c.json({ ok: true, migrations }, 200);
});

staffRoutes.post('/seed', async (c) => {
  if (!authorized(c)) return c.json({ message: 'المسار غير موجود' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== 'WIPE_ALL_DATA') {
    return c.json({ message: 'هذه العملية تمسح كل البيانات — أرسل {"confirm":"WIPE_ALL_DATA"} للتأكيد' }, 400);
  }
  const migrations = await runMigrations();
  const { users, patients } = await runSeed();
  return c.json({ ok: true, migrations, users, patients }, 200);
});
