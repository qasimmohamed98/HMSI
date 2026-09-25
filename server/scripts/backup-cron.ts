/**
 * النسخ الاحتياطي اليومي على الخادم الخاص (يُشغَّل من cron — deploy/README-hostinger.md).
 * يحفظ في BACKUP_DIR ويحتفظ بآخر 30 نسخة، ويُسجّل الفشل في سجل الأخطاء (صفحة صحة النظام).
 */
import { ensureMigrated } from '../src/seed/migrate.js';
import { runBackup } from '../src/lib/backup.js';
import { recordError } from '../src/lib/monitor.js';

try {
  await ensureMigrated();
  const r = await runBackup('scheduled');
  console.log(`[backup] ${r.key} ${r.size} bytes in ${r.ms}ms (encrypted: ${r.encrypted})`);
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  await recordError({ source: 'job', message: `Daily backup failed — ${message}`, path: 'backup-cron' });
  console.error('[backup] failed', message);
  process.exit(1);
}
