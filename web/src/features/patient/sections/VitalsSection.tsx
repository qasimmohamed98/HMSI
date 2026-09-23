import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, ConfirmDialog } from '@/components/ui';
import { SectionCard } from './SectionCard';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API, type NewVitalsInput, type VitalsUpdateInput, type ChartData } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/ui';
import type { Vitals } from '@hmsi/shared';

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

  const addMut = useMutation({
    mutationFn: API.addVitals,
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast.success(t('common.done'));
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
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-start text-[0.7rem] font-bold uppercase text-ink/45">
                  {[
                    t('vitals.recordedAt'),
                    t('vitals.temperature'),
                    t('vitals.pulse'),
                    t('vitals.respiratoryRate'),
                    t('vitals.bp'),
                    t('vitals.spo2'),
                    t('vitals.weight'),
                    t('vitals.glucose'),
                    canWrite ? t('common.actions') : '',
                  ].map((h) => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {chart.admissionId && (
        <VitalsDialog open={open} onClose={() => setOpen(false)} onSubmit={(v) => addMut.mutate({ admissionId: chart.admissionId!, ...v })} busy={addMut.isPending} />
      )}
      {editTarget && (
        <VitalsDialog
          open
          onClose={() => setEditTarget(null)}
          initial={editTarget}
          onSubmit={(v) => updateMut.mutate({ id: editTarget.id, input: v })}
          busy={updateMut.isPending}
        />
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

type VitalsValues = Omit<NewVitalsInput, 'admissionId'>;

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
  const [values, setValues] = useState<Record<string, string>>(
    initial
      ? {
          temperature: initial.temperature != null ? String(initial.temperature) : '',
          pulse: initial.pulse != null ? String(initial.pulse) : '',
          rr: initial.respiratory_rate != null ? String(initial.respiratory_rate) : '',
          bpS: initial.bp_systolic != null ? String(initial.bp_systolic) : '',
          bpD: initial.bp_diastolic != null ? String(initial.bp_diastolic) : '',
          spo2: initial.spo2 != null ? String(initial.spo2) : '',
          weight: initial.weight != null ? String(initial.weight) : '',
          glucose: initial.glucose != null ? String(initial.glucose) : '',
        }
      : {},
  );

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const num = (k: string) => (values[k] === '' || values[k] == null ? null : Number(values[k]));

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
      title={initial ? t('common.edit') : t('vitals.add')}
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

function Cell({ value, suffix, warn }: { value: string | number | null; suffix?: string; warn?: boolean }) {
  if (value == null || value === '' || value === 'null/null') return <span className="text-ink/30">—</span>;
  return (
    <span className={`font-bold tabular ${warn ? 'text-danger-600' : 'text-ink'}`}>
      {String(value)}
      {suffix && <span className="ms-0.5 text-[0.7rem] font-medium text-ink/40">{suffix}</span>}
    </span>
  );
}