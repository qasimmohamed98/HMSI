import { runMigrations } from '../src/seed/migrate.js';

const files = await runMigrations();
for (const f of files) console.log(`applied ${f}`);
console.log('migrations complete');
process.exit(0);