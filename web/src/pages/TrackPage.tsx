import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function TrackPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicTrack', code],
    queryFn: () => API.publicTrack(code),
    enabled: !!code,
  });

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent>
            <CardTitle>{t('tracks.selectCode')}</CardTitle>
            <p className="mt-2 text-ink/60">{t('tracks.scanQR')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent>
            <CardTitle>{t('tracks.loading')}</CardTitle>
            <p className="mt-2 text-ink/60">جاري تحميل بيانات السرير...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent>
            <CardTitle>{t('tracks.notFound')}</CardTitle>
            <p className="mt-2 text-danger-500">{error.message || t('tracks.codeInvalid')}</p>
            <Button onClick={() => navigate(-1)}>{t('common.back')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent>
            <CardTitle>{t('tracks.notFound')}</CardTitle>
            <p className="mt-2 text-ink/60">{t('tracks.noDataForCode')}</p>
            <p className="mt-3 text-sm text-ink/60">{t('tracks.scanDifferentCode')}</p>
            <Button onClick={() => navigate(-1)} className="mt-3">{t('common.back')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    bed,
    hospital,
    ward,
    department,
    patient,
    admission,
    vitals,
    notes,
    diagnoses,
    medications,
    labs,
    radiology,
    consultations,
    procedures,
  } = data;

  return (
    <div className="min-h-screen py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start">
          <CardTitle>{t('tracks.title', { code })}</CardTitle>
          <CardContent />
        </CardHeader>
        <CardContent>
          {patient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-ink/60">{t('tracks.patient')}</p>
                <p className="font-bold text-2xl">{patient.full_name_ar}</p>
                {patient.full_name_en && <p className="text-ink/60 small">{patient.full_name_en}</p>}
                <p className="text-ink/60 small">
                  {t('tracks.fileNumber')}: {patient.file_number}
                </p>
                <p className="text-ink/60 small">
                  {t('tracks.admittedAt')}: {admission?.admitted_at ? new Date(admission.admitted_at).toLocaleDateString() : '-'}
                </p>
              </div>
              {ward && (
                <div>
                  <p className="text-sm text-ink/60">{t('tracks.ward')}</p>
                  <p className="font-bold">{ward.name_ar}</p>
                  {ward.name_en && <p className="text-ink/60 small">{ward.name_en}</p>}
                </div>
              )}
              {department && (
                <div>
                  <p className="text-sm text-ink/60">{t('tracks.department')}</p>
                  <p className="font-bold">{department.name_ar}</p>
                  {department.name_en && <p className="text-ink/60 small">{department.name_en}</p>}
                </div>
              )}
            </div>
          )}

          {admission && (
            <div className="mb-4">
              <p className="text-sm text-ink/60">{t('tracks.admissionStatus')}</p>
              <Badge variant={admission.status === 'active' ? 'brand' : 'outline'}>
                {t(`admission.${admission.status}`)}
              </Badge>
            </div>
          )}

          {vitals.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.vitals')}</p>
              <div className="grid grid-cols-2 gap-2">
                {vitals.map((v, i) => (
                  <div key={i} className="p-2 rounded bg-surface-muted dark:bg-white/10">
                    <p className="text-ink/60 small">{v.recorded_at ? new Date(v.recorded_at).toLocaleString() : '-'}</p>
                    <p className="font-bold">{t('tracks.temperature')}: {v.temperature !== undefined ? v.temperature : '-'} °C</p>
                    <p className="font-bold">{t('tracks.pulse')}: {v.pulse ?? '-'}</p>
                    <p className="font-bold">{t('tracks.spo2')}: {v.spo2 ?? '-'}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.notes')}</p>
              <div className="space-y-2">
                {notes.slice(0, 5).map((n) => (
                  <div key={n.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{n.author}:</p>
                    <p className="text-ink/60">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diagnoses.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.diagnoses')}</p>
              <div className="grid grid-cols-2 gap-2">
                {diagnoses.map((d) => (
                  <div key={d.icd10} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{d.title_ar}</p>
                    <p className="text-ink/60 small">{d.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {medications.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.medications')}</p>
              <div className="grid grid-cols-2 gap-2">
                {medications.map((m) => (
                  <div key={m.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{m.name_ar}</p>
                    <p className="text-ink/60 small">{m.frequency}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {labResults.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.labs')}</p>
              <div className="grid grid-cols-2 gap-2">
                {labResults.map((l) => (
                  <div key={l.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{l.test_name_ar}</p>
                    <p className="text-ink/60 small">{l.result || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {radiology.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.radiology')}</p>
              <div className="grid grid-cols-2 gap-2">
                {radiology.map((r) => (
                  <div key={r.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{r.study_type_ar}</p>
                    <p className="text-ink/60 small">{r.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consultations.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.consultations')}</p>
              <div className="grid grid-cols-2 gap-2">
                {consultations.map((c) => (
                  <div key={c.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{c.specialty}</p>
                    <p className="text-ink/60 small">{c.response || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {procedures.length > 0 && (
            <div>
              <p className="text-sm text-ink/60">{t('tracks.procedures')}</p>
              <div className="grid grid-cols-2 gap-2">
                {procedures.map((p) => (
                  <div key={p.id} className="p-2 rounded bg-surface-muted dark:bg-white/10 small">
                    <p className="font-bold">{p.name_ar}</p>
                    <p className="text-ink/60 small">{p.performed_at || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}