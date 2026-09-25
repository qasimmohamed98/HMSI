/**
 * تمرين الاستعادة: يفك نسخة احتياطية ويستعيدها في قاعدة محلية جديدة ثم يطابق عدد الصفوف.
 * الاستخدام:
 *   BACKUP_KEY=... npx tsx scripts/restore-drill.ts <ملف-النسخة.bak> [file:restored.db]
 * لا يعمل إلا على ملف محلي (file:) — لا يلمس قاعدة الإنتاج أبداً.
 * لاستعادة فعلية على Turso: أنشئ قاعدة جديدة فارغة، استعد فيها بنفس الطريقة (بعد مراجعة يدوية)، ثم بدّل TURSO_URL.
 */
import { readFile, rm } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { decodeBackup, decodeValue } from '../src/lib/backup.js';
import { MIGRATIONS } from '../db/migrations.js';

const [file, target = 'file:restore-drill.db'] = process.argv.slice(2);
if (!file) {
  console.error('usage: tsx scripts/restore-drill.ts <backup.bak> [file:target.db]');
  process.exit(2);
}
if (!target.startsWith('file:')) {
  console.error('✗ الهدف يجب أن يكون ملفاً محلياً (file:...) — لا استعادة على قاعدة بعيدة من هذا السكربت');
  process.exit(2);
}

const t0 = Date.now();
const backup = decodeBackup(await readFile(file));
console.log(`نسخة ${backup.scope} من ${backup.created_at} — ${Object.keys(backup.tables).length} جدول`);

await rm(target.slice(5), { force: true });
const db = createClient({ url: target });
await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
for (const m of MIGRATIONS) {
  await db.executeMultiple(m.sql);
  await db.execute({ sql: `INSERT INTO schema_migrations (id) VALUES (?)`, args: [m.id] });
}

// ترتيب الإدراج حسب المفاتيح الأجنبية (الجدول المرجعي أولاً)
const deps = new Map<string, Set<string>>();
for (const t of Object.keys(backup.tables)) {
  const fks = await db.execute(`PRAGMA foreign_key_list(${t})`);
  deps.set(t, new Set(fks.rows.map((r) => String(r.table)).filter((x) => x !== t && x in backup.tables)));
}
const order: string[] = [];
const visit = (t: string, seen = new Set<string>()) => {
  if (order.includes(t) || seen.has(t)) return;
  seen.add(t);
  for (const d of deps.get(t) ?? []) visit(d, seen);
  order.push(t);
};
Object.keys(backup.tables).forEach((t) => visit(t));

let failed = 0;
for (const table of order) {
  const rows = backup.tables[table]!;
  if (table === 'schema_migrations') continue;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await db.batch(
      chunk.map((r) => {
        const cols = Object.keys(r);
        return {
          sql: `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          args: cols.map((c) => decodeValue(r[c]) as never),
        };
      }),
      'write',
    );
  }
  const n = Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]!.n);
  const ok = n === backup.counts[table];
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${table}: ${n} / ${backup.counts[table]}`);
}
const fk = await db.execute('PRAGMA foreign_key_check');
if (fk.rows.length) {
  failed++;
  console.log(`✗ ${fk.rows.length} مخالفة مفاتيح أجنبية`);
}
console.log(failed ? `\n✗ فشل التمرين (${failed})` : `\n✓ الاستعادة سليمة في ${target} خلال ${Date.now() - t0}ms`);
process.exit(failed ? 1 : 0);
