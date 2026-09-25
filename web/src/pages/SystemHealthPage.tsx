import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Database, Download, HardDriveDownload, Lock, LockOpen, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, EmptyState, Section, Skeleton, TableRoot, THead, TBody, Th, Td, TRow, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type ErrorEvent } from '@/lib/api';
import { fmtBytes, fmtDateTime, localName } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PurgeDemoCard } from '@/features/system/PurgeDemoCard';

/** صحة النظام: قاعدة البيانات، النسخ الاحتياطي، والأخطاء (المدير العام) */
export default function SystemHealthPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState<string | null>(null);
  const allowed = user?.role === 'super_admin';

  const health = useQuery({ queryKey: ['system-health'], queryFn: API.systemHealth, enabled: allowed, refetchInterval: 60_000 });
  const backups = useQuery({ queryKey: ['system-backups'], queryFn: API.listBackups, enabled: allowed });
  const errors = useQuery({ queryKey: ['system-errors'], queryFn: API.listErrors, enabled: allowed });

  const backupNow = useMutation({
    mutationFn: API.createBackup,
    onSuccess: (r) => {
      toast.success(t('health.backupDone', { size: fmtBytes(r.size), sec: (r.ms / 1000).toFixed(1) }));
      void qc.invalidateQueries({ queryKey: ['system-backups'] });
      void qc.invalidateQueries({ queryKey: ['system-health'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const clear = useMutation({
    mutationFn: API.clearErrors,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['system-errors'] });
      void qc.invalidateQueries({ queryKey: ['system-health'] });
    },
  });

  if (!allowed) return <EmptyState title={t('health.forbidden')} />;
  const h = health.data;

  const refresh = () => {
    void health.refetch();
    void backups.refetch();
    void errors.refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('health.title')}
        subtitle={t('health.subtitle')}
        actions={
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>
            {t('health.refresh')}
          </Button>
        }
      />

      <PurgeDemoCard />

      {health.isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : health.error ? (
        <Alert variant="danger" title={t('health.dbDown')}>{(health.error as Error).message}</Alert>
      ) : h ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            icon={<Database className="h-5 w-5" />}
            tone={h.db.migrations_applied === h.db.migrations_known ? 'ok' : 'warn'}
            label={t('health.database')}
            value={`${h.db.ms} ms`}
            note={t('health.migrations', { a: h.db.migrations_applied, k: h.db.migrations_known })}
          />
          <Tile
            icon={<HardDriveDownload className="h-5 w-5" />}
            tone={backupTone(h.backup.latest?.created_at, h.backup.error)}
            label={t('health.lastBackup')}
            value={h.backup.latest ? fmtDateTime(h.backup.latest.created_at) : t('health.never')}
            note={h.backup.error ?? t('health.backupCount', { n: h.backup.count, r: h.backup.retention })}
          />
          <Tile
            icon={<AlertTriangle className="h-5 w-5" />}
            tone={h.errors.last_24h === 0 ? 'ok' : h.errors.last_24h < 20 ? 'warn' : 'bad'}
            label={t('health.errors24')}
            value={String(h.errors.last_24h)}
            note={t('health.errorGroups', { n: h.errors.groups })}
          />
          <Tile
            icon={<Activity className="h-5 w-5" />}
            tone="ok"
            label={t('health.online')}
            value={String(h.counts.online_sessions)}
            note={t('health.countsNote', { h: h.counts.hospitals, u: h.counts.users, a: h.counts.active_admissions })}
          />
        </div>
      ) : null}

      <Section
        title={t('health.backups')}
        description={t('health.backupsHint')}
        action={
          <Button icon={<HardDriveDownload className="h-4 w-4" />} loading={backupNow.isPending} onClick={() => backupNow.mutate()}>
            {t('health.backupNow')}
          </Button>
        }
      >
        {backups.data && (
          <div className="mb-3">
            {backups.data.encrypted ? (
              <Badge variant="success">
                <Lock className="me-1 h-3 w-3" />
                {t('health.encrypted')}
              </Badge>
            ) : (
              <Alert variant="warning">
                <LockOpen className="me-1 inline h-4 w-4" />
                {t('health.notEncrypted')}
              </Alert>
            )}
          </div>
        )}
        {backups.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !backups.data?.backups.length ? (
          <EmptyState title={t('health.noBackups')} icon={<HardDriveDownload className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <TableRoot>
              <THead>
                <tr>
                  <Th>{t('health.backupTime')}</Th>
                  <Th>{t('health.backupKind')}</Th>
                  <Th>{t('health.backupSize')}</Th>
                  <Th />
                </tr>
              </THead>
              <TBody>
                {backups.data.backups.map((b) => (
                  <TRow key={b.key}>
                    <Td className="whitespace-nowrap tabular">{fmtDateTime(b.created_at || keyDate(b.key))}</Td>
                    <Td>
                      <Badge variant={b.key.endsWith('-scheduled.bak') ? 'info' : 'neutral'}>{t(b.key.endsWith('-scheduled.bak') ? 'health.scheduled' : 'health.manual')}</Badge>
                    </Td>
                    <Td className="tabular" dir="ltr">{fmtBytes(b.size)}</Td>
                    <Td className="text-end">
                      <a href={API.backupUrl(b.key)} download={b.key} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30">
                        <Download className="h-4 w-4" />
                        {t('health.download')}
                      </a>
                    </Td>
                  </TRow>
                ))}
              </TBody>
            </TableRoot>
          </div>
        )}
      </Section>

      <Section
        title={t('health.errorLog')}
        description={t('health.errorLogHint')}
        action={
          errors.data?.length ? (
            <Button
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                if (await confirm(t('health.clearConfirm'))) clear.mutate();
              }}
            >
              {t('health.clear')}
            </Button>
          ) : undefined
        }
      >
        {errors.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !errors.data?.length ? (
          <EmptyState title={t('health.noErrors')} icon={<CheckCircle2 className="h-6 w-6 text-success-600" />} />
        ) : (
          <div className="space-y-2">
            {errors.data.map((e) => (
              <ErrorRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function keyDate(key: string): string {
  const m = key.match(/^hmsi-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z` : '';
}

function backupTone(latest: string | undefined, error: string | null): 'ok' | 'warn' | 'bad' {
  if (error || !latest) return 'bad';
  const age = Date.now() - Date.parse(latest);
  return age < 26 * 3_600_000 ? 'ok' : age < 72 * 3_600_000 ? 'warn' : 'bad';
}

const TONES = {
  ok: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  warn: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  bad: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
};

function Tile({ icon, tone, label, value, note }: { icon: React.ReactNode; tone: keyof typeof TONES; label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink/55">{label}</p>
          <p className="truncate text-lg font-extrabold text-ink tabular">
            <bdi>{value}</bdi>
          </p>
          <p className="text-xs text-ink/50">{note}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorRow({ e, open, onToggle }: { e: ErrorEvent; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const hospital = localName(e, 'hospital_name');
  return (
    <div className="rounded-xl border border-ink/8 dark:border-white/10">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 p-3 text-start" aria-expanded={open}>
        <Badge variant={e.source === 'server' ? 'danger' : e.source === 'job' ? 'warning' : 'info'}>{t(`health.src_${e.source}`)}</Badge>
        {e.count > 1 && <Badge variant="neutral">×{e.count}</Badge>}
        <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
          {e.message}
        </span>
        <span className="text-xs text-ink/45 tabular">{fmtDateTime(e.last_seen_at)}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-ink/8 p-3 text-xs text-ink/65 dark:border-white/10">
          {e.path && (
            <p dir="ltr" className="font-mono">
              {e.path}
            </p>
          )}
          {hospital && <p>{hospital}</p>}
          <p>
            {t('health.firstSeen')}: {fmtDateTime(e.created_at)}
          </p>
          {e.detail && (
            <pre dir="ltr" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/5 p-2 font-mono text-[0.7rem] dark:bg-white/5">
              {e.detail}
            </pre>
          )}
          {e.user_agent && (
            <p dir="ltr" className="truncate text-ink/40">
              {e.user_agent}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
