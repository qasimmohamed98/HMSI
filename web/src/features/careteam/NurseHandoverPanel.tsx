import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, Inbox, Send, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Select, Textarea, useToast } from '@/components/ui';
import { API, type NurseHandover } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, localName } from '@/lib/format';

const nameOf = (ar: string | null | undefined, en: string | null | undefined) => localName({ name_ar: ar ?? '', name_en: en ?? null }, 'name');

/**
 * التسليم والاستلام بين الممرضين:
 * المسلِّم يختار مرضاه والممرض المستلِم → يبقى مسؤولاً حتى يضغط المستلم «استلام» → تنتقل المسؤولية.
 */
export function NurseHandoverPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const box = useQuery({ queryKey: ['nurseHandovers'], queryFn: API.nurseHandovers, refetchInterval: 30_000 });
  const mine = useQuery({ queryKey: ['handover', '', true], queryFn: () => API.handover(undefined, true) });
  const nurses = useQuery({ queryKey: ['careStaff', 'nurse'], queryFn: () => API.careStaff('nurse') });
  const [selected, setSelected] = useState<string[]>([]);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState<NurseHandover | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['nurseHandovers'] });
    void qc.invalidateQueries({ queryKey: ['handover'] });
    void qc.invalidateQueries({ queryKey: ['rounds'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const send = useMutation({
    mutationFn: () => API.sendNurseHandover({ toUserId: to, admissionIds: selected, note }),
    onSuccess: () => {
      setSelected([]);
      setNote('');
      refresh();
      toast.success(t('nurseHandover.sent'));
    },
  });
  const accept = useMutation({
    mutationFn: API.acceptNurseHandover,
    onSuccess: (r) => {
      refresh();
      toast.success(t('nurseHandover.accepted', { count: r.moved }));
    },
  });
  const cancel = useMutation({ mutationFn: API.cancelNurseHandover, onSuccess: refresh });

  const pendingIds = new Set((box.data?.outgoing ?? []).flatMap((h) => h.items.map((i) => i.admission_id)));
  const myPatients = (mine.data ?? []).filter((p) => p.nurse_id === user?.id);
  const others = (nurses.data ?? []).filter((n) => n.id !== user?.id);

  return (
    <div className="space-y-4">
      {/* طلبات الاستلام الواردة */}
      <Card className={box.data?.incoming.length ? 'border-warning-300 dark:border-warning-900/60' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-brand-600" />
            {t('nurseHandover.incoming')}
            {!!box.data?.incoming.length && <Badge variant="warning">{box.data.incoming.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!box.data?.incoming.length ? (
            <p className="text-sm text-ink/50">{t('nurseHandover.noIncoming')}</p>
          ) : (
            box.data.incoming.map((h) => (
              <div key={h.id} className="rounded-xl border border-ink/10 p-3 dark:border-white/10">
                <p className="font-bold text-ink">{t('nurseHandover.from', { name: nameOf(h.from_name_ar, h.from_name_en) })}</p>
                <p className="text-xs text-ink/50 tabular">{fmtDateTime(h.created_at)}</p>
                <Items h={h} />
                {h.note && <p className="mt-2 whitespace-pre-line rounded-lg bg-ink/[0.03] p-2 text-sm text-ink/75 dark:bg-white/[0.04]">{h.note}</p>}
                <p className="mt-2 text-xs text-ink/55">{t('nurseHandover.reviewHint')}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" icon={<Check className="h-4 w-4" />} loading={accept.isPending && accept.variables === h.id} onClick={() => accept.mutate(h.id)}>
                    {t('nurseHandover.accept')}
                  </Button>
                  <Button size="sm" variant="outline" icon={<X className="h-4 w-4" />} onClick={() => setRejecting(h)}>
                    {t('nurseHandover.reject')}
                  </Button>
                </div>
              </div>
            ))
          )}
          {accept.error && <Alert variant="danger">{(accept.error as Error).message}</Alert>}
        </CardContent>
      </Card>

      {/* تسليم مرضاي */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            {t('nurseHandover.sendTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!myPatients.length ? (
            <EmptyState title={t('nurseHandover.noPatients')} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink/70">{t('nurseHandover.choosePatients')}</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  onClick={() => setSelected(myPatients.filter((p) => !pendingIds.has(p.admission_id)).map((p) => p.admission_id))}
                >
                  {t('nurseHandover.selectAll')}
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {myPatients.map((p) => {
                  const busy = pendingIds.has(p.admission_id);
                  return (
                    <li key={p.admission_id}>
                      <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${busy ? 'opacity-50' : 'cursor-pointer'} border-ink/10 dark:border-white/10`}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          disabled={busy}
                          checked={selected.includes(p.admission_id)}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.admission_id] : s.filter((x) => x !== p.admission_id)))}
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{localName(p, 'full_name')}</span>
                        <bdi dir="ltr" className="text-xs text-ink/50">
                          {p.room}/{p.bed_no}
                        </bdi>
                        {busy && <Badge variant="info">{t('nurseHandover.pending')}</Badge>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <Select
                label={t('nurseHandover.to')}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                options={[{ value: '', label: t('careTeam.choose') }, ...others.map((n) => ({ value: n.id, label: `${localName(n, 'full_name')} — ${t('careTeam.load', { count: n.patients })}` }))]}
              />
              <Textarea label={t('nurseHandover.note')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('nurseHandover.noteHint')} />
              <p className="text-xs text-ink/55">{t('nurseHandover.sbarHint')}</p>
              {send.error && <Alert variant="danger">{(send.error as Error).message}</Alert>}
              <Button icon={<ArrowLeftRight className="h-4 w-4" />} loading={send.isPending} disabled={!to || !selected.length} onClick={() => send.mutate()}>
                {t('nurseHandover.send', { count: selected.length })}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {!!box.data?.outgoing.length && (
        <Card>
          <CardHeader>
            <CardTitle>{t('nurseHandover.outgoing')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {box.data.outgoing.map((h) => (
              <div key={h.id} className="rounded-xl border border-ink/10 p-3 dark:border-white/10">
                <p className="font-bold text-ink">{t('nurseHandover.waitingFor', { name: nameOf(h.to_name_ar, h.to_name_en) })}</p>
                <Items h={h} />
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => cancel.mutate(h.id)}>
                  {t('nurseHandover.cancel')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!!box.data?.recent.length && (
        <Card>
          <CardHeader>
            <CardTitle>{t('nurseHandover.recent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {box.data.recent.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant={h.status === 'accepted' ? 'success' : h.status === 'rejected' ? 'danger' : 'neutral'}>{t(`nurseHandover.status.${h.status}`)}</Badge>
                  <span className="text-ink/75">
                    {nameOf(h.from_name_ar, h.from_name_en)} ← {nameOf(h.to_name_ar, h.to_name_en)} · {h.items.length}
                  </span>
                  <span className="text-xs text-ink/45 tabular">{fmtDateTime(h.responded_at ?? h.created_at)}</span>
                  {h.response_note && <span className="text-xs text-danger-700">— {h.response_note}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rejecting && <RejectDialog h={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />}
    </div>
  );
}

function Items({ h }: { h: NurseHandover }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {h.items.map((i) => (
        <li key={i.admission_id} className="rounded-lg bg-ink/5 px-2 py-1 text-xs text-ink/75 dark:bg-white/5">
          {localName(i, 'full_name')} · <bdi dir="ltr">{i.room}/{i.bed_no}</bdi>
        </li>
      ))}
    </ul>
  );
}

function RejectDialog({ h, onClose, onDone }: { h: NurseHandover; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => API.rejectNurseHandover(h.id, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('nurseHandover.reject')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={reject.isPending} disabled={reason.trim().length < 2} onClick={() => reject.mutate()}>
            {t('nurseHandover.reject')}
          </Button>
        </>
      }
    >
      <Textarea label={t('nurseHandover.rejectReason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      {reject.error && (
        <Alert variant="danger" className="mt-3">
          {(reject.error as Error).message}
        </Alert>
      )}
    </Dialog>
  );
}
