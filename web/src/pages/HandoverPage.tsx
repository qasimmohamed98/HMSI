import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NurseHandoverPanel } from '@/features/careteam/NurseHandoverPanel';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { ClipboardList, FlaskConical, Pill, Printer, ScanLine, ShieldAlert } from 'lucide-react';
import { ROLE_PERMISSIONS, type User } from '@hmsi/shared';
import { Alert, Badge, Button, Card, CardContent, Dialog, EmptyState, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type HandoverPatient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { calcAge, fmtDateTime, localName } from '@/lib/format';
import { currentLang } from '@/i18n';
import { esc, htmlTable, openPrintDocument } from '@/lib/print-doc';
import { cn } from '@/lib/utils';

const MEWS_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const;

/** تسليم المناوبة: ملخص كل مريض منوّم في الردهة + ملاحظة SBAR + طباعة ورقة التسليم */
export default function HandoverPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ward, setWard] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'nurses' ? 'nurses' : 'summary';
  const [mine, setMine] = useState(() => user?.role === 'nurse');
  const [writeFor, setWriteFor] = useState<HandoverPatient | null>(null);
  const wards = useQuery({ queryKey: ['wards'], queryFn: API.wards });
  const q = useQuery({ queryKey: ['handover', ward, mine], queryFn: () => API.handover(ward || undefined, mine), refetchInterval: 120_000 });
  const perms = user ? ROLE_PERMISSIONS[user.role] : [];
  const canWrite = perms.includes('notes.write.nursing') || perms.includes('notes.write.doctor');
  const en = currentLang() === 'en';
  const wardName = ward ? localName(wards.data?.find((w) => w.id === ward), 'name') : t('rounds.allWards');

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('handover.title')}
        subtitle={t('handover.subtitle')}
        actions={
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} disabled={!q.data?.length} onClick={() => q.data && printHandover(q.data, wardName, t, user)}>
            {t('handover.print')}
          </Button>
        }
      />
      {user?.role === 'nurse' && (
        <div role="tablist" className="inline-flex gap-1 rounded-xl border border-ink/8 bg-surface-raised p-1 dark:border-white/10">
          {(['summary', 'nurses'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setParams(k === 'nurses' ? { tab: 'nurses' } : {})}
              className={cn('rounded-lg px-4 py-2 text-sm font-semibold', tab === k ? 'bg-brand-600 text-white' : 'text-ink/60 hover:bg-ink/5')}
            >
              {t(k === 'nurses' ? 'nurseHandover.tab' : 'handover.tabSummary')}
            </button>
          ))}
        </div>
      )}
      {tab === 'nurses' && user?.role === 'nurse' ? (
        <NurseHandoverPanel />
      ) : (
      <>
      <div className="flex flex-wrap items-end gap-3">
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
      <div className="w-56">
        <Select
          label={t('rounds.ward')}
          value={ward}
          onChange={(e) => setWard(e.target.value)}
          options={[{ value: '', label: t('rounds.allWards') }, ...(wards.data ?? []).map((w) => ({ value: w.id, label: localName(w, 'name') }))]}
        />
      </div>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : q.error ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void q.refetch() }} />
          </CardContent>
        </Card>
      ) : !q.data?.length ? (
        <Card>
          <CardContent>
            <EmptyState title={t('handover.empty')} icon={<ClipboardList className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {q.data.map((p) => {
            const h = p.handover;
            const stale = h ? Date.now() - Date.parse(h.created_at) > 12 * 3_600_000 : true;
            return (
              <Card key={p.admission_id} className={cn(p.mews?.level === 'high' && 'border-danger-300 dark:border-danger-900/60')}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink/50">
                        {localName(p, 'ward_name')} · <bdi dir="ltr">{p.room}/{p.bed_no}</bdi>
                      </p>
                      <Link to={`/patients/${p.patient_id}`} className="text-lg font-extrabold text-ink hover:underline">
                        {localName(p, 'full_name')}
                      </Link>
                      <p className="text-xs text-ink/55">
                        {p.birth_date ? `${calcAge(p.birth_date)} ${t('common.years')} · ` : ''}
                        {t(`gender.${p.gender}`)} · <bdi dir="ltr">{p.file_number}</bdi>
                        {(en ? p.doctor_en || p.doctor_ar : p.doctor_ar) ? ` · ${en ? p.doctor_en || p.doctor_ar : p.doctor_ar}` : ''}
                      </p>
                    </div>
                    {p.mews && <Badge variant={MEWS_TONE[p.mews.level]}>MEWS {p.mews.score}</Badge>}
                  </div>

                  <p className="text-xs text-ink/60">
                    <span className="font-bold">{t('careTeam.nurse')}: </span>
                    {(en ? p.nurse_en || p.nurse_ar : p.nurse_ar) || <span className="text-warning-700">{t('careTeam.noNurse')}</span>}
                  </p>
                  {p.nursing_instructions && (
                    <p className="rounded-lg bg-info-50 px-3 py-2 text-sm text-info-900 dark:bg-info-900/20 dark:text-info-100">
                      <span className="font-bold">{t('carePlan.nursing_instructions')}: </span>
                      {p.nursing_instructions}
                    </p>
                  )}
                  <p className="text-sm text-ink/80">
                    <span className="font-bold">{t('handover.diagnosis')}: </span>
                    {(en ? p.diagnoses_en : p.diagnoses_ar) || p.reason || '—'}
                  </p>

                  {(p.allergies.length > 0 || p.alerts.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.allergies.map((a) => (
                        <Badge key={a} variant="danger">
                          <ShieldAlert className="me-1 h-3 w-3" />
                          {a}
                        </Badge>
                      ))}
                      {p.alerts.map((a) => (
                        <Badge key={a} variant="warning">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/70 dark:bg-white/[0.04]">
                    {p.vitals ? (
                      <span dir="ltr" className="inline-block tabular">
                        T {p.vitals.temperature ?? '—'} · HR {p.vitals.pulse ?? '—'} · RR {p.vitals.respiratory_rate ?? '—'} · BP {p.vitals.bp_systolic ?? '—'}/{p.vitals.bp_diastolic ?? '—'} · SpO₂ {p.vitals.spo2 ?? '—'}
                        {p.vitals.pain_score !== null ? ` · Pain ${p.vitals.pain_score}` : ''}
                      </span>
                    ) : (
                      t('handover.noVitals')
                    )}
                    {p.vitals && <span className="ms-2 text-ink/45">({fmtDateTime(p.vitals.recorded_at)})</span>}
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-ink/60">
                    <span className="inline-flex items-center gap-1">
                      <Pill className="h-3.5 w-3.5" />
                      {t('handover.meds', { count: p.active_meds })}
                    </span>
                    <span className={cn('inline-flex items-center gap-1', p.pending_labs > 0 && 'text-warning-700')}>
                      <FlaskConical className="h-3.5 w-3.5" />
                      {t('handover.pendingLabs', { count: p.pending_labs })}
                    </span>
                    {p.abnormal_labs_24h > 0 && <span className="text-danger-600">{t('handover.abnormal', { count: p.abnormal_labs_24h })}</span>}
                    <span className={cn('inline-flex items-center gap-1', p.pending_radiology > 0 && 'text-warning-700')}>
                      <ScanLine className="h-3.5 w-3.5" />
                      {t('handover.pendingImaging', { count: p.pending_radiology })}
                    </span>
                  </div>

                  {h ? (
                    <div className={cn('space-y-1 rounded-lg border px-3 py-2 text-sm', stale ? 'border-ink/10 dark:border-white/10' : 'border-brand-200 bg-brand-50/40 dark:border-brand-900/50 dark:bg-brand-900/10')}>
                      <p className="text-xs text-ink/50">
                        {t('handover.lastBy', { name: h.author })} · {fmtDateTime(h.created_at)}
                        {stale && <span className="ms-1 font-semibold text-warning-700">· {t('handover.stale')}</span>}
                      </p>
                      <Sbar label="S" text={h.situation} />
                      <Sbar label="B" text={h.background} />
                      <Sbar label="A" text={h.assessment} />
                      <Sbar label="R" text={h.recommendation} strong />
                    </div>
                  ) : (
                    <p className="text-sm text-ink/45">{t('handover.none')}</p>
                  )}
                  {p.last_nursing_note && (
                    <p className="line-clamp-2 text-xs text-ink/55">
                      <span className="font-bold">{t('handover.lastNursing')}: </span>
                      {p.last_nursing_note}
                    </p>
                  )}

                  {canWrite && (
                    <Button size="sm" variant="outline" icon={<ClipboardList className="h-4 w-4" />} onClick={() => setWriteFor(p)}>
                      {t('handover.write')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {writeFor && <SbarDialog patient={writeFor} onClose={() => setWriteFor(null)} />}
      </>
      )}
    </div>
  );
}

function Sbar({ label, text, strong }: { label: string; text: string | null; strong?: boolean }) {
  if (!text) return null;
  return (
    <p className={cn('text-ink/80', strong && 'font-semibold text-ink')}>
      <span className="me-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-ink/8 text-[0.65rem] font-extrabold text-ink/70 dark:bg-white/10" dir="ltr">
        {label}
      </span>
      {text}
    </p>
  );
}

function SbarDialog({ patient, onClose }: { patient: HandoverPatient; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ situation: '', background: patient.handover?.background ?? '', assessment: '', recommendation: '' });
  const save = useMutation({
    mutationFn: () => API.writeHandover(patient.admission_id, f),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover'] });
      toast.success(t('common.done'));
      onClose();
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${t('handover.write')} — ${localName(patient, 'full_name')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} disabled={f.situation.trim().length < 2} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea label={`S — ${t('handover.s')}`} rows={2} value={f.situation} onChange={set('situation')} placeholder={t('handover.sHint')} autoFocus />
        <Textarea label={`B — ${t('handover.b')}`} rows={2} value={f.background} onChange={set('background')} placeholder={t('handover.bHint')} />
        <Textarea label={`A — ${t('handover.a')}`} rows={2} value={f.assessment} onChange={set('assessment')} placeholder={t('handover.aHint')} />
        <Textarea label={`R — ${t('handover.r')}`} rows={2} value={f.recommendation} onChange={set('recommendation')} placeholder={t('handover.rHint')} />
        {save.error && <Alert variant="danger">{(save.error as Error).message}</Alert>}
      </div>
    </Dialog>
  );
}

/** ورقة تسليم المناوبة للطباعة (أفقية) */
function printHandover(list: HandoverPatient[], wardName: string, t: TFunction, user: User | null): void {
  const en = currentLang() === 'en';
  const rows = list.map((p) => {
    const h = p.handover;
    const v = p.vitals;
    return [
      { html: `<b>${esc(localName(p, 'full_name'))}</b><br><span class="muted"><bdi dir="ltr" class="nw">${esc(p.room)}/${esc(p.bed_no)}</bdi> · <bdi dir="ltr" class="nw">${esc(p.file_number)}</bdi>${p.birth_date ? ` · ${calcAge(p.birth_date)}` : ''}</span>` },
      { html: `${esc((en ? p.diagnoses_en : p.diagnoses_ar) || p.reason || '—')}${p.allergies.length ? `<br><b style="color:#b91c1c">${esc(t('handover.allergy'))}: ${esc(p.allergies.join('، '))}</b>` : ''}` },
      {
        html: v
          ? `<bdi dir="ltr">T ${v.temperature ?? '—'} · HR ${v.pulse ?? '—'} · RR ${v.respiratory_rate ?? '—'} · BP ${v.bp_systolic ?? '—'}/${v.bp_diastolic ?? '—'} · SpO₂ ${v.spo2 ?? '—'}</bdi>${p.mews ? `<br><b>MEWS ${p.mews.score}</b>` : ''}`
          : '—',
      },
      { html: `${esc(t('handover.pendingLabs', { count: p.pending_labs }))}<br>${esc(t('handover.pendingImaging', { count: p.pending_radiology }))}` },
      {
        html: h
          ? [['S', h.situation], ['B', h.background], ['A', h.assessment], ['R', h.recommendation]]
              .filter(([, x]) => x)
              .map(([k, x]) => `<b>${k}:</b> ${esc(x)}`)
              .join('<br>')
          : '',
      },
      { html: '&nbsp;' },
    ];
  });
  openPrintDocument({
    hospitalName: localName(user, 'hospital_name'),
    hospitalLogo: user?.hospital_logo_url,
    printedBy: `${t('print.printedBy')}: ${localName(user, 'full_name')}`,
    printedAtLabel: t('ui.printedAt'),
    pageLabel: t('print.page'),
    landscape: true,
    title: t('handover.title'),
    subtitle: wardName,
    body: htmlTable([t('handover.colPatient'), t('handover.diagnosis'), t('handover.colVitals'), t('handover.colPending'), 'SBAR', t('handover.colNotes')], rows, { cellClass: (i) => (i === 5 ? 'wide' : '') }),
    signatures: [t('handover.handedBy'), t('handover.receivedBy')],
  });
}
