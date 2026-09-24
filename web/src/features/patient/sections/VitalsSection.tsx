import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Plus, Pencil, Trash2, Activity } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calcMews, CONSCIOUSNESS_LEVELS, type Consciousness, type MewsResult, type Vitals } from '@hmsi/shared';
import { Button, Dialog, Input, ConfirmDialog, Select, useToast } from '@/components/ui';
import { SectionCard } from './SectionCard';
import { FluidBalanceCard } from './FluidBalanceCard';
import { API, type NewVitalsInput, type VitalsUpdateInput, type ChartData } from '@/lib/api';
import { fmtDateTime, localName } from '@/lib/format';
import { newClientId, submitOrQueue } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';

export function VitalsSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vitals | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vitals | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // الإدخال الجديد يمر عبر طابور العمل دون اتصال: يُرسل فوراً أو يُحفظ ليرسل عند عودة الشبكة
  const addMut = useMutation({
    // لا توقف React Query الطلب عند انقطاع الشبكة — طابور offline-queue يتولى ذلك
    networkMode: 'always',
    mutationFn: (v: VitalsValues) =>
      submitOrQueue({
        kind: 'vitals',
        patientId: chart.patient.id,
        label: localName(chart.patient, 'full_name'),
        payload: { admissionId: chart.admissionId!, ...v, clientId: newClientId(), recordedAt: new Date().toISOString() },
      }),
    onSuccess: ({ queued }) => {
      invalidate();
      setOpen(false);
      if (queued) toast.toast('info', t('offline.savedOffline'));
      else toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; input: VitalsUpdateInput }) => API.updateVitals(args.id, args.input),
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => API.deleteVitals(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success(t('common.done'));
    },
  });

  const data = [...chart.vitals].reverse().map((v) => ({
    t: fmtDateTime(v.recorded_at),
    temp: v.temperature,
    pulse: v.pulse,
    bp: v.bp_systolic,
    spo2: v.spo2,
    mews: calcMews(v)?.score ?? null,
  }));

  const latest = chart.vitals[0];
  const latestMews = latest ? calcMews(latest) : null;

  return (
    <div className="space-y-4">
      {latest && latestMews && <MewsCard mews={latestMews} at={latest.recorded_at} />}

      <SectionCard
        title={t('vitals.trend')}
        action={
          canWrite && chart.admissionId ? (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
              {t('vitals.add')}
            </Button>
          ) : undefined
        }
      >
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-ink/40">{t('vitals.empty')}</p>
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="temp" name={t('vitals.temperature')} stroke="#1e7f6e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="pulse" name={t('vitals.pulse')} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="bp" name={t('vitals.bpSystolic')} stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="spo2" name={t('vitals.spo2')} stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="stepAfter" dataKey="mews" name="MEWS" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('vitals.readings')}>
        {chart.vitals.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-ink/40">{t('vitals.empty')}</p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-start text-[0.7rem] font-bold uppercase text-ink/45">
                  {[
                    t('vitals.recordedAt'),
                    t('vitals.temperature'),
                    t('vitals.pulse'),
                    t('vitals.respiratoryRate'),
                    t('vitals.bp'),
                    t('vitals.spo2'),
                    t('vitals.pain'),
                    t('vitals.consciousness'),
                    'MEWS',
                    t('vitals.glucose'),
                    t('vitals.weight'),
                    canWrite ? t('common.actions') : '',
                  ].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/6 dark:divide-white/5">
                {chart.vitals.slice(0, 30).map((v) => {
                  const m = calcMews(v);
                  return (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular text-xs font-semibold text-ink/70">
                        {fmtDateTime(v.recorded_at)}
                        <span className="block text-[0.68rem] font-medium text-ink/40">{v.recorded_by}</span>
                      </td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.temperature} suffix={t('vitals.unitTemp')} warn={v.temperature != null && (v.temperature >= 38.5 || v.temperature < 35)} /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.pulse} warn={v.pulse != null && (v.pulse > 110 || v.pulse < 50)} /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.respiratory_rate} warn={v.respiratory_rate != null && (v.respiratory_rate >= 21 || v.respiratory_rate < 9)} /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : v.bp_systolic} warn={v.bp_systolic != null && (v.bp_systolic >= 180 || v.bp_systolic <= 90)} ltr /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.spo2} suffix="%" warn={v.spo2 != null && v.spo2 < 94} /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.pain_score} suffix="/10" warn={v.pain_score != null && v.pain_score >= 7} /></td>
                      <td className="px-3 py-2.5"><Cell value={v.consciousness ? t(`vitals.avpu.${v.consciousness}`) : null} warn={v.consciousness != null && v.consciousness !== 'alert'} /></td>
                      <td className="px-3 py-2.5">{m ? <MewsPill mews={m} /> : <span className="text-ink/30">—</span>}</td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.glucose} warn={v.glucose != null && (v.glucose > 180 || v.glucose < 70)} /></td>
                      <td className="px-3 py-2.5 tabular"><Cell value={v.weight} /></td>
                      {canWrite && (
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => setEditTarget(v)} aria-label={t('common.edit')}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30" onClick={() => setDeleteTarget(v)} aria-label={t('common.delete')}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <FluidBalanceCard chart={chart} canWrite={canWrite} />

      {chart.admissionId && open && <VitalsDialog open onClose={() => setOpen(false)} onSubmit={(v) => addMut.mutate(v)} busy={addMut.isPending} />}
      {editTarget && (
        <VitalsDialog open onClose={() => setEditTarget(null)} initial={editTarget} onSubmit={(v) => updateMut.mutate({ id: editTarget.id, input: v })} busy={updateMut.isPending} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title={t('common.delete')}
          message={t('vitals.deleteConfirm', { when: fmtDateTime(deleteTarget.recorded_at) })}
          busy={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
}

const MEWS_TONE = {
  low: 'border-success-200 bg-success-50 text-success-800 dark:border-success-900/50 dark:bg-success-900/20 dark:text-success-200',
  medium: 'border-warning-300 bg-warning-50 text-warning-900 dark:border-warning-900/50 dark:bg-warning-900/20 dark:text-warning-200',
  high: 'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-900/50 dark:bg-danger-900/25 dark:text-danger-200',
} as const;

/** درجة الإنذار المبكر لآخر قراءة + الإجراء المقترح */
function MewsCard({ mews, at }: { mews: MewsResult; at: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-4', MEWS_TONE[mews.level])} role={mews.level === 'high' ? 'alert' : undefined}>
      <Activity className="h-6 w-6 shrink-0" />
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold">MEWS</span>
        <span className="text-3xl font-extrabold tabular">{mews.score}</span>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">{t(`mews.level.${mews.level}`)}</p>
        <p className="opacity-80">{t(`mews.action.${mews.level}`)}</p>
      </div>
      <div className="text-xs opacity-75">
        <p className="tabular">{fmtDateTime(at)}</p>
        {mews.measured < 5 && <p>{t('mews.partial', { n: mews.measured })}</p>}
      </div>
    </div>
  );
}

function MewsPill({ mews }: { mews: MewsResult }) {
  return (
    <span className={cn('inline-flex min-w-8 justify-center rounded-full border px-2 py-0.5 text-xs font-extrabold tabular', MEWS_TONE[mews.level])}>
      {mews.score}
      {mews.measured < 5 && <span className="opacity-60">*</span>}
    </span>
  );
}

type VitalsValues = Omit<NewVitalsInput, 'admissionId' | 'clientId' | 'recordedAt'>;

function VitalsDialog({
  open,
  onClose,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Vitals | null;
  onSubmit: (v: VitalsValues) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const str = (v: number | null | undefined) => (v != null ? String(v) : '');
  const [values, setValues] = useState<Record<string, string>>(
    initial
      ? {
          temperature: str(initial.temperature),
          pulse: str(initial.pulse),
          rr: str(initial.respiratory_rate),
          bpS: str(initial.bp_systolic),
          bpD: str(initial.bp_diastolic),
          spo2: str(initial.spo2),
          weight: str(initial.weight),
          glucose: str(initial.glucose),
          pain: str(initial.pain_score),
          avpu: initial.consciousness ?? '',
        }
      : {},
  );

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const num = (k: string) => (values[k] === '' || values[k] == null ? null : Number(values[k]));
  const empty = Object.values(values).every((v) => v === '' || v == null);

  const submit = () => {
    onSubmit({
      temperature: num('temperature'),
      pulse: num('pulse'),
      respiratoryRate: num('rr'),
      bpSystolic: num('bpS') || null,
      bpDiastolic: num('bpD') || null,
      spo2: num('spo2'),
      weight: num('weight'),
      glucose: num('glucose'),
      painScore: num('pain'),
      consciousness: (values.avpu || null) as Consciousness | null,
    });
  };

  // معاينة MEWS أثناء الإدخال
  const preview = calcMews({
    bp_systolic: num('bpS'),
    pulse: num('pulse'),
    respiratory_rate: num('rr'),
    temperature: num('temperature'),
    consciousness: (values.avpu || null) as Consciousness | null,
  });

  const fields: { key: string; label: string; step?: string }[] = [
    { key: 'temperature', label: `${t('vitals.temperature')} (℃)`, step: '0.1' },
    { key: 'pulse', label: t('vitals.pulse') },
    { key: 'rr', label: t('vitals.respiratoryRate') },
    { key: 'spo2', label: `${t('vitals.spo2')} (%)` },
    { key: 'bpS', label: t('vitals.bpSystolic') },
    { key: 'bpD', label: t('vitals.bpDiastolic') },
    { key: 'glucose', label: `${t('vitals.glucose')} (${t('vitals.unitGlucose')})` },
    { key: 'weight', label: `${t('vitals.weight')} (${t('vitals.unitWeight')})`, step: '0.1' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? t('common.edit') : t('vitals.add')}
      footer={
        <>
          {preview && <span className="me-auto"><MewsPill mews={preview} /></span>}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={empty}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((f) => (
          <Input key={f.key} label={f.label} type="number" inputMode="decimal" step={f.step} value={values[f.key] ?? ''} onChange={set(f.key)} dir="ltr" />
        ))}
        <Select
          label={t('vitals.pain')}
          value={values.pain ?? ''}
          onChange={set('pain')}
          options={[{ value: '', label: '—' }, ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: `${i}${i === 0 ? ` · ${t('vitals.painNone')}` : i === 10 ? ` · ${t('vitals.painWorst')}` : ''}` }))]}
        />
        <div className="col-span-1 sm:col-span-3">
          <Select
            label={t('vitals.consciousness')}
            value={values.avpu ?? ''}
            onChange={set('avpu')}
            options={[{ value: '', label: '—' }, ...CONSCIOUSNESS_LEVELS.map((c) => ({ value: c, label: t(`vitals.avpu.${c}`) }))]}
          />
        </div>
      </div>
    </Dialog>
  );
}

function Cell({ value, suffix, warn, ltr }: { value: string | number | null | undefined; suffix?: string; warn?: boolean; ltr?: boolean }) {
  if (value == null || value === '') return <span className="text-ink/30">—</span>;
  return (
    <span className={`whitespace-nowrap font-bold tabular ${warn ? 'text-danger-600' : 'text-ink'}`}>
      {ltr ? <bdi dir="ltr">{String(value)}</bdi> : String(value)}
      {suffix && <span className="ms-0.5 text-[0.7rem] font-medium text-ink/40">{suffix}</span>}
    </span>
  );
}
