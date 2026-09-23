import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Plus } from 'lucide-react';
import { Button, Dialog, Input } from '@/components/ui';
import { SectionCard } from './SectionCard';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API, type NewVitalsInput, type ChartData } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';

export function VitalsSection({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: API.addVitals,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const data = [...chart.vitals].reverse().map((v) => ({
    t: fmtDateTime(v.recorded_at),
    temp: v.temperature,
    pulse: v.pulse,
    bp: v.bp_systolic,
    spo2: v.spo2,
  }));

  return (
    <div className="space-y-4">
      {/* Chart */}
      <SectionCard
        title={t('vitals.title')}
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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="temp" name={t('vitals.temperature')} stroke="#1e7f6e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="pulse" name={t('vitals.pulse')} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="bp" name={t('vitals.bp')} stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="spo2" name={t('vitals.spo2')} stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Readings table */}
      <SectionCard title={t('vitals.title')}>
        {chart.vitals.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-ink/40">{t('vitals.empty')}</p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-start text-[0.7rem] font-bold uppercase text-ink/45">
                  {[t('vitals.recordedAt'), t('vitals.temperature'), t('vitals.pulse'), t('vitals.respiratoryRate'), t('vitals.bp'), t('vitals.spo2'), t('vitals.weight'), t('vitals.glucose')].map((h) => (
                    <th key={h} className="px-3 py-2 text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/6 dark:divide-white/5">
                {chart.vitals.slice(0, 12).map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular text-xs font-semibold text-ink/70">{fmtDateTime(v.recorded_at)}</td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.temperature} suffix={t('vitals.unitTemp')} warn={v.temperature != null && v.temperature >= 38} /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.pulse} suffix="" warn={v.pulse != null && v.pulse >= 110} /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.respiratory_rate} suffix="" /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null} suffix="" warn={v.bp_systolic != null && v.bp_systolic >= 160} /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.spo2} suffix="%" warn={v.spo2 != null && v.spo2 < 94} /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.weight} suffix="" /></td>
                    <td className="px-3 py-2.5 tabular"><Cell value={v.glucose} suffix="" warn={v.glucose != null && v.glucose > 180} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <AddVitalsDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} onSubmit={(v) => mut.mutate(v)} busy={mut.isPending} />
    </div>
  );
}

function Cell({ value, suffix, warn }: { value: string | number | null; suffix?: string; warn?: boolean }) {
  if (value == null || value === '' || value === 'null/null') return <span className="text-ink/30">—</span>;
  return (
    <span className={`font-bold tabular ${warn ? 'text-danger-600' : 'text-ink'}`}>
      {String(value)}
      {suffix && <span className="ms-0.5 text-[0.7rem] font-medium text-ink/40">{suffix}</span>}
    </span>
  );
}

function AddVitalsDialog({ open, onClose, admissionId, onSubmit, busy }: { open: boolean; onClose: () => void; admissionId: string | null; onSubmit: (v: NewVitalsInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});
  if (!admissionId) return null;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const num = (k: string) => (values[k] === '' ? null : Number(values[k]));

  const submit = () => {
    onSubmit({
      admissionId,
      temperature: num('temperature'),
      pulse: num('pulse'),
      respiratoryRate: num('rr'),
      bpSystolic: num('bpS') || null,
      bpDiastolic: num('bpD') || null,
      spo2: num('spo2'),
      weight: num('weight'),
      glucose: num('glucose'),
    });
  };

  const fields: { key: string; label: string }[] = [
    { key: 'temperature', label: t('vitals.temperature') },
    { key: 'pulse', label: t('vitals.pulse') },
    { key: 'rr', label: t('vitals.respiratoryRate') },
    { key: 'bpS', label: t('vitals.bp') + ' (S)' },
    { key: 'bpD', label: t('vitals.bp') + ' (D)' },
    { key: 'spo2', label: t('vitals.spo2') },
    { key: 'weight', label: t('vitals.weight') },
    { key: 'glucose', label: t('vitals.glucose') },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('vitals.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((f) => (
          <Input key={f.key} label={f.label} type="number" inputMode="decimal" value={values[f.key] ?? ''} onChange={set(f.key)} />
        ))}
      </div>
    </Dialog>
  );
}