import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Clock, ScanLine } from 'lucide-react';
import { Button, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { API, type RadiologyWorkItem } from '@/lib/api';
import { currentLang } from '@/i18n';
import { localName, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ScheduleDialog } from './ScheduleDialog';

const PRIORITY_DOT = { stat: 'bg-danger-600', urgent: 'bg-warning-500', routine: 'bg-ink/25' } as const;

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function timeOf(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(currentLang() === 'en' ? 'en-US' : 'ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

/** جدول مواعيد الأشعة اليومي: عمود لكل جهاز أو غرفة، والطلبات غير المحجوزة لتوزيعها */
export function ScheduleView() {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [target, setTarget] = useState<RadiologyWorkItem | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['radiology', 'schedule', date], queryFn: () => API.radiologySchedule(date) });

  const byUnit = new Map<string, RadiologyWorkItem[]>();
  for (const it of data?.scheduled ?? []) {
    if (!it.unit_id) continue;
    byUnit.set(it.unit_id, [...(byUnit.get(it.unit_id) ?? []), it]);
  }
  const close = () => setTarget(null);
  const done = () => {
    close();
    void qc.invalidateQueries({ queryKey: ['radiology', 'schedule'] });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" aria-label={t('imaging.prevDay')} onClick={() => setDate((d) => shiftDate(d, -1))}>
            {en ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border border-ink/12 bg-surface-raised px-2.5 text-sm font-semibold text-ink dark:border-white/12"
          />
          <Button size="icon-sm" variant="outline" aria-label={t('imaging.nextDay')} onClick={() => setDate((d) => shiftDate(d, 1))}>
            {en ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          {date !== todayISO() && (
            <Button size="sm" variant="ghost" onClick={() => setDate(todayISO())}>
              {t('imaging.today')}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : (
        <>
          {data.units.length === 0 ? (
            <Card className="mb-4">
              <CardContent>
                <EmptyState title={t('imaging.noUnitsForSchedule')} />
              </CardContent>
            </Card>
          ) : (
            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.units.map((u) => {
                const items = (byUnit.get(u.id) ?? []).slice().sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
                return (
                  <div key={u.id} className="rounded-2xl border border-ink/10 bg-surface-raised dark:border-white/10">
                    <div className="flex items-center justify-between gap-2 border-b border-ink/8 px-3.5 py-2.5 dark:border-white/8">
                      <p className="font-bold text-ink">{localName(u, 'name')}</p>
                      <div className="flex gap-1.5">
                        {u.modality && <Badge variant="info">{t(`org.modality.${u.modality}`)}</Badge>}
                        {u.status !== 'active' && <Badge variant="danger">{t(`org.unitStatus.${u.status}`)}</Badge>}
                      </div>
                    </div>
                    <div className="space-y-1.5 p-2.5">
                      {items.length === 0 ? (
                        <p className="px-1 py-2 text-center text-xs text-ink/40">{t('imaging.noAppointments')}</p>
                      ) : (
                        items.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => setTarget(it)}
                            className="flex w-full items-center gap-2 rounded-lg border border-ink/8 px-2.5 py-2 text-start hover:border-brand-300 hover:bg-brand-50/60 dark:border-white/8 dark:hover:bg-white/5"
                          >
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[it.priority])} aria-hidden />
                            <span className="flex items-center gap-1 shrink-0 text-xs font-bold text-ink/70">
                              <Clock className="h-3 w-3" />
                              {it.scheduled_at ? timeOf(it.scheduled_at) : '—'}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">{localName(it, 'full_name')}</span>
                              <span className="block truncate text-xs text-ink/50">{en && it.study_type_en ? it.study_type_en : it.study_type_ar}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-bold text-ink">{t('imaging.dayUnscheduled', { count: data.unscheduled.length })}</p>
            {data.unscheduled.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState title={t('imaging.allScheduled')} icon={<ScanLine className="h-6 w-6" />} />
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {data.unscheduled.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/8 bg-surface-raised px-3.5 py-2.5 dark:border-white/10">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[it.priority])} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {localName(it, 'full_name')} · <span className="font-normal text-ink/60">{en && it.study_type_en ? it.study_type_en : it.study_type_ar}</span>
                        </p>
                        {it.priority !== 'routine' && <Badge variant={it.priority === 'stat' ? 'danger' : 'warning'}>{t(`imaging.priorities.${it.priority}`)}</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setTarget(it)}>
                      {t('imaging.schedule')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {target && <ScheduleDialog key={target.id} item={target} defaultDate={date} onClose={close} onDone={done} />}
    </div>
  );
}
