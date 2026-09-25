import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { hasPermission, type ChartSection, type Permission } from '@hmsi/shared';
import { useAuth } from '@/lib/auth';
import { API } from '@/lib/api';
import { Card, CardContent, Skeleton, EmptyState, Alert, Select, Button } from '@/components/ui';
import { Tag } from 'lucide-react';
import { printWristband } from '@/lib/labels';
import { PrintMenu } from '@/features/patient/PrintMenu';
import { fmtDate, fmtDateTime, localName } from '@/lib/format';
import { PatientHeader } from '@/features/patient/PatientHeader';
import { OverviewSection } from '@/features/patient/sections/OverviewSection';
import { VitalsSection } from '@/features/patient/sections/VitalsSection';
import { NotesSection } from '@/features/patient/sections/NotesSection';
import { DiagnosisSection } from '@/features/patient/sections/DiagnosisSection';
import { MedicationsSection } from '@/features/patient/sections/MedicationsSection';
import { LaboratorySection } from '@/features/patient/sections/LaboratorySection';
import { RadiologySection } from '@/features/patient/sections/RadiologySection';
import { ConsultationsSection } from '@/features/patient/sections/ConsultationsSection';
import { ProceduresSection } from '@/features/patient/sections/ProceduresSection';
import { AttachmentsSection } from '@/features/patient/sections/AttachmentsSection';
import { TimelineSection } from '@/features/patient/sections/TimelineSection';
import { DischargeSection } from '@/features/patient/sections/DischargeSection';
import { cn } from '@/lib/utils';
import { CarePlanSection } from '@/features/patient/sections/CarePlanSection';
import { CareTeamCard } from '@/features/careteam/CareTeamCard';
import { NotYourPatient } from '@/features/careteam/NotYourPatient';

const SECTIONS: { value: ChartSection }[] = [
  { value: 'overview' },
  { value: 'plan' },
  { value: 'vitals' },
  { value: 'diagnosis' },
  { value: 'doctorNotes' },
  { value: 'nursing' },
  { value: 'medications' },
  { value: 'laboratory' },
  { value: 'radiology' },
  { value: 'consultations' },
  { value: 'procedures' },
  { value: 'attachments' },
  { value: 'timeline' },
  { value: 'discharge' },
];

export default function PatientChartPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  // ?tab=vitals من جولة التمريض يفتح التبويب مباشرة
  const [section, setSection] = useState<ChartSection>(() => {
    const tab = params.get('tab') as ChartSection | null;
    return tab && SECTIONS.some((s) => s.value === tab) ? tab : 'overview';
  });
  // التنويم المعروض: undefined = الحالي/الأحدث
  const [admissionId, setAdmissionId] = useState<string | undefined>(undefined);

  const { data: chart, isLoading, error, refetch } = useQuery({
    // المفتاح الأول ['chart', id] يبقى ثابتاً حتى تعمل invalidateQueries في الأقسام
    queryKey: ['chart', id, admissionId ?? 'current'],
    queryFn: () => API.getChart(id!, admissionId),
    enabled: Boolean(id),
    // «ليس من مرضاك» لا يُعاد طلبه
    retry: (n, e) => (e as { status?: number }).status !== 403 && n < 1,
  });

  const sectionKey = (s: ChartSection) => `chart.sections.${s}`;

  const can = useMemo(() => (p: Permission) => hasPermission(user?.role, p), [user]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full" />
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((error as { code?: string } | null)?.code === 'not_your_patient') {
    return <NotYourPatient patientId={id!} onGranted={() => void refetch()} />;
  }

  if (error || !chart || !chart.patient) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title={t('errors.notFound')}
            action={{ label: t('common.retry'), onClick: () => void refetch() }}
          />
        </CardContent>
      </Card>
    );
  }

  // التنويم المنتهي: للقراءة (عدا الملاحظات المتأخرة ونتائج الفحوص المطلوبة قبل الخروج)
  const active = chart.patient.admission?.status === 'active';
  const viewingPast = Boolean(admissionId) && chart.admissions[0]?.id !== chart.admissionId;
  const canWrite = {
    vitals: active && can('vitals.write'),
    doctor: can('notes.write.doctor'),
    nursing: can('notes.write.nursing'),
    diagnosis: active && can('notes.write.doctor'),
    medication: active && can('medications.manage'),
    administer: active && can('medications.administer'),
    labOrder: can('lab.order'),
    labResult: can('lab.add_result'),
    radOrder: can('radiology.order'),
    radResult: can('radiology.add_report'),
    consultation: active && can('notes.write.doctor'),
    procedure: active && can('notes.write.doctor'),
    files: can('files.manage'),
    discharge: can('discharge.approve'),
  };

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <OverviewSection chart={chart} />;
      case 'plan':
        return chart.admissionId ? (
          <CarePlanSection chart={chart} canEdit={active && can('notes.write.doctor')} canEditVitals={active && can('vitals.write')} />
        ) : (
          <Alert variant="info">{t('carePlan.noAdmission')}</Alert>
        );
      case 'vitals':
        return <VitalsSection chart={chart} canWrite={canWrite.vitals} />;
      case 'doctorNotes':
        return <NotesSection chart={chart} kind="doctor" canWrite={canWrite.doctor} />;
      case 'nursing':
        return <NotesSection chart={chart} kind="nursing" canWrite={canWrite.nursing} />;
      case 'diagnosis':
        return <DiagnosisSection chart={chart} canWrite={canWrite.diagnosis} />;
      case 'medications':
        return <MedicationsSection chart={chart} canWrite={canWrite.medication} canAdminister={canWrite.administer} />;
      case 'laboratory':
        return <LaboratorySection chart={chart} canOrder={canWrite.labOrder} canResult={canWrite.labResult} />;
      case 'radiology':
        return <RadiologySection chart={chart} canOrder={canWrite.radOrder} canResult={canWrite.radResult} />;
      case 'consultations':
        return <ConsultationsSection chart={chart} canWrite={canWrite.consultation} />;
      case 'procedures':
        return <ProceduresSection chart={chart} canWrite={canWrite.procedure} />;
      case 'attachments':
        return <AttachmentsSection chart={chart} canWrite={canWrite.files} />;
      case 'timeline':
        return <TimelineSection chart={chart} />;
      case 'discharge':
        return <DischargeSection chart={chart} canDischarge={canWrite.discharge} />;
    }
  };

  return (
    <div className="space-y-4">
      <PatientHeader
        patient={chart.patient}
        admission={chart.patient.admission}
        onBack={() => navigate('/patients')}
        canManagePin={can('admissions.manage')}
        canShare={can('family.share') && chart.patient.admission?.status === 'active' && !viewingPast}
        isDoctor={can('notes.write.doctor')}
      />

      {chart.admissions.length > 1 && (
        <div className="min-w-[16rem] max-w-md">
          <Select
            label={t('history.title')}
            value={chart.admissionId ?? ''}
            onChange={(e) => setAdmissionId(e.target.value === chart.admissions[0]?.id ? undefined : e.target.value)}
            options={chart.admissions.map((a, i) => ({
              value: a.id,
              label: `${fmtDate(a.admitted_at, { day: 'numeric', month: 'short', year: 'numeric' })}${a.discharged_at ? ` → ${fmtDate(a.discharged_at, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''} · ${a.department_name_ar}${i === 0 ? ` (${t('history.current')})` : ''}`,
            }))}
          />
        </div>
      )}
      {viewingPast && <Alert variant="info">{t('history.viewingPast')}</Alert>}
      {chart.admissionId && !viewingPast && active && <CareTeamCard chart={chart} />}

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {chart.patient.admission && (
          <Button size="sm" variant="outline" icon={<Tag className="h-4 w-4" />} onClick={() => printWristband(chart.patient, chart.patient.admission!, t)}>
            {t('labels.wristband')}
          </Button>
        )}
        <PrintMenu chart={chart} />
      </div>

      {/* ترويسة الورق فقط: القسم المطبوع ووقت الطباعة ومن طبعه */}
      <div className="print-only border-b border-black pb-1 text-sm">
        <strong>{t(sectionKey(section))}</strong> · {localName(user, 'hospital_name')} · {t('ui.printedAt')}: {fmtDateTime(new Date().toISOString())} · {localName(user, 'full_name')}
      </div>

      {/* Section tabs */}
      <div
        role="tablist"
        className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-ink/8 bg-surface-raised p-1.5 no-scrollbar dark:border-white/10 dark:bg-surface-raised"
      >
        {SECTIONS.map(({ value }) => {
          const active = value === section;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setSection(value)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink/60 hover:bg-surface-muted hover:text-ink dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
              )}
            >
              {t(sectionKey(value))}
            </button>
          );
        })}
      </div>

      <div key={section} className="animate-fade-up">
        {renderSection()}
      </div>
      {!chart.admissionId && (
        <p className="text-center text-xs font-medium text-ink/40">
          {t('errors.notFound')} — {t('status.discharged')}
        </p>
      )}
    </div>
  );
}