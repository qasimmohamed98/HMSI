import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ambulance, ScanLine, Stethoscope } from 'lucide-react';
import type { Patient } from '@hmsi/shared';
import { Alert, Button, Dialog, Input, Select, useToast } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API, type EncounterInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { localName } from '@/lib/format';

type VisitType = EncounterInput['encounter_type'];
const TYPES: { id: VisitType; icon: typeof Stethoscope }[] = [
  { id: 'outpatient', icon: Stethoscope },
  { id: 'emergency', icon: Ambulance },
  { id: 'diagnostic', icon: ScanLine },
];
/** القسم المقترح لكل نوع زيارة */
const SUGGEST: Record<VisitType, string[]> = { outpatient: ['outpatient', 'clinical'], emergency: ['emergency'], diagnostic: ['radiology', 'lab'] };

/** فتح زيارة بلا تنويم: مراجع، طوارئ، أو فحص فقط بتحويل */
export function EncounterDialog({ patient, onClose, onDone, defaultType = 'diagnostic' }: { patient: Patient; onClose: () => void; onDone: (admissionId: string) => void; defaultType?: VisitType }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: API.listDepartments });
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: API.listDoctors });
  const [type, setType] = useState<VisitType>(defaultType);
  const [f, setF] = useState({ department_id: '', attending_doctor_id: '', reason: '', referral_source: '', referring_doctor: '', referral_note: '' });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  // ترتيب الأقسام: المناسبة لنوع الزيارة أولاً
  const depts = [...(departments ?? [])].sort((a, b) => Number(SUGGEST[type].includes(b.kind ?? 'clinical')) - Number(SUGGEST[type].includes(a.kind ?? 'clinical')));
  const departmentId = f.department_id || depts[0]?.id || '';

  const open = useMutation({
    mutationFn: () =>
      API.createEncounter({
        patient_id: patient.id,
        encounter_type: type,
        department_id: departmentId,
        attending_doctor_id: f.attending_doctor_id || null,
        reason: f.reason.trim() || null,
        referral_source: f.referral_source.trim() || null,
        referring_doctor: f.referring_doctor.trim() || null,
        referral_note: f.referral_note.trim() || null,
      }),
    onSuccess: (r) => {
      toast.success(t('encounter.opened'));
      onDone(r.admission_id);
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${t('encounter.title')} — ${localName(patient, 'full_name')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => open.mutate()} loading={open.isPending} disabled={!departmentId}>
            {t('encounter.open')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink/60">{t('encounter.intro')}</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('encounter.type')}>
        {TYPES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={type === id}
            onClick={() => setType(id)}
            className={cn(
              'rounded-xl border p-3 text-start transition-colors',
              type === id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-ink/12 hover:bg-surface-muted dark:border-white/15',
            )}
          >
            <Icon className={cn('mb-1 h-5 w-5', type === id ? 'text-brand-600' : 'text-ink/45')} />
            <span className="block font-bold text-ink">{t(`encounter.types.${id}`)}</span>
            <span className="block text-xs text-ink/55">{t(`encounter.typeHints.${id}`)}</span>
          </button>
        ))}
      </div>

      {departments && departments.length === 0 && <Alert variant="warning">{t('departments.empty')}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('encounter.department')}
          value={departmentId}
          onChange={(e) => set('department_id', e.target.value)}
          options={depts.map((d) => ({ value: d.id, label: `${localName(d, 'name')} — ${t(`org.kinds.${d.kind ?? 'clinical'}`)}` }))}
        />
        <Select
          label={t('encounter.doctor')}
          value={f.attending_doctor_id}
          onChange={(e) => set('attending_doctor_id', e.target.value)}
          options={[{ value: '', label: t('encounter.noDoctor') }, ...(doctors ?? []).map((d) => ({ value: d.id, label: localName(d, 'full_name') }))]}
        />
        <div className="sm:col-span-2">
          <Input label={t('encounter.reason')} value={f.reason} onChange={(e) => set('reason', e.target.value)} maxLength={500} />
        </div>
      </div>

      <fieldset className="mt-5 rounded-xl border border-ink/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-bold text-ink">{t('encounter.referral')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('encounter.referralSource')} placeholder={t('encounter.referralSourceHint')} value={f.referral_source} onChange={(e) => set('referral_source', e.target.value)} maxLength={160} />
          <Input label={t('encounter.referringDoctor')} value={f.referring_doctor} onChange={(e) => set('referring_doctor', e.target.value)} maxLength={120} />
          <div className="sm:col-span-2">
            <Textarea label={t('encounter.referralNote')} value={f.referral_note} onChange={(e) => set('referral_note', e.target.value)} rows={2} maxLength={1000} />
          </div>
        </div>
      </fieldset>
    </Dialog>
  );
}
