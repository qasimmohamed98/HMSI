import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, BedDouble, Building2, CalendarClock, FlaskConical, HeartPulse, Languages, Lock, MessageSquareText, Pill, RefreshCw, ScanLine, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import type { PublicTrackFamily } from '@hmsi/shared';
import { Card, CardContent, Badge, Button, Input, Skeleton } from '@/components/ui';
import { QLockup } from '@/components/brand/QBrand';
import { ProductsLink } from '@/features/products/OurProducts';
import { API } from '@/lib/api';
import { doctorName, fmtDate, fmtDateTime } from '@/lib/format';
import { currentLang, setLanguage } from '@/i18n';

/**
 * صفحة عامة لذوي المريض — تُفتح بمسح QR السرير (/track/:code).
 * بدون رمز العائلة: الموقع وحالة التنويم والأحرف الأولى فقط.
 * مع الرمز: الاسم الكامل والطبيب المعالج وآخر علامات حيوية.
 */
export default function TrackPage() {
  const { t } = useTranslation();
  const { code = '' } = useParams<{ code: string }>();
  const lang = currentLang();
  const name = (o: { name_ar: string; name_en: string } | null | undefined) => (o ? (lang === 'ar' ? o.name_ar : o.name_en || o.name_ar) : '—');

  const info = useQuery({
    queryKey: ['publicTrack', code],
    queryFn: () => API.publicTrack(code),
    enabled: Boolean(code),
    retry: false,
    refetchInterval: 60_000,
  });

  const [pin, setPin] = useState('');
  const [family, setFamily] = useState<PublicTrackFamily | null>(null);
  const familyMut = useMutation({
    mutationFn: (p: string) => API.familyTrack(code, p),
    onSuccess: (d) => setFamily(d),
    onError: () => setFamily(null),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pin)) familyMut.mutate(pin);
  };

  const data = family ?? info.data;

  return (
    <div className="min-h-dvh bg-surface px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        {/* هوية المستشفى تظهر في البطاقة أدناه، وهوية النظام في التذييل */}
        <header className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}>
            <Languages className="h-4 w-4" />
            <span className="font-bold">{lang === 'ar' ? 'EN' : 'ع'}</span>
          </Button>
        </header>

        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('track.title')}</h1>
          <p className="text-sm text-ink/55">{t('track.subtitle')}</p>
        </div>

        {info.isLoading ? (
          <Card>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ) : info.error || !data ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BedDouble className="mx-auto h-10 w-10 text-ink/30" />
              <p className="mt-3 font-bold text-ink">{t('track.notFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-bold text-ink">
                    {data.hospital.logo_url ? (
                      <img src={data.hospital.logo_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain ring-1 ring-ink/10" />
                    ) : (
                      <Building2 className="h-5 w-5 text-brand-600" />
                    )}
                    {name(data.hospital)}
                  </p>
                  <Badge variant={data.occupied ? 'success' : 'neutral'} dot>
                    {data.occupied ? t('track.occupied') : t('track.bedFree')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label={t('track.department')} value={name(data.department)} />
                  <Field label={t('track.ward')} value={name(data.ward)} />
                  <Field label={t('track.room')} value={data.room} mono />
                  <Field label={t('track.bed')} value={data.bed_no} mono />
                </div>

                {data.admission && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-muted/70 p-3 sm:grid-cols-3 dark:bg-white/5">
                    <Field
                      icon={<UserRound className="h-3.5 w-3.5" />}
                      label={t('track.patient')}
                      value={family ? (lang === 'ar' ? family.patient.full_name_ar : family.patient.full_name_en || family.patient.full_name_ar) : data.admission.patient_initials}
                    />
                    <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label={t('track.admittedAt')} value={fmtDate(data.admission.admitted_at, { day: 'numeric', month: 'short', year: 'numeric' })} />
                    <Field label={t('track.days')} value={t('track.daysValue', { count: data.admission.days })} />
                    {data.admission.last_update && <Field label={t('track.lastUpdate')} value={fmtDateTime(data.admission.last_update)} />}
                    {family && <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label={t('track.doctor')} value={doctorName(family) || '—'} />}
                  </div>
                )}
              </CardContent>
            </Card>

            {data.occupied && !family && (
              <Card>
                <CardContent>
                  <form onSubmit={submit} className="space-y-3">
                    <p className="flex items-center gap-2 font-bold text-ink">
                      <Lock className="h-4 w-4 text-brand-600" />
                      {t('track.familyTitle')}
                    </p>
                    <p className="text-sm text-ink/60">{t('track.familyHint')}</p>
                    <div className="flex items-end gap-2">
                      <Input
                        label={t('track.pinLabel')}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        dir="ltr"
                        containerClassName="flex-1"
                        className="text-center text-lg tracking-[0.4em] tabular"
                        error={familyMut.error ? (familyMut.error as Error).message : undefined}
                      />
                      <Button type="submit" loading={familyMut.isPending} disabled={pin.length !== 6}>
                        {t('track.show')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {family && (
              <>
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => familyMut.mutate(pin)} loading={familyMut.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                    {t('track.refresh')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setFamily(null); setPin(''); }}>
                    {t('track.hide')}
                  </Button>
                </div>

                {family.message && (
                  <Card className="border-brand-200 dark:border-brand-900">
                    <CardContent className="space-y-2">
                      <p className="flex items-center gap-2 font-bold text-ink">
                        <MessageSquareText className="h-5 w-5 text-brand-600" />
                        {t('track.message')}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{family.message.text}</p>
                      {family.message.at && (
                        <p className="text-xs text-ink/45">
                          {family.message.by} · <span className="tabular">{fmtDateTime(family.message.at)}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {family.shared.includes('vitals') && (
                  <Section icon={<HeartPulse className="h-5 w-5 text-danger-500" />} title={t('track.latestVitals')}>
                    {family.latest_vitals ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Field label={t('track.temperature')} value={family.latest_vitals.temperature != null ? `${family.latest_vitals.temperature} °C` : '—'} mono />
                          <Field label={t('track.pulse')} value={family.latest_vitals.pulse != null ? `${family.latest_vitals.pulse}` : '—'} mono />
                          <Field
                            label={t('track.bp')}
                            value={family.latest_vitals.bp_systolic != null ? `${family.latest_vitals.bp_systolic}/${family.latest_vitals.bp_diastolic ?? '—'}` : '—'}
                            mono
                          />
                          <Field label={t('track.spo2')} value={family.latest_vitals.spo2 != null ? `${family.latest_vitals.spo2}%` : '—'} mono />
                        </div>
                        <p className="text-xs text-ink/45">{fmtDateTime(family.latest_vitals.recorded_at)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-ink/55">{t('track.noVitals')}</p>
                    )}
                  </Section>
                )}

                {family.diagnoses && (
                  <Section icon={<Stethoscope className="h-5 w-5 text-brand-600" />} title={t('track.diagnoses')} empty={family.diagnoses.length === 0}>
                    <ul className="space-y-1.5 text-sm">
                      {family.diagnoses.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{lang === 'en' ? d.title_en || d.title_ar : d.title_ar}</span>
                          <Badge variant={d.status === 'resolved' ? 'success' : 'neutral'}>{t(`diagnosis.statuses.${d.status}`)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {family.medications && (
                  <Section icon={<Pill className="h-5 w-5 text-brand-600" />} title={t('track.medications')} empty={family.medications.length === 0}>
                    <ul className="space-y-1.5 text-sm">
                      {family.medications.map((m, i) => (
                        <li key={i}>
                          <span className="font-semibold text-ink">{lang === 'en' ? m.name_en || m.name_ar : m.name_ar}</span>
                          <span className="text-ink/55"> — {m.dose} · {m.route} · {m.frequency}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {family.labs && (
                  <Section icon={<FlaskConical className="h-5 w-5 text-brand-600" />} title={t('track.labs')} empty={family.labs.length === 0}>
                    <ul className="divide-y divide-ink/6 text-sm dark:divide-white/5">
                      {family.labs.map((l, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{lang === 'en' ? l.test_name_en || l.test_name_ar : l.test_name_ar}</span>
                            {l.resulted_at && <span className="block text-xs tabular text-ink/45">{fmtDateTime(l.resulted_at)}</span>}
                          </span>
                          <span className="shrink-0 text-end">
                            <bdi dir="ltr" className={`font-bold tabular ${l.abnormal ? 'text-danger-600' : 'text-ink'}`}>
                              {l.result} {l.unit ?? ''}
                            </bdi>
                            {l.reference_range && (
                              <span className="block text-xs text-ink/45" dir="ltr">
                                {l.reference_range}
                              </span>
                            )}
                            {l.abnormal && <span className="block text-xs font-bold text-danger-600">{t('track.abnormal')}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {family.radiology && (
                  <Section icon={<ScanLine className="h-5 w-5 text-brand-600" />} title={t('track.radiology')} empty={family.radiology.length === 0}>
                    <ul className="space-y-3 text-sm">
                      {family.radiology.map((r, i) => (
                        <li key={i}>
                          <p className="font-semibold text-ink">
                            {lang === 'en' ? r.study_type_en || r.study_type_ar : r.study_type_ar} ·{' '}
                            <span className="text-xs font-medium tabular text-ink/45">{fmtDate(r.ordered_at, { day: 'numeric', month: 'short' })}</span>
                          </p>
                          <p className="whitespace-pre-wrap text-ink/75">{r.report}</p>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {family.procedures && (
                  <Section icon={<Activity className="h-5 w-5 text-brand-600" />} title={t('track.procedures')} empty={family.procedures.length === 0}>
                    <ul className="space-y-1.5 text-sm">
                      {family.procedures.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{lang === 'en' ? p.name_en || p.name_ar : p.name_ar}</span>
                          <span className="text-xs tabular text-ink/45">{fmtDate(p.performed_at, { day: 'numeric', month: 'short' })}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {family.shared.length === 0 && !family.message && (
                  <Card>
                    <CardContent className="text-sm text-ink/60">{t('track.nothingShared')}</CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        <p className="flex items-center justify-center gap-2 pt-2 text-[0.7rem] text-ink/45" dir="ltr">
          <span>POWERED BY</span>
          <QLockup className="h-4" />
        </p>
        <p className="text-center text-xs text-ink/55">
          <ProductsLink source="track" className="text-brand-700 dark:text-brand-300" />
        </p>
        <p className="text-center text-xs text-ink/50">
          {t('legal.trackNotice')}{' '}
          <Link to="/privacy" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {t('legal.privacy')}
          </Link>
        </p>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink/50">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          {t('track.privacy')}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[0.7rem] font-bold text-ink/45">
        {icon}
        {label}
      </p>
      <p className={`truncate text-sm font-bold text-ink ${mono ? 'tabular' : ''}`} dir={mono ? 'ltr' : undefined}>
        {value}
      </p>
    </div>
  );
}

function Section({ icon, title, empty, children }: { icon: ReactNode; title: string; empty?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="flex items-center gap-2 font-bold text-ink">
          {icon}
          {title}
        </p>
        {empty ? <p className="text-sm text-ink/55">{t('track.noneYet')}</p> : children}
      </CardContent>
    </Card>
  );
}
