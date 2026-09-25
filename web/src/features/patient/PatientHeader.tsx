import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FAMILY_SHARE_CATEGORIES } from '@hmsi/shared';
import { FamilyShareDialog } from './FamilyShareDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Patient, AdmissionSummary } from '@hmsi/shared';
import { ArrowRight, CalendarClock, Eye, KeyRound, MapPin, RefreshCw, Stethoscope, UserRound } from 'lucide-react';
import { Badge, Chip, Avatar, Button, useToast } from '@/components/ui';
import { API } from '@/lib/api';
import { currentLang } from '@/i18n';
import { calcAge, fmtDate, localName } from '@/lib/format';
import { jsonParse } from '@/lib/demo-data';

export function PatientHeader({
  patient,
  admission,
  onBack,
  canManagePin = false,
  canShare = false,
  isDoctor = false,
}: {
  patient: Patient;
  admission: AdmissionSummary | null;
  onBack: () => void;
  canManagePin?: boolean;
  canShare?: boolean;
  isDoctor?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const pinMut = useMutation({
    mutationFn: (admissionId: string) => API.regenerateFamilyPin(admissionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', patient.id] });
      toast.success(t('familyPin.regenerated'));
    },
  });
  const [shareOpen, setShareOpen] = useState(false);
  const allergies = jsonParse<string[]>(patient.allergies_json, []);
  const alerts = jsonParse<string[]>(patient.critical_alerts_json, []);
  const hasIssues = allergies.length > 0 || alerts.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200/70 bg-gradient-to-br from-surface-raised via-backdrop-sat to-brand-50/40 shadow-card dark:border-brand-900/60 dark:from-surface-raised dark:to-brand-950/30">
      <div className="absolute inset-y-0 start-0 w-1.5 bg-gradient-to-b from-brand-400 to-brand-600" aria-hidden />
      <div className="flex flex-col gap-4 p-4 pt-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6 lg:items-center">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="mr-1 hidden h-10 w-10 items-center justify-center rounded-lg text-ink/50 hover:bg-surface-muted hover:text-ink lg:flex" aria-label={t('common.back')}>
            <ArrowRight className="h-5 w-5 ltr:rotate-180" />
          </button>
          <Avatar name={localName(patient, 'full_name')} className="h-14 w-14 text-lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold text-ink sm:text-2xl">{localName(patient, 'full_name')}</h1>
              <Badge variant="outline" className="tabular font-bold"><bdi dir="ltr">{patient.file_number}</bdi></Badge>
            </div>
            <p className="text-sm font-medium text-ink/50">{currentLang() === 'ar' ? patient.full_name_en : patient.full_name_ar}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink/60">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5 text-brand-600" />
                {t('gender.' + patient.gender)} · {calcAge(patient.birth_date)} {t('common.years')}
              </span>
              <span className="text-ink/25">·</span>
              <span className="tabular">
                {t('patients.bloodType')} <bdi dir="ltr">{patient.blood_type}</bdi>
              </span>
              {patient.national_id && (
                <>
                  <span className="text-ink/25">·</span>
                  <span className="tabular">{patient.national_id}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admission summary */}
        {admission && (
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl border border-ink/8 bg-surface-raised/70 p-4 sm:grid-cols-4 lg:grid-cols-3 dark:border-white/10 dark:bg-white/5">
            <Meta icon={<MapPin className="h-4 w-4" />} label={t('patients.department')} value={localName(admission, 'department_name')} />
            <Meta icon={<MapPin className="h-4 w-4" />} label={t('patients.ward')} value={localName(admission, 'ward_name')} />
            <Meta icon={<MapPin className="h-4 w-4" />} label={t('patients.bed')} value={`${admission.room} / ${admission.bed_no}`} mono />
            <Meta icon={<Stethoscope className="h-4 w-4" />} label={t('chart.attendingDoctor')} value={admission.attending_doctor ?? '—'} />
            <Meta icon={<CalendarClock className="h-4 w-4" />} label={t('chart.admitted')} value={fmtDate(admission.admitted_at, { day: 'numeric', month: 'short', year: 'numeric' })} mono />
            <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
              <Badge variant={admission.status === 'active' ? 'success' : 'neutral'} dot>
                {t('status.' + admission.status)}
              </Badge>
            </div>
            {admission.reason && (
              <div className="col-span-2 sm:col-span-4 lg:col-span-3">
                <Meta icon={<Stethoscope className="h-4 w-4" />} label={t('history.reason')} value={admission.reason} />
              </div>
            )}
          </div>
        )}

        {shareOpen && admission && <FamilyShareDialog patientId={patient.id} admission={admission} isDoctor={isDoctor} onClose={() => setShareOpen(false)} />}

        {/* Issues */}
        {hasIssues && (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[180px]">
            {allergies.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.7rem] font-bold text-danger-600">⚠ {t('chart.allergies')}</span>
                {allergies.map((a) => (
                  <Chip key={a} label={a} tone="danger" />
                ))}
              </div>
            )}
            {alerts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.7rem] font-bold text-warning-700">! {t('chart.critical')}</span>
                {alerts.map((a) => (
                  <Chip key={a} label={a} tone="warning" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {admission && admission.status === 'active' && admission.family_pin && (
        <div className="no-print mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-brand-300 px-3 py-2 sm:mx-6 dark:border-brand-800" title={t('familyPin.hint')}>
          <KeyRound className="h-4 w-4 text-brand-600" />
          <span className="text-xs font-bold text-ink/55">{t('familyPin.title')}:</span>
          <span className="font-mono text-base font-extrabold tracking-[0.3em] text-ink" dir="ltr">{admission.family_pin}</span>
          {canManagePin && (
            <Button size="sm" variant="ghost" loading={pinMut.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => pinMut.mutate(admission.id)}>
              {t('familyPin.regenerate')}
            </Button>
          )}
          <div className="flex flex-1 flex-wrap items-center gap-1.5 border-brand-200 sm:border-s sm:ps-3 dark:border-brand-900">
            <span className="text-xs font-bold text-ink/55">{t('familyShare.visible')}:</span>
            {FAMILY_SHARE_CATEGORIES.filter((k) => admission.family_share?.[k]).map((k) => (
              <Badge key={k} variant="brand">{t(`familyShare.categories.${k}`)}</Badge>
            ))}
            {admission.family_message && <Badge variant="info">{t('familyShare.hasMessage')}</Badge>}
            {!FAMILY_SHARE_CATEGORIES.some((k) => admission.family_share?.[k]) && !admission.family_message && <span className="text-xs text-ink/45">{t('familyShare.nothing')}</span>}
            {canShare && (
              <Button size="sm" variant="outline" className="ms-auto" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setShareOpen(true)}>
                {t('familyShare.edit')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[0.66rem] font-bold uppercase tracking-wide text-ink/40">
        {icon}
        {label}
      </p>
      <p className={`truncate text-sm font-bold text-ink ${mono ? 'tabular' : ''}`}>{value}</p>
    </div>
  );
}