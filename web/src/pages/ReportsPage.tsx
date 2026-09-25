import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  BedDouble,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  HeartPulse,
  LogIn,
  LogOut,
  Pill,
  Printer,
  ScanLine,
  Stethoscope,
  Syringe,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Select, Skeleton, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type DetailedReport, type ReportType } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtPercent, localISODate, localName, todayISO } from '@/lib/format';
import { currentLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { cellText, exportReportExcel, printReport, type ReportContext } from '@/features/reports/report-format';

type Tab = 'overview' | ReportType;

const REPORTS: { key: Tab; icon: LucideIcon; filters: ('department' | 'doctor')[]; snapshot?: boolean }[] = [
  { key: 'overview', icon: BarChart3, filters: [] },
  { key: 'admissions', icon: LogIn, filters: ['department', 'doctor'] },
  { key: 'discharges', icon: LogOut, filters: ['department', 'doctor'] },
  { key: 'census', icon: Users, filters: ['department', 'doctor'], snapshot: true },
  { key: 'occupancy', icon: BedDouble, filters: ['department'] },
  { key: 'lab', icon: FlaskConical, filters: ['department'] },
  { key: 'radiology', icon: ScanLine, filters: ['department'] },
  { key: 'pharmacy', icon: Pill, filters: ['department'] },
  { key: 'mar', icon: Syringe, filters: ['department'] },
  { key: 'diagnoses', icon: ClipboardList, filters: ['department'] },
  { key: 'doctors', icon: Stethoscope, filters: [] },
];

const PRESETS = ['today', '7d', 'thisMonth', 'lastMonth', '30d', 'thisYear'] as const;
type Preset = (typeof PRESETS)[number] | 'custom';

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  const d = (y: number, m: number, day: number) => localISODate(new Date(y, m, day));
  switch (p) {
    case 'today':
      return [todayISO(), todayISO()];
    case '7d':
      return [localISODate(new Date(Date.now() - 6 * 86400000)), todayISO()];
    case '30d':
      return [localISODate(new Date(Date.now() - 29 * 86400000)), todayISO()];
    case 'thisMonth':
      return [d(now.getFullYear(), now.getMonth(), 1), todayISO()];
    case 'lastMonth':
      return [d(now.getFullYear(), now.getMonth() - 1, 1), d(now.getFullYear(), now.getMonth(), 0)];
    case 'thisYear':
      return [d(now.getFullYear(), 0, 1), todayISO()];
    default:
      return [todayISO(), todayISO()];
  }
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const [[from, to], setRange] = useState<[string, string]>(presetRange('thisMonth'));
  const [department, setDepartment] = useState('');
  const [doctor, setDoctor] = useState('');
  const [exporting, setExporting] = useState(false);
  const def = REPORTS.find((r) => r.key === tab)!;

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: API.listDepartments });
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: API.listDoctors });

  const valid = Boolean(from && to && from <= to);
  const overview = useQuery({ queryKey: ['reports', 'overview', from, to], queryFn: () => API.reportsOverview(from, to), enabled: tab === 'overview' && valid });
  const detail = useQuery({
    queryKey: ['reports', tab, from, to, department, doctor],
    queryFn: () => API.detailedReport(tab as ReportType, { from, to, department: department || undefined, doctor: doctor || undefined }),
    enabled: tab !== 'overview' && valid,
  });

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  const ctx: ReportContext = useMemo(
    () => ({
      title: t(`reports.types.${tab}`),
      rangeLabel: def.snapshot ? t('reports.snapshotAt', { date: fmtDate(new Date().toISOString()) }) : t('reports.rangeLabel', { from: fmtDate(from), to: fmtDate(to) }),
      filtersLabel: [
        department && `${t('patients.department')}: ${localName(departments?.find((d) => d.id === department), 'name')}`,
        doctor && `${t('chart.attendingDoctor')}: ${doctors?.find((d) => d.id === doctor)?.full_name_en || doctors?.find((d) => d.id === doctor)?.full_name_ar || ''}`,
      ]
        .filter(Boolean)
        .join(' · '),
      hospitalName: localName(user, 'hospital_name'),
      hospitalLogo: user?.hospital_logo_url,
      printedBy: `${t('print.printedBy')}: ${localName(user, 'full_name')}`,
    }),
    [t, tab, def.snapshot, from, to, department, doctor, departments, doctors, user],
  );

  const onExcel = async () => {
    if (!detail.data) return;
    setExporting(true);
    try {
      await exportReportExcel(detail.data, ctx, t, currentLang() === 'ar');
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.reports')} subtitle={t('reports.subtitle')} />

      {/* اختيار التقرير */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setTab(r.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-colors',
              tab === r.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink/10 bg-surface-raised text-ink/70 hover:bg-surface-muted dark:border-white/10',
            )}
          >
            <r.icon className="h-4 w-4" />
            {t(`reports.types.${r.key}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink/60">{t(`reports.desc.${tab}`)}</p>

      {/* المرشحات */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          {!def.snapshot && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => choosePreset(p)}
                    className={cn('rounded-lg px-3 py-2 text-sm font-semibold', preset === p ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-200' : 'text-ink/60 hover:bg-surface-muted')}
                  >
                    {t(`reports.presets.${p}`)}
                  </button>
                ))}
              </div>
              <div className="w-40">
                <Input label={t('reports.from')} type="date" value={from} onChange={(e) => { setPreset('custom'); setRange([e.target.value, to]); }} />
              </div>
              <div className="w-40">
                <Input label={t('reports.to')} type="date" value={to} onChange={(e) => { setPreset('custom'); setRange([from, e.target.value]); }} />
              </div>
            </>
          )}
          {def.filters.includes('department') && (
            <div className="w-52">
              <Select
                label={t('patients.department')}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[{ value: '', label: t('reports.all') }, ...(departments ?? []).map((d) => ({ value: d.id, label: localName(d, 'name') }))]}
              />
            </div>
          )}
          {def.filters.includes('doctor') && (
            <div className="w-52">
              <Select
                label={t('chart.attendingDoctor')}
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                options={[{ value: '', label: t('reports.all') }, ...(doctors ?? []).map((d) => ({ value: d.id, label: localName(d, 'full_name') }))]}
              />
            </div>
          )}
          {tab !== 'overview' && (
            <div className="ms-auto flex gap-2">
              <Button variant="outline" icon={<FileSpreadsheet className="h-4 w-4" />} loading={exporting} disabled={!detail.data || detail.data.rows.length === 0} onClick={() => void onExcel()}>
                {t('reports.excel')}
              </Button>
              <Button icon={<Printer className="h-4 w-4" />} disabled={!detail.data} onClick={() => detail.data && printReport(detail.data, ctx, t)}>
                {t('reports.print')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!valid ? (
        <Card>
          <CardContent>
            <EmptyState title={t('reports.badRange')} />
          </CardContent>
        </Card>
      ) : tab === 'overview' ? (
        <OverviewReport data={overview.data} loading={overview.isLoading} />
      ) : detail.isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : detail.error || !detail.data ? (
        <Card>
          <CardContent>
            <EmptyState title={(detail.error as Error)?.message || t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void detail.refetch() }} />
          </CardContent>
        </Card>
      ) : (
        <DetailedReportView report={detail.data} />
      )}
    </div>
  );
}

function DetailedReportView({ report }: { report: DetailedReport }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(200);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {report.summary.map((s) => (
          <Card key={s.key}>
            <CardContent className="p-4">
              <p className="text-2xl font-extrabold tabular text-ink">{s.value}</p>
              <p className="text-xs font-semibold text-ink/55">{t(`reports.sum.${s.key}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <EmptyState title={t('reports.empty')} />
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                  <tr>
                    <th className="px-3 py-2.5 text-start text-xs font-bold text-ink/55">#</th>
                    {report.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2.5 text-start text-xs font-bold text-ink/55">
                        {t(`reports.cols.${c.key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/6 dark:divide-white/5">
                  {report.rows.slice(0, limit).map((r, i) => (
                    <tr key={i} className="hover:bg-surface-muted/60 dark:hover:bg-white/5">
                      <td className="px-3 py-2 text-xs tabular text-ink/40">{i + 1}</td>
                      {report.columns.map((c) => {
                        const text = cellText(c, r[c.key], t, r);
                        const long = ['report', 'discharge_summary', 'reason', 'note'].includes(c.key);
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              'px-3 py-2 text-ink/85',
                              c.kind === 'number' || c.kind === 'percent' ? 'text-center tabular' : '',
                              c.kind === 'datetime' ? 'whitespace-nowrap tabular text-xs' : '',
                              long ? 'max-w-[22rem] truncate' : 'whitespace-nowrap',
                              r.status === 'abnormal' && c.key === 'result' && 'font-bold text-danger-600',
                            )}
                            title={long ? text : undefined}
                          >
                            {text || <span className="text-ink/25">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {report.rows.length > limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 500)}>
            {t('reports.showMore', { shown: limit, total: report.rows.length })}
          </Button>
        </div>
      )}
    </div>
  );
}

function OverviewReport({ data, loading }: { data: Awaited<ReturnType<typeof API.reportsOverview>> | undefined; loading: boolean }) {
  const { t } = useTranslation();
  if (loading || !data) return <Skeleton className="h-80 w-full rounded-2xl" />;
  const rtl = currentLang() === 'ar';
  const stats = [
    { label: t('reports.totalAdmissions'), value: data.totalAdmissions, icon: LogIn },
    { label: t('reports.totalDischarges'), value: data.totalDischarges, icon: LogOut },
    { label: t('reports.activeNow'), value: data.activeAdmissions, icon: HeartPulse },
    { label: t('reports.pendingLabs'), value: data.pendingLabs, icon: FlaskConical },
  ];
  const chart = data.admissionsTrend.map((d, i) => ({ label: d.label, admissions: d.count, discharges: data.dischargesTrend[i]?.count ?? 0 }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <s.icon className="h-5 w-5" />
              </span>
              <span>
                <p className="text-2xl font-extrabold tabular text-ink">{s.value}</p>
                <p className="text-xs font-semibold text-ink/55">{s.label}</p>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-600" />
            {t('reports.admissionsTrend')} / {t('reports.dischargesTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                <XAxis dataKey="label" reversed={rtl} tickFormatter={(v: string) => fmtDate(v, { day: 'numeric', month: 'short' })} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} orientation={rtl ? 'right' : 'left'} width={28} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(v) => fmtDate(String(v), { weekday: 'long', day: 'numeric', month: 'short' })} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="admissions" name={t('reports.admissions')} fill="#1e7f6e" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="discharges" name={t('reports.discharges')} fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.occupancyTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.occupancy.map((w) => {
              const pct = w.total > 0 ? w.used / w.total : 0;
              return (
                <li key={`${w.ward_name_ar}-${w.ward_name_en}`}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <p className="font-bold text-ink">{localName(w, 'ward_name')}</p>
                    <p className="text-xs font-semibold tabular text-ink/55">
                      {t('occupancy.bedsUsed', { used: w.used, total: w.total })} · {fmtPercent(pct)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10">
                    <div className={cn('h-full rounded-full', pct >= 0.9 ? 'bg-danger-500' : pct >= 0.7 ? 'bg-warning-500' : 'bg-brand-500')} style={{ width: `${Math.max(pct * 100, 3)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
