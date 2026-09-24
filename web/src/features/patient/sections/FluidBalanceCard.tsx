import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import { FLUID_KINDS, type FluidDirection, type FluidKind } from '@hmsi/shared';
import { Button, Dialog, Input, Select, useConfirm, useToast } from '@/components/ui';
import { SectionCard } from './SectionCard';
import { API, type ChartData } from '@/lib/api';
import { fmtDateTime, localName } from '@/lib/format';
import { newClientId, submitOrQueue } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 3600_000;

/** ميزان السوائل (Intake / Output) — مجموع آخر 24 ساعة وقائمة الإدخالات */
export function FluidBalanceCard({ chart, canWrite }: { chart: ChartData; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<FluidDirection | null>(null);

  const since = Date.now() - DAY_MS;
  const recent = chart.fluids.filter((f) => Date.parse(f.recorded_at) >= since);
  const totalIn = recent.filter((f) => f.direction === 'in').reduce((a, f) => a + f.volume_ml, 0);
  const totalOut = recent.filter((f) => f.direction === 'out').reduce((a, f) => a + f.volume_ml, 0);
  const balance = totalIn - totalOut;

  const addMut = useMutation({
    // لا توقف React Query الطلب عند انقطاع الشبكة — طابور offline-queue يتولى ذلك
    networkMode: 'always',
    mutationFn: (v: { direction: FluidDirection; kind: FluidKind; volumeMl: number; note: string | null }) =>
      submitOrQueue({
        kind: 'fluid',
        patientId: chart.patient.id,
        label: localName(chart.patient, 'full_name'),
        payload: { admissionId: chart.admissionId!, ...v, clientId: newClientId(), recordedAt: new Date().toISOString() },
      }),
    onSuccess: ({ queued }) => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setDialog(null);
      if (queued) toast.toast('info', t('offline.savedOffline'));
      else toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => API.deleteFluid(chart.admissionId!, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const active = canWrite && Boolean(chart.admissionId);

  return (
    <SectionCard
      title={t('fluids.title')}
      action={
        active ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<ArrowDownToLine className="h-4 w-4" />} onClick={() => setDialog('in')}>
              {t('fluids.addIn')}
            </Button>
            <Button size="sm" variant="secondary" icon={<ArrowUpFromLine className="h-4 w-4" />} onClick={() => setDialog('out')}>
              {t('fluids.addOut')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Total label={t('fluids.in24')} value={totalIn} />
        <Total label={t('fluids.out24')} value={totalOut} />
        <Total label={t('fluids.balance')} value={balance} signed tone={Math.abs(balance) >= 1500 ? 'warn' : undefined} />
      </div>

      {chart.fluids.length === 0 ? (
        <p className="py-6 text-center text-sm font-medium text-ink/40">{t('fluids.empty')}</p>
      ) : (
        <ul className="divide-y divide-ink/6 text-sm dark:divide-white/5">
          {chart.fluids.slice(0, 40).map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  f.direction === 'in' ? 'bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-200' : 'bg-warning-50 text-warning-800 dark:bg-warning-900/30 dark:text-warning-200',
                )}
              >
                {f.direction === 'in' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  {t(`fluids.kinds.${f.kind}`)} · <span className="tabular">{f.volume_ml}</span> <span className="text-xs font-medium text-ink/45">{t('fluids.ml')}</span>
                </p>
                <p className="truncate text-xs text-ink/50">
                  <span className="tabular">{fmtDateTime(f.recorded_at)}</span> · {f.recorded_by}
                  {f.note ? ` · ${f.note}` : ''}
                </p>
              </div>
              {active && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                  aria-label={t('common.delete')}
                  onClick={async () => {
                    if (await confirm(t('ui.confirmDeleteRecord'))) deleteMut.mutate(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog && <FluidDialog direction={dialog} onClose={() => setDialog(null)} busy={addMut.isPending} onSubmit={(v) => addMut.mutate({ direction: dialog, ...v })} />}
    </SectionCard>
  );
}

function Total({ label, value, signed, tone }: { label: string; value: number; signed?: boolean; tone?: 'warn' }) {
  const { t } = useTranslation();
  return (
    <div className={cn('rounded-xl bg-surface-muted/70 px-2 py-2.5 dark:bg-white/5', tone === 'warn' && 'ring-1 ring-warning-400')}>
      <p className={cn('text-lg font-extrabold tabular text-ink', tone === 'warn' && 'text-warning-700 dark:text-warning-300')}>
        <bdi dir="ltr">{signed && value > 0 ? `+${value}` : value}</bdi> <span className="text-xs font-semibold text-ink/45">{t('fluids.ml')}</span>
      </p>
      <p className="text-[0.7rem] font-bold text-ink/50">{label}</p>
    </div>
  );
}

function FluidDialog({
  direction,
  onClose,
  onSubmit,
  busy,
}: {
  direction: FluidDirection;
  onClose: () => void;
  onSubmit: (v: { kind: FluidKind; volumeMl: number; note: string | null }) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const kinds = FLUID_KINDS[direction] as readonly FluidKind[];
  const [kind, setKind] = useState<FluidKind>(kinds[0]!);
  const [volume, setVolume] = useState('');
  const [note, setNote] = useState('');
  const ml = Number(volume);
  const valid = Number.isInteger(ml) && ml >= 1 && ml <= 10000;

  return (
    <Dialog
      open
      onClose={onClose}
      title={direction === 'in' ? t('fluids.addIn') : t('fluids.addOut')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={busy} onClick={() => onSubmit({ kind, volumeMl: ml, note: note.trim() || null })}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label={t('fluids.kind')} value={kind} onChange={(e) => setKind(e.target.value as FluidKind)} options={kinds.map((k) => ({ value: k, label: t(`fluids.kinds.${k}`) }))} />
        <Input label={`${t('fluids.volume')} (${t('fluids.ml')})`} type="number" inputMode="numeric" min={1} max={10000} value={volume} onChange={(e) => setVolume(e.target.value)} dir="ltr" autoFocus />
        <div className="flex flex-wrap gap-2">
          {[50, 100, 250, 500, 1000].map((v) => (
            <button key={v} type="button" onClick={() => setVolume(String(v))} className="rounded-full border border-ink/15 px-3 py-1 text-sm font-bold tabular hover:bg-surface-muted dark:border-white/15 dark:hover:bg-white/5">
              {v}
            </button>
          ))}
        </div>
        <Input label={t('fluids.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>
    </Dialog>
  );
}
