import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users, BedDouble, AlertTriangle, FlaskConical, Activity, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, EmptyState, Button, Input } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtPercent, todayISO, localName, localISODate } from '@/lib/format';
import { currentLang } from '@/i18n';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISODate(d);
}

function TrendChart({ data, admissionsLabel, dischargesLabel }: { data: { label: string; admissions: number; discharges: number }[]; admissionsLabel: string; dischargesLabel: string }) {
  const rtl = currentLang() === 'ar';
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
          <XAxis
            dataKey="label"
            reversed={rtl}
            tickFormatter={(v: string) => fmtDate(v, { day: 'numeric', month: 'short' })}
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
          />
          <YAxis allowDecimals={false} orientation={rtl ? 'right' : 'left'} width={28} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(v) => fmtDate(String(v), { weekday: 'long', day: 'numeric', month: 'short' })} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="admissions" name={admissionsLabel} fill="#1e7f6e" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="discharges" name={dischargesLabel} fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayISO());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => API.reportsOverview(from, to),
    enabled: Boolean(from && to && from <= to),
  });

  const header = <PageHeader title={t('nav.reports')} subtitle={t('reports.subtitle')} actions={<Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>{t('reports.print')}</Button>} />;

  if (isLoading) {
    return (
      <div>
        {header}
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/8 p-4 dark:border-white/10">
            <Input label={t('reports.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} containerClassName="w-44" />
            <Input label={t('reports.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} containerClassName="w-44" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {header}
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: t('reports.totalAdmissions'), value: data.totalAdmissions, icon: Users, tone: 'brand' },
    { label: t('reports.totalDischarges'), value: data.totalDischarges, icon: BedDouble, tone: 'success' },
    { label: t('reports.criticalAlerts'), value: data.criticalAlerts, icon: AlertTriangle, tone: 'danger' },
    { label: t('reports.pendingLabs'), value: data.pendingLabs, icon: FlaskConical, tone: 'warning' },
  ] as const;


  return (
    <div>
      {header}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/8 p-4 dark:border-white/10 print:hidden">
        <Input label={t('reports.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} containerClassName="w-44" />
        <Input label={t('reports.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} containerClassName="w-44" />
      </div>

      <p className="mt-3 text-xs font-medium text-ink/45 tabular">
        {t('reports.period')}: <span dir="ltr">{data.from}</span> ← <span dir="ltr">{data.to}</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  s.tone === 'brand' && 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
                  s.tone === 'success' && 'bg-success-50 text-success-700 dark:bg-success-900/40 dark:text-success-300',
                  s.tone === 'danger' && 'bg-danger-50 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
                  s.tone === 'warning' && 'bg-warning-50 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
                )}
              >
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold tabular text-ink">{s.value}</p>
                <p className="truncate text-xs font-medium text-ink/55">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            {t('reports.admissionsTrend')} / {t('reports.dischargesTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={data.admissionsTrend.map((d, i) => ({ label: d.label, admissions: d.count, discharges: data.dischargesTrend[i]?.count ?? 0 }))}
            admissionsLabel={t('reports.admissions')}
            dischargesLabel={t('reports.discharges')}
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.occupancyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.occupancy.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-ink/45">{t('dept.noAdmitted')}</p>
            ) : (
              <ul className="space-y-3">
                {data.occupancy.map((w) => {
                  const pct = w.total > 0 ? Math.round((w.used / w.total) * 100) : 0;
                  return (
                    <li key={`${w.ward_name_ar}-${w.ward_name_en}`}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <p className="font-bold text-ink">{localName(w, 'ward_name')}</p>
                        <p className="text-xs font-semibold tabular text-ink/55">
                          {t('occupancy.bedsUsed', { used: w.used, total: w.total })} · {fmtPercent(pct / 100)}
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10">
                        <div
                          className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500')}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-600" />
              {t('dashboard.recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-ink/45">{t('dashboard.emptyActivity')}</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentActivity.map((ev, i) => (
                  <li key={`${ev.id}-${i}`} className="flex items-start gap-3">
                    <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', ev.type === 'discharge' ? 'bg-danger-500' : 'bg-brand-500')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{localName(ev, 'title')}</p>
                      <p className="text-xs text-ink/50">{ev.actor} · {fmtDateTime(ev.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}