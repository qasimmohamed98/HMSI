import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config.js';
import { runMigrations } from '../seed/migrate.js';
import { runSeed } from '../seed/run.js';

export const staffRoutes = new Hono();

async function authorized(c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status: number) => Response }): Promise<boolean> {
  if (!env.seedToken) return false;
  const given = c.req.header('x-staff-token') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(env.seedToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

staffRoutes.post('/seed', async (c) => {
  if (!(await authorized(c))) return c.json({ message: 'غير موجود' }, 404);
  const migrations = await runMigrations();
  const { users, patients } = await runSeed();
  return c.json({ ok: true, migrations, users, patients }, 200);
});