import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PauseCircle, XCircle, Syringe, X } from 'lucide-react';
import { ADMINISTRATION_STATUSES, type AdministrationStatus, type Medication } from '@hmsi/shared';
import { Alert, Button, Dialog, Input, useConfirm, useToast } from '@/components/ui';
import { API, type ChartData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, localName } from '@/lib/format';
import { newClientId, submitOrQueue } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';

const ICON = { given: CheckCircle2, held: PauseCircle, refused: XCircle } as const;
const TONE = {
  given: 'text-success-700 bg-success-50 dark:bg-success-900/25 dark:text-success-200',
  held: 'text-warning-800 bg-warning-50 dark:bg-warning-900/25 dark:text-warning-200',
  refused: 'text-danger-700 bg-danger-50 dark:bg-danger-900/25 dark:text-danger-200',
} as const;

/** سجل إعطاء الجرعات (MAR) لدواء واحد: آخر الجرعات + تسجيل جرعة جديدة */
export function MarStrip({ chart, medication, canAdminister }: { chart: ChartData; medication: Medication; canAdminister: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [dialog, setDialog] = useState(false);

  const entries = chart.administrations.filter((a) => a.medication_id === medication.id);
  const since = Date.now() - 24 * 3600_000;
  const given24 = entries.filter((a) => a.status === 'given' && Date.parse(a.administered_at) >= since).length;
  const lastGiven = entries.find((a) => a.status === 'given');

  const giveMut = useMutation({
    // لا توقف React Query الطلب عند انقطاع الشبكة — طابور offline-queue يتولى ذلك
    networkMode: 'always',
    mutationFn: (v: { status: AdministrationStatus; note: string | null }) =>
      submitOrQueue({
        kind: 'administration',
        patientId: chart.patient.id,
        label: `${localName(chart.patient, 'full_name')} — ${medication.name_ar}`,
        payload: { admissionId: chart.admissionId!, medicationId: medication.id, ...v, clientId: newClientId(), administeredAt: new Date().toISOString() },
      }),
    onSuccess: ({ queued }) => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setDialog(false);
      if (queued) toast.toast('info', t('offline.savedOffline'));
      else toast.success(t('common.done'));
    },
  });

  const undoMut = useMutation({
    mutationFn: (id: string) => API.deleteAdministration(chart.admissionId!, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  const canGive = canAdminister && medication.status === 'active' && Boolean(chart.admissionId);
  if (!canGive && entries.length === 0) return null;

  return (
    <div className="mt-3 border-t border-ink/8 pt-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1 font-bold text-ink/55">
          <Syringe className="h-3.5 w-3.5" />
          {t('mar.title')}
        </span>
        <span className="text-ink/55">
          {lastGiven ? (
            <>
              {t('mar.lastGiven')}: <span className="font-bold tabular text-ink">{fmtDateTime(lastGiven.administered_at)}</span>
            </>
          ) : (
            t('mar.noneGiven')
          )}
        </span>
        <span className="text-ink/55">
          {t('mar.given24', { count: given24 })}
        </span>
        {canGive && (
          <Button size="sm" variant="secondary" className="ms-auto" icon={<Syringe className="h-3.5 w-3.5" />} onClick={() => setDialog(true)}>
            {t('mar.record')}
          </Button>
        )}
      </div>

      {entries.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entries.slice(0, 8).map((a) => {
            const Icon = ICON[a.status];
            const mine = a.administered_by_id === user?.id && Date.now() - Date.parse(a.administered_at) < 3600_000;
            return (
              <li
                key={a.id}
                className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold', TONE[a.status])}
                title={`${t(`mar.statuses.${a.status}`)} · ${a.administered_by}${a.note ? ` · ${a.note}` : ''}`}
              >
                <Icon className="h-3 w-3" />
                <span className="tabular">{fmtDateTime(a.administered_at)}</span>
                {a.status !== 'given' && <span>· {t(`mar.statuses.${a.status}`)}</span>}
                {mine && canAdminister && (
                  <button
                    type="button"
                    className="ms-0.5 rounded-full opacity-60 hover:opacity-100"
                    aria-label={t('mar.undo')}
                    onClick={async () => {
                      if (await confirm(t('mar.undoConfirm'))) undoMut.mutate(a.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <AdministerDialog
          medication={medication}
          lastGivenAt={lastGiven?.administered_at ?? null}
          busy={giveMut.isPending}
          onClose={() => setDialog(false)}
          onSubmit={(v) => giveMut.mutate(v)}
        />
      )}
    </div>
  );
}

function AdministerDialog({
  medication,
  lastGivenAt,
  busy,
  onClose,
  onSubmit,
}: {
  medication: Medication;
  lastGivenAt: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: { status: AdministrationStatus; note: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AdministrationStatus>('given');
  const [note, setNote] = useState('');
  const needsReason = status !== 'given';
  const valid = !needsReason || note.trim().length > 0;
  // تنبيه الجرعة المكررة: جرعة أُعطيت خلال آخر ساعة
  const recent = lastGivenAt && Date.now() - Date.parse(lastGivenAt) < 3600_000;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('mar.record')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={busy} onClick={() => onSubmit({ status, note: note.trim() || null })}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-muted/70 p-3 dark:bg-white/5">
          <p className="font-bold text-ink">{localName(medication, 'name')}</p>
          <p className="text-sm text-ink/60">
            {medication.dose} · {medication.route} · {medication.frequency}
          </p>
        </div>
        {!medication.dispensed_at && <Alert variant="warning">{t('mar.notDispensed')}</Alert>}
        {recent && <Alert variant="warning">{t('mar.recentDose', { when: fmtDateTime(lastGivenAt!) })}</Alert>}
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {ADMINISTRATION_STATUSES.map((s) => {
            const Icon = ICON[s];
            const on = s === status;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-bold transition-colors',
                  on ? cn('border-transparent ring-2 ring-brand-500', TONE[s]) : 'border-ink/12 text-ink/70 hover:bg-surface-muted dark:border-white/12 dark:hover:bg-white/5',
                )}
              >
                <Icon className="h-5 w-5" />
                {t(`mar.statuses.${s}`)}
              </button>
            );
          })}
        </div>
        <Input label={needsReason ? t('mar.reason') : t('mar.noteOptional')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} required={needsReason} />
      </div>
    </Dialog>
  );
}
