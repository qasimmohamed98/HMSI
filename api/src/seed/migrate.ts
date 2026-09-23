import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../../db/index.js';

export async function runMigrations(): Promise<string[]> {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    args: [],
  });
  const appliedRows = await db.execute({ sql: `SELECT id FROM schema_migrations`, args: [] });
  const applied = new Set(appliedRows.rows.map((r) => String((r as Record<string, unknown>).id)));

  const here = fileURLToPath(new URL('.', import.meta.url));
  const dir = join(here, '..', '..', 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const ran: string[] = [];
  const remote = Boolean(process.env.TURSO_URL);
  for (const f of files) {
    if (applied.has(f)) continue;
    let sql = readFileSync(join(dir, f), 'utf8');
    if (remote) {
      // Turso لا يدعم PRAGMA journal_mode
      sql = sql.replace(/^\s*PRAGMA\s+journal_mode[^;]*;.*$/gim, '');
    }
    await db.executeMultiple(sql);
    await db.execute({ sql: `INSERT INTO schema_migrations (id) VALUES (?)`, args: [f] });
    ran.push(f);
  }
  return ran;
}