import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { dismissFailed, flushOutbox, useOutbox } from '@/lib/offline-queue';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** حالة الاتصال وطابور الإدخالات غير المرسلة */
export function OutboxIndicator() {
  const { t } = useTranslation();
  const { jobs, failed, online, syncing } = useOutbox();
  const [open, setOpen] = useState(false);

  if (online && jobs.length === 0 && failed.length === 0) return null;

  const tone = failed.length > 0 ? 'danger' : !online ? 'warning' : 'info';
  const label = !online
    ? jobs.length > 0
      ? t('offline.offlinePending', { count: jobs.length })
      : t('offline.offline')
    : jobs.length > 0
      ? t('offline.pending', { count: jobs.length })
      : t('offline.failed', { count: failed.length });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
          tone === 'danger' && 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200',
          tone === 'warning' && 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200',
          tone === 'info' && 'bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-200',
        )}
      >
        {tone === 'danger' ? <AlertTriangle className="h-3.5 w-3.5" /> : !online ? <CloudOff className="h-3.5 w-3.5" /> : <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{jobs.length || failed.length || ''}</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('offline.title')}
        footer={
          <>
            {failed.length > 0 && (
              <Button variant="ghost" onClick={() => dismissFailed()}>
                {t('offline.dismiss')}
              </Button>
            )}
            <Button icon={<RefreshCw className="h-4 w-4" />} disabled={!online || jobs.length === 0} loading={syncing} onClick={() => void flushOutbox()}>
              {t('offline.syncNow')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-ink/60">{t('offline.explain')}</p>
          {jobs.length > 0 && (
            <ul className="space-y-1.5">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted/70 px-3 py-2 dark:bg-white/5">
                  <span className="font-semibold text-ink">
                    {t(`offline.kinds.${j.kind}`)} · {j.label}
                  </span>
                  <span className="shrink-0 text-xs tabular text-ink/50">{fmtDateTime(j.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {failed.length > 0 && (
            <div>
              <p className="mb-1.5 font-bold text-danger-700 dark:text-danger-300">{t('offline.failedTitle')}</p>
              <ul className="space-y-1.5">
                {failed.map((f) => (
                  <li key={f.job.id} className="rounded-lg border border-danger-200 px-3 py-2 dark:border-danger-900/50">
                    <p className="font-semibold text-ink">
                      {t(`offline.kinds.${f.job.kind}`)} · {f.job.label} · <span className="tabular">{fmtDateTime(f.job.createdAt)}</span>
                    </p>
                    <p className="text-xs text-danger-700 dark:text-danger-300">{f.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
