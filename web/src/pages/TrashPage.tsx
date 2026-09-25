import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, BellRing, RotateCcw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, Dialog, EmptyState, Input, Skeleton, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type TrashItem } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { currentLang } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * سلة المحذوفات: لا يُحذف شيء نهائياً.
 * مدير المستشفى يرى كل المحذوفات ويستعيدها؛ بقية الطاقم يرون ما حذفوه ويطلبون استعادته.
 */
export default function TrashPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'trash' | 'restored'>('trash');
  const [requestFor, setRequestFor] = useState<TrashItem | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['trash', tab], queryFn: () => API.listTrash(tab === 'restored') });

  const restoreMut = useMutation({
    mutationFn: (id: string) => API.restoreTrash(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trash'] });
      void qc.invalidateQueries({ queryKey: ['chart'] });
      void qc.invalidateQueries({ queryKey: ['wards'] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      void qc.invalidateQueries({ queryKey: ['departments'] });
      toast.success(t('trash.restored'));
    },
  });

  const requestMut = useMutation({
    mutationFn: (a: { id: string; note: string | null }) => API.requestRestore(a.id, a.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trash'] });
      setRequestFor(null);
      toast.success(t('trash.requestSent'));
    },
  });

  const canRestore = data?.canRestore ?? false;
  const items = data?.items ?? [];
  const pending = items.filter((i) => i.restore_requested_at && !i.restored_at).length;

  return (
    <div>
      <PageHeader title={t('trash.title')} subtitle={canRestore ? t('trash.subtitleManager') : t('trash.subtitleStaff')} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['trash', 'restored'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
              tab === k ? 'bg-brand-600 text-white' : 'bg-surface-raised text-ink/65 hover:bg-surface-muted dark:hover:bg-white/5',
            )}
          >
            {t(`trash.tabs.${k}`)}
          </button>
        ))}
        {canRestore && tab === 'trash' && pending > 0 && (
          <Badge variant="warning" className="ms-auto">
            <BellRing className="me-1 h-3.5 w-3.5" />
            {t('trash.pendingRequests', { count: pending })}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={tab === 'trash' ? t('trash.empty') : t('trash.emptyRestored')} icon={<Trash2 className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className={cn(it.restore_requested_at && !it.restored_at && 'ring-2 ring-warning-300 dark:ring-warning-800')}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink/60 dark:bg-white/5">
                  {it.mode === 'archive' ? <ArchiveRestore className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{t(`trash.kinds.${it.kind}`, { defaultValue: it.kind })}</Badge>
                    <span className="truncate font-bold text-ink">{it.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {it.patient_name_ar && it.patient_id && (
                      <>
                        <Link to={`/patients/${it.patient_id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                          {currentLang() === 'en' ? it.patient_name_en || it.patient_name_ar : it.patient_name_ar}
                        </Link>
                        {' · '}
                      </>
                    )}
                    {it.patient_name_ar && !it.patient_id && <>{it.patient_name_ar} · </>}
                    {t('trash.deletedBy', { name: it.deleted_by })} · <span className="tabular">{fmtDateTime(it.deleted_at)}</span>
                  </p>
                  {it.restore_requested_at && (
                    <p className="mt-1 text-xs font-semibold text-warning-800 dark:text-warning-200">
                      {t('trash.requestedBy', { name: it.restore_requested_by })} · <span className="tabular">{fmtDateTime(it.restore_requested_at)}</span>
                      {it.restore_request_note ? ` — ${it.restore_request_note}` : ''}
                    </p>
                  )}
                  {it.restored_at && (
                    <p className="mt-1 text-xs font-semibold text-success-700 dark:text-success-300">
                      {t('trash.restoredBy', { name: it.restored_by })} · <span className="tabular">{fmtDateTime(it.restored_at)}</span>
                    </p>
                  )}
                </div>
                {!it.restored_at &&
                  (canRestore ? (
                    <Button
                      size="sm"
                      icon={<RotateCcw className="h-4 w-4" />}
                      loading={restoreMut.isPending && restoreMut.variables === it.id}
                      onClick={async () => {
                        if (await confirm(t('trash.restoreConfirm', { label: it.label }))) restoreMut.mutate(it.id);
                      }}
                    >
                      {t('trash.restore')}
                    </Button>
                  ) : it.restore_requested_at ? (
                    <Badge variant="warning">{t('trash.requested')}</Badge>
                  ) : (
                    <Button size="sm" variant="outline" icon={<BellRing className="h-4 w-4" />} onClick={() => setRequestFor(it)}>
                      {t('trash.request')}
                    </Button>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!canRestore && <Alert variant="info" className="mt-4">{t('trash.staffHint')}</Alert>}

      {requestFor && <RequestDialog item={requestFor} busy={requestMut.isPending} onClose={() => setRequestFor(null)} onSubmit={(note) => requestMut.mutate({ id: requestFor.id, note })} />}
    </div>
  );
}

function RequestDialog({ item, busy, onClose, onSubmit }: { item: TrashItem; busy: boolean; onClose: () => void; onSubmit: (note: string | null) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('trash.request')}
      description={item.label}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={() => onSubmit(note.trim() || null)}>
            {t('trash.send')}
          </Button>
        </>
      }
    >
      <Input label={t('trash.reason')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus />
    </Dialog>
  );
}
