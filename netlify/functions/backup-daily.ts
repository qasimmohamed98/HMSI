import type { Config } from '@netlify/functions';

/**
 * نسخ احتياطي يومي (01:00 UTC) لقاعدة البيانات كاملة إلى Netlify Blobs،
 * مشفّر بـ BACKUP_KEY إن وُجد، مع الاحتفاظ بآخر 30 نسخة.
 * الفشل يُسجَّل في سجل الأخطاء ليظهر في صفحة صحة النظام.
 */
export default async function backupDaily(): Promise<Response> {
  if (!process.env.TURSO_URL || !process.env.SESSION_SECRET) {
    console.error('[backup] missing TURSO_URL / SESSION_SECRET');
    return new Response(null, { status: 503 });
  }
  const { ensureMigrated } = await import('../../server/src/seed/migrate.js');
  const { runBackup } = await import('../../server/src/lib/backup.js');
  const { recordError } = await import('../../server/src/lib/monitor.js');
  try {
    await ensureMigrated();
    const r = await runBackup('scheduled');
    console.log(`[backup] ${r.key} ${r.size} bytes in ${r.ms}ms (encrypted: ${r.encrypted})`);
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await recordError({ source: 'job', message: `Daily backup failed — ${message}`, path: 'backup-daily' });
    console.error('[backup] failed', message);
    return new Response(null, { status: 500 });
  }
}

export const config: Config = {
  schedule: '0 1 * * *',
};
