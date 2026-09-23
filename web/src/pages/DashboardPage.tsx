import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Users,
  BedDouble,
  LogOut,
  AlertTriangle,
  FlaskConical,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, SkeletonCard, EmptyState, Avatar } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: API.dashboard });
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isLarge = useMediaQuery('(min-width: 1440px)');

  const date = fmtDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('dashboard.title')} subtitle={date} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent>
            <EmptyState
              title={t('errors.generic')}
              description={error instanceof Error ? error.message : undefined}
              action={{ label: t('common.retry'), onClick: () => void refetch() }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { key: 'totalPatients', value: data.totalPatients, icon: Users, cls: 'text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300' },
    { key: 'activeAdmissions', value: data.activeAdmissions, icon: BedDouble, cls: 'text-info-600 bg-info-50 dark:bg-info-900/40 dark:text-info-300' },
    { key: 'dischargedToday', value: data.dischargedToday, icon: LogOut, cls: 'text-success-600 bg-success-50 dark:bg-success-900/40 dark:text-success-300' },
    { key: 'criticalAlerts', value: data.criticalAlerts, icon: AlertTriangle, cls: 'text-danger-600 bg-danger-50 dark:bg-danger-900/40 dark:text-danger-300' },
    { key: 'pendingLabs', value: data.pendingLabs, icon: FlaskConical, cls: 'text-warning-600 bg-warning-50 dark:bg-warning-900/40 dark:text-warning-300' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('dashboard.title')} subtitle={date} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.key} className="p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.cls}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.72rem] font-bold text-ink/50">{t(`dashboard.${s.key}`)}</p>
                <p className="text-2xl font-extrabold tabular text-ink">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className={isLarge ? 'grid grid-cols-3 gap-5' : 'grid grid-cols-1 gap-5 lg:grid-cols-2'}>
        {/* Trend chart */}
        <Card className={isLarge ? 'col-span-2' : ''}>
          <CardHeader>
            <CardTitle>{t('dashboard.admissionsTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.admissionsTrend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e7f6e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1e7f6e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickFormatter={(v: string) => fmtDate(v, { day: 'numeric', month: 'short' })}
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [value, t('patients.title')]}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#1e7f6e" strokeWidth={2.5} fill="url(#brandFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.occupancyTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.occupancy.map((o) => {
              const pct = Math.round((o.used / o.total) * 100);
              return (
                <div key={o.ward_name_ar}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink/85">{o.ward_name_ar}</span>
                    <span className="tabular text-xs font-bold text-ink/50">{t('occupancy.bedsUsed', { used: o.used, total: o.total })}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500'}`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <EmptyState title={t('dashboard.emptyActivity')} />
          ) : (
            <ul className={isMobile ? 'space-y-3' : 'divide-y divide-ink/6 dark:divide-white/5'}>
              {data.recentActivity.slice(0, 7).map((a) => (
                <li key={a.id} className={isMobile ? 'flex items-start gap-3 rounded-xl border border-ink/8 p-3' : 'flex items-center gap-4 py-3'}>
                  <Avatar name={a.actor} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.title_ar}</p>
                    <p className="truncate text-xs text-ink/50">{a.actor}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-ink/45">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="tabular">{fmtDateTime(a.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}