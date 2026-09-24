// يولّد server/db/migrations.ts من ملفات server/db/migrations/*.sql
// الـ migrations تُضمَّن في الكود لأن Netlify Functions لا تحمل ملفات .sql مع الـ bundle.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db');
const migrationsDir = join(dbDir, 'migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

let out = `// ⚠ ملف مُولَّد — لا تعدّله يدوياً.
// المصدر: server/db/migrations/*.sql — بعد إضافة ملف جديد شغّل: npm run db:gen -w @hmsi/api

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
`;

for (const f of files) {
  const sql = readFileSync(join(migrationsDir, f), 'utf8');
  if (sql.includes('`') || sql.includes('${')) throw new Error(`unsupported characters in ${f}`);
  out += `  {\n    id: ${JSON.stringify(f)},\n    sql: \`${sql.replaceAll('\\', '\\\\')}\`,\n  },\n`;
}
out += '];\n';

writeFileSync(join(dbDir, 'migrations.ts'), out);
console.log(`generated db/migrations.ts (${files.length} migrations)`);
