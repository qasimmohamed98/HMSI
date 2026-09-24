import { useTranslation } from 'react-i18next';
import { Activity, Thermometer, HeartPulse, Wind, Droplets, Weight, Droplet, AlertTriangle } from 'lucide-react';
import type { ChartData } from '@/lib/api';
import { Badge } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { SectionCard, EmptyLine } from './SectionCard';

export function OverviewSection({ chart }: { chart: ChartData }) {
  const { t } = useTranslation();
  const latest = chart.vitals[0];

  const tiles = latest
    ? [
        { icon: Thermometer, label: t('vitals.temperature'), value: latest.temperature != null ? `${latest.temperature.toFixed(1)} ${t('vitals.unitTemp')}` : '—', warn: latest.temperature != null && latest.temperature >= 38 },
        { icon: HeartPulse, label: t('vitals.pulse'), value: latest.pulse != null ? `${latest.pulse} ${t('vitals.unitPulse')}` : '—', warn: latest.pulse != null && latest.pulse >= 110 },
        { icon: Wind, label: t('vitals.respiratoryRate'), value: latest.respiratory_rate != null ? `${latest.respiratory_rate} ${t('vitals.unitRR')}` : '—', warn: false },
        { icon: Droplets, label: t('vitals.bp'), value: latest.bp_systolic ? `${latest.bp_systolic}/${latest.bp_diastolic}` : '—', warn: latest.bp_systolic != null && latest.bp_systolic >= 160 },
        { icon: Activity, label: t('vitals.spo2'), value: latest.spo2 != null ? `${latest.spo2}%` : '—', warn: latest.spo2 != null && latest.spo2 < 94 },
        { icon: Weight, label: t('vitals.weight'), value: latest.weight != null ? `${latest.weight} ${t('vitals.unitWeight')}` : '—', warn: false },
        { icon: Droplet, label: t('vitals.glucose'), value: latest.glucose != null ? `${latest.glucose} ${t('vitals.unitGlucose')}` : '—', warn: latest.glucose != null && latest.glucose > 180 },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Latest vitals snapshot */}
      <SectionCard title={t('vitals.title')}>
        {latest ? (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {tiles.map((tile) => (
                <div key={tile.label} className="flex flex-col items-start gap-1 rounded-xl bg-surface-muted/70 p-3 dark:bg-white/5">
                  <tile.icon className={`h-4 w-4 ${tile.warn ? 'text-danger-500' : 'text-brand-600 dark:text-brand-300'}`} />
                  <p className="text-[0.68rem] font-bold text-ink/45">{tile.label}</p>
                  <p className={`text-sm font-extrabold tabular ${tile.warn ? 'text-danger-600' : 'text-ink'}`}>{tile.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-medium text-ink/45">
              {t('vitals.recordedAt')}: {fmtDateTime(latest.recorded_at)} · {t('vitals.recordedBy')}: {latest.recorded_by}
            </p>
          </div>
        ) : (
          <EmptyLine>{t('vitals.empty')}</EmptyLine>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Active diagnoses */}
        <SectionCard title={t('diagnosis.title')}>
          {chart.diagnoses.length === 0 ? (
            <EmptyLine>{t('diagnosis.empty')}</EmptyLine>
          ) : (
            <ul className="space-y-2.5">
              {chart.diagnoses.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink/8 px-3 py-2.5 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{d.title_ar}</p>
                    {d.icd10 && <p className="tabular text-xs text-ink/45">{d.icd10}</p>}
                  </div>
                  <Badge variant={d.status === 'confirmed' ? 'brand' : d.status === 'suspected' ? 'warning' : 'success'}>
                    {t(`diagnosis.statuses.${d.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Active medications */}
        <SectionCard title={t('medications.title')}>
          {chart.medications.length === 0 ? (
            <EmptyLine>{t('medications.empty')}</EmptyLine>
          ) : (
            <ul className="space-y-2.5">
              {chart.medications.filter((m) => m.status === 'active').map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 rounded-lg border border-ink/8 px-3 py-2.5 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{m.name_ar}</p>
                    <p className="text-xs text-ink/50">
                      {m.dose} · {m.route} · {m.frequency}
                    </p>
                  </div>
                  <Badge variant="success">{t('medications.statuses.active')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Tasks pending */}
      <SectionCard title={t('dashboard.pendingLabs')}>
        {chart.labs.filter((l) => l.status !== 'resulted').length === 0 ? (
          <EmptyLine>{t('laboratory.empty')}</EmptyLine>
        ) : (
          <ul className="space-y-2">
            {chart.labs
              .filter((l) => l.status !== 'resulted')
              .map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning-500" />
                  <span className="font-semibold text-ink">{l.test_name_ar}</span>
                  <Badge variant="warning">{t(`laboratory.statuses.${l.status}`)}</Badge>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}