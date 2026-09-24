import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BedDouble, Building2, CalendarClock, HeartPulse, Languages, Lock, RefreshCw, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import type { PublicTrackFamily } from '@hmsi/shared';
import { Card, CardContent, Badge, Button, Input, Skeleton } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { API } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
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
        <header className="flex items-center justify-between">
          <Logo compact />
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
                    <Building2 className="h-5 w-5 text-brand-600" />
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
                    {family && <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label={t('track.doctor')} value={family.attending_doctor ?? '—'} />}
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
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 font-bold text-ink">
                      <HeartPulse className="h-5 w-5 text-danger-500" />
                      {t('track.latestVitals')}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => familyMut.mutate(pin)} loading={familyMut.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                        {t('track.refresh')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setFamily(null); setPin(''); }}>
                        {t('track.hide')}
                      </Button>
                    </div>
                  </div>
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
                </CardContent>
              </Card>
            )}
          </>
        )}

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
