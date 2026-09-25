import { runMigrations } from '../src/seed/migrate.js';
import { runSeed } from '../src/seed/run.js';

// ⚠ الزرع يمسح كل البيانات. على قاعدة Turso (TURSO_URL) يتطلب تأكيداً صريحاً.
if (process.env.TURSO_URL && !process.argv.includes('--wipe-remote')) {
  console.error('TURSO_URL is set: seeding would WIPE the remote database. Re-run with --wipe-remote if you really mean it.');
  process.exit(1);
}

await runMigrations();
const { users, patients } = await runSeed();
console.log(`seed complete: ${patients} patients, ${users} users (password: HmsiDemo2026)`);
process.exit(0);
