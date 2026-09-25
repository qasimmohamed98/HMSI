import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock, PauseCircle, ShieldAlert, Syringe } from 'lucide-react';
import { ROLE_PERMISSIONS, type AdministrationStatus, type DoseState } from '@hmsi/shared';
import { useRounds, useVitalsRounds } from '@/features/rounds/useRounds';
import { Alert, Badge, Button, Card, CardContent, Dialog, EmptyState, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type RoundMedication } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, localName } from '@/lib/format';
import { currentLang } from '@/i18n';
import { newClientId, submitOrQueue } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';

const TONE: Record<DoseState, string> = {
  overdue: 'border-danger-300 bg-danger-50/60 dark:border-danger-900/60 dark:bg-danger-900/15',
  due: 'border-warning-300 bg-warning-50/60 dark:border-warning-900/60 dark:bg-warning-900/15',
  upcoming: 'border-info-200 dark:border-info-900/50',
  later: 'border-ink/8 dark:border-white/10',
  prn: 'border-ink/8 dark:border-white/10',
  unscheduled: 'border-ink/8 dark:border-white/10',
  done: 'border-ink/8 dark:border-white/10',
};
const BADGE: Record<DoseState, 'danger' | 'warning' | 'info' | 'neutral'> = {
  overdue: 'danger',
  due: 'warning',
  upcoming: 'info',
  later: 'neutral',
  prn: 'neutral',
  unscheduled: 'neutral',
  done: 'neutral',
};

function relative(dueAt: string, now: Date, t: (k: string, o?: Record<string, unknown>) => string): string {
  const mins = Math.round((Date.parse(dueAt) - now.getTime()) / 60_000);
  const abs = Math.abs(mins);
  const span = abs < 60 ? t('rounds.minutes', { count: abs }) : t('rounds.hours', { count: Math.round(abs / 60) });
  return mins < 0 ? t('rounds.ago', { span }) : t('rounds.in', { span });
}

export default function MedicationRoundsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [ward, setWard] = useState('');
  const [filter, setFilter] = useState<'now' | 'all'>('now');
  const [tab, setTab] = useState<'vitals' | 'meds'>('vitals');
  // الممرض يرى مرضاه المعيَّنين افتراضياً، ويمكنه عرض الردهة كلها
  const [mine, setMine] = useState(() => user?.role === 'nurse');
  const vitals = useVitalsRounds(ward, mine);
  const [note, setNote] = useState<{ m: RoundMedication; status: AdministrationStatus } | null>(null);
  const wards = useQuery({ queryKey: ['wards'], queryFn: API.wards });
  const { items, now, isLoading, error, refetch } = useRounds(ward, mine);
  const canGive = user ? ROLE_PERMISSIONS[user.role].includes('medications.administer') : false;
  const en = currentLang() === 'en';

  const counts = useMemo(() => {
    const c: Partial<Record<DoseState, number>> = {};
    for (const x of items) c[x.s.state] = (c[x.s.state] ?? 0) + 1;
    return c;
  }, [items]);
  const shown = filter === 'now' ? items.filter((x) => x.s.state === 'overdue' || x.s.state === 'due' || x.s.state === 'upcoming') : items;

  const give = useMutation({
    networkMode: 'always',
    mutationFn: (v: { m: RoundMedication; status: AdministrationStatus; note: string | null }) =>
      submitOrQueue({
        kind: 'administration',
        patientId: v.m.patient_id,
        label: `${localName(v.m, 'full_name')} — ${v.m.name_ar}`,
        payload: { admissionId: v.m.admission_id, medicationId: v.m.id, status: v.status, note: v.note, clientId: newClientId(), administeredAt: new Date().toISOString() },
      }),
    onSuccess: ({ queued }) => {
      setNote(null);
      void qc.invalidateQueries({ queryKey: ['rounds'] });
      if (queued) toast.toast('info', t('offline.savedOffline'));
      else toast.success(t('common.done'));
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t('rounds.title')} subtitle={t('rounds.subtitle')} />
      <div role="tablist" className="inline-flex gap-1 rounded-xl border border-ink/8 bg-surface-raised p-1 dark:border-white/10">
        {(['vitals', 'meds'] as const).map((k) => {
          const n = k === 'vitals' ? vitals.items.filter((x) => x.s.state === 'overdue' || x.s.state === 'due').length : items.filter((x) => x.s.state === 'overdue' || x.s.state === 'due').length;
          const Icon = k === 'vitals' ? Activity : Syringe;
          return (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold', tab === k ? 'bg-brand-600 text-white' : 'text-ink/60 hover:bg-ink/5')}
            >
              <Icon className="h-4 w-4" />
              {t(k === 'vitals' ? 'rounds.tabVitals' : 'rounds.tabMeds')}
              {n > 0 && <span className={cn('rounded-full px-1.5 text-xs font-extrabold', tab === k ? 'bg-white/25' : 'bg-danger-600 text-white')}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Select
            label={t('rounds.ward')}
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            options={[{ value: '', label: t('rounds.allWards') }, ...(wards.data ?? []).map((w) => ({ value: w.id, label: localName(w, 'name') }))]}
          />
        </div>
        {user?.role === 'nurse' && (
          <div className="flex gap-2">
            <Button variant={mine ? 'primary' : 'outline'} size="sm" onClick={() => setMine(true)}>
              {t('rounds.mine')}
            </Button>
            <Button variant={!mine ? 'primary' : 'outline'} size="sm" onClick={() => setMine(false)}>
              {t('rounds.wardAll')}
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant={filter === 'now' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('now')}>
            {t('rounds.filterNow')}
          </Button>
          <Button variant={filter === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            {t('rounds.filterAll')}
          </Button>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {tab === 'meds' && (['overdue', 'due', 'upcoming'] as DoseState[]).map((s) => (
            <Badge key={s} variant={BADGE[s]}>
              {t(`rounds.state.${s}`)}: {counts[s] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      {tab === 'vitals' ? (
        <VitalsList items={filter === 'now' ? vitals.items.filter((x) => x.s.state !== 'later') : vitals.items} loading={vitals.isLoading} now={vitals.now} />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : error ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={t(filter === 'now' ? 'rounds.emptyNow' : 'rounds.empty')} icon={<CheckCircle2 className="h-6 w-6 text-success-600" />} />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map(({ m, s }) => (
            <li key={m.id} className={cn('rounded-xl border bg-surface-raised p-3 sm:p-4', TONE[s.state])}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={BADGE[s.state]}>{t(`rounds.state.${s.state}`)}</Badge>
                    <span className="font-bold text-ink">{(en && m.name_en) || m.name_ar}</span>
                    <span className="text-sm text-ink/60">
                      {[m.dose, m.route, m.frequency].filter(Boolean).join(' · ')}
                    </span>
                    {m.allergy_override && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-danger-700 dark:text-danger-300">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {t('rounds.allergy')}
                      </span>
                    )}
                    {!m.dispensed_at && <span className="text-xs font-semibold text-warning-700">{t('ui.notDispensed')}</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink/70">
                    <Link to={`/patients/${m.patient_id}`} className="font-semibold text-ink hover:underline">
                      {localName(m, 'full_name')}
                    </Link>{' '}
                    · {localName(m, 'ward_name')} · <bdi dir="ltr">{m.room}/{m.bed_no}</bdi>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink/55">
                    {s.due_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t('rounds.dueAt')}: <span className="font-bold tabular text-ink">{fmtDateTime(s.due_at)}</span> ({relative(s.due_at, now, t)})
                      </span>
                    )}
                    <span>
                      {m.last_at ? `${t('mar.lastGiven')}: ${fmtDateTime(m.last_at)}${m.last_status && m.last_status !== 'given' ? ` (${t(`mar.statuses.${m.last_status}`)})` : ''}` : t('mar.noneGiven')}
                    </span>
                    {s.state === 'unscheduled' && <span className="text-warning-700">{t('rounds.unscheduledHint')}</span>}
                  </p>
                </div>
                {canGive && (
                  <div className="flex gap-2">
                    <Button size="sm" icon={<Syringe className="h-4 w-4" />} loading={give.isPending && give.variables?.m.id === m.id && give.variables.status === 'given'} onClick={() => give.mutate({ m, status: 'given', note: null })}>
                      {t('rounds.give')}
                    </Button>
                    <Button size="sm" variant="outline" icon={<PauseCircle className="h-4 w-4" />} onClick={() => setNote({ m, status: 'held' })}>
                      {t('rounds.notGiven')}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {note && <NotGivenDialog item={note.m} onClose={() => setNote(null)} busy={give.isPending} onSubmit={(status, text) => give.mutate({ m: note.m, status, note: text })} error={give.error as Error | null} />}
    </div>
  );
}

function NotGivenDialog({ item, onClose, onSubmit, busy, error }: { item: RoundMedication; onClose: () => void; onSubmit: (s: AdministrationStatus, note: string) => void; busy: boolean; error: Error | null }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AdministrationStatus>('held');
  const [text, setText] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('rounds.notGiven')} — ${item.name_ar}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} disabled={!text.trim()} onClick={() => onSubmit(status, text.trim())}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label={t('rounds.reasonType')}
          value={status}
          onChange={(e) => setStatus(e.target.value as AdministrationStatus)}
          options={[
            { value: 'held', label: t('mar.statuses.held') },
            { value: 'refused', label: t('mar.statuses.refused') },
          ]}
        />
        <Textarea label={t('rounds.reason')} rows={2} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {error && <Alert variant="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}

function VitalsList({ items, loading, now }: { items: ReturnType<typeof useVitalsRounds>['items']; loading: boolean; now: Date }) {
  const { t } = useTranslation();
  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!items.length)
    return (
      <Card>
        <CardContent>
          <EmptyState title={t('rounds.vitalsEmpty')} icon={<CheckCircle2 className="h-6 w-6 text-success-600" />} />
        </CardContent>
      </Card>
    );
  return (
    <ul className="space-y-2">
      {items.map(({ v, s }) => (
        <li key={v.admission_id} className={cn('rounded-xl border bg-surface-raised p-3 sm:p-4', TONE[s.state])}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={BADGE[s.state]}>{t(`rounds.state.${s.state}`)}</Badge>
                <Link to={`/patients/${v.patient_id}`} className="font-bold text-ink hover:underline">
                  {localName(v, 'full_name')}
                </Link>
                <span className="text-sm text-ink/60">
                  {localName(v, 'ward_name')} · <bdi dir="ltr">{v.room}/{v.bed_no}</bdi>
                </span>
                {v.mews && v.mews.level !== 'low' && <Badge variant={v.mews.level === 'high' ? 'danger' : 'warning'}>MEWS {v.mews.score}</Badge>}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink/55">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {t('rounds.dueAt')}: <span className="font-bold tabular text-ink">{fmtDateTime(s.due_at)}</span> ({relative(s.due_at, now, t)})
                </span>
                <span>{t('carePlan.vitalsEvery', { count: s.hours })}</span>
                <span>{v.last_at ? `${t('rounds.lastVitals')}: ${fmtDateTime(v.last_at)}` : t('rounds.noVitals')}</span>
                {v.nurse_name_ar ? <span>{t('careTeam.nurse')}: {localName({ name_ar: v.nurse_name_ar, name_en: v.nurse_name_en }, 'name')}</span> : <span className="text-warning-700">{t('careTeam.noNurse')}</span>}
              </p>
            </div>
            <Link to={`/patients/${v.patient_id}?tab=vitals`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
              <Activity className="h-4 w-4" />
              {t('rounds.recordVitals')}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
