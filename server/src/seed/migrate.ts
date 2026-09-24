import { db } from '../../db/index.js';
import { MIGRATIONS } from '../../db/migrations.js';

export async function runMigrations(): Promise<string[]> {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    args: [],
  });
  const appliedRows = await db.execute({ sql: `SELECT id FROM schema_migrations`, args: [] });
  const applied = new Set(appliedRows.rows.map((r) => String((r as Record<string, unknown>).id)));

  const ran: string[] = [];
  const remote = Boolean(process.env.TURSO_URL);
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    let sql = m.sql;
    if (remote) {
      // Turso لا يدعم PRAGMA journal_mode
      sql = sql.replace(/^\s*PRAGMA\s+journal_mode[^;]*;.*$/gim, '');
    }
    await db.executeMultiple(sql);
    await db.execute({ sql: `INSERT INTO schema_migrations (id) VALUES (?)`, args: [m.id] });
    ran.push(m.id);
  }
  return ran;
}

let pending: Promise<void> | null = null;

/** تطبيق الـ migrations مرة واحدة لكل عملية (cold start) — آمن للتكرار. */
export function ensureMigrated(): Promise<void> {
  if (!pending) {
    pending = runMigrations()
      .then((ran) => {
        if (ran.length > 0) console.log(`[hmsi] applied migrations: ${ran.join(', ')}`);
      })
      .catch((e) => {
        pending = null; // أعد المحاولة في الطلب التالي
        throw e;
      });
  }
  return pending;
}
