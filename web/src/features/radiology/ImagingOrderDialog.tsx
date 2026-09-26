import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { IMAGING_PRIORITIES, imagingSafetyQuestions, type Gender, type ImagingPriority, type SafetyAnswers, type ServiceItem } from '@hmsi/shared';
import { Button, Dialog, Textarea, Badge } from '@/components/ui';
import { API, type RadiologyInput } from '@/lib/api';
import { currentLang } from '@/i18n';
import { cn } from '@/lib/utils';

const PRIORITY_TONE: Record<ImagingPriority, string> = {
  routine: 'border-ink/15 text-ink/70',
  urgent: 'border-warning-500 bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-200',
  stat: 'border-danger-500 bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-200',
};

/** أسئلة الأمان بإجابة نعم/لا (أو تُترك ليسألها فني الأشعة) — تُستخدم عند الطلب */
export function SafetyAnswersForm({ modality, contrast, gender, value, onChange }: { modality: ServiceItem['modality']; contrast: boolean; gender: Gender | null; value: SafetyAnswers; onChange: (v: SafetyAnswers) => void }) {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  const questions = imagingSafetyQuestions(modality, contrast, gender);
  if (questions.length === 0) return null;
  return (
    <div className="rounded-xl border border-ink/10 p-3.5 dark:border-white/10">
      <p className="text-sm font-bold text-ink">{t('imaging.safety')}</p>
      <p className="mb-2.5 text-xs text-ink/55">{t('imaging.safetyHint')}</p>
      <ul className="space-y-2.5">
        {questions.map((q) => (
          <li key={q.key} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1 text-sm text-ink/85">{en ? q.en : q.ar}</span>
            <div className="flex overflow-hidden rounded-lg border border-ink/12 text-xs font-bold dark:border-white/12" role="group">
              {(['yes', 'no'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={value[q.key] === a}
                  onClick={() => {
                    const next = { ...value };
                    if (next[q.key] === a) delete next[q.key];
                    else next[q.key] = a;
                    onChange(next);
                  }}
                  className={cn('px-3 py-1.5', value[q.key] === a ? (a === q.warnIf ? 'bg-danger-600 text-white' : 'bg-brand-600 text-white') : 'text-ink/60 hover:bg-ink/5')}
                >
                  {t(`imaging.${a}`)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * طلب فحص أشعة: اختيار من كتالوج الخدمات (يحدد الجهاز والصبغة)، الأولوية، سبب الطلب، وأسئلة الأمان.
 * الاسم الحر ممكن لفحص خارج القائمة. withReport: فني/طبيب الأشعة يستطيع إضافة التقرير مباشرة.
 */
export function ImagingOrderDialog({
  open,
  onClose,
  admissionId,
  gender,
  withReport,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  gender: Gender | null;
  withReport: boolean;
  onSubmit: (i: RadiologyInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  const { data: services } = useQuery({ queryKey: ['services', 'imaging'], queryFn: () => API.listServices({ kind: 'imaging' }), staleTime: 5 * 60_000, enabled: open });
  const [q, setQ] = useState('');
  const [service, setService] = useState<ServiceItem | null>(null);
  const [freeName, setFreeName] = useState<string | null>(null);
  const [priority, setPriority] = useState<ImagingPriority>('routine');
  const [indication, setIndication] = useState('');
  const [safety, setSafety] = useState<SafetyAnswers>({});
  const [report, setReport] = useState('');

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (services ?? []).filter((s) => `${s.name_ar} ${s.name_en ?? ''} ${s.code} ${s.body_part ?? ''}`.toLowerCase().includes(term)).slice(0, 8);
  }, [services, q]);

  if (!admissionId) return null;
  const name = service ? (en && service.name_en ? service.name_en : service.name_ar) : freeName;
  const canSave = Boolean(service) || (freeName?.trim().length ?? 0) >= 2;

  const reset = () => {
    setQ('');
    setService(null);
    setFreeName(null);
    setPriority('routine');
    setIndication('');
    setSafety({});
    setReport('');
  };
  const submit = () => {
    if (!canSave) return;
    onSubmit({
      admissionId,
      serviceId: service?.id ?? null,
      studyTypeAr: service ? service.name_ar : freeName!.trim(),
      studyTypeEn: service?.name_en ?? null,
      priority,
      indication: indication.trim() || null,
      safety: service ? safety : null,
      report: withReport ? report.trim() || null : null,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={withReport ? t('radiology.add') : t('imaging.orderTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!canSave}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink/90">{t('imaging.service')}</p>
          {name ? (
            <div className="rounded-xl border border-brand-300 bg-brand-50/60 p-3 dark:border-brand-700 dark:bg-brand-900/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {service?.modality && <Badge variant="info">{t(`org.modality.${service.modality}`)}</Badge>}
                    {service?.contrast && <Badge variant="warning">{t('imaging.contrast')}</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => { setService(null); setFreeName(null); setSafety({}); }}>
                  {t('imaging.change')}
                </Button>
              </div>
              {service && (en ? service.prep_en : service.prep_ar) && (
                <p className="mt-2 text-xs leading-relaxed text-ink/65">
                  <span className="font-bold">{t('imaging.prep')}: </span>
                  {en && service.prep_en ? service.prep_en : service.prep_ar}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-ink/40" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('imaging.searchPlaceholder')}
                  className="h-11 w-full rounded-lg border border-ink/15 bg-surface-raised ps-9 pe-3 text-[0.95rem] text-ink focus:border-brand-500 focus:outline-none"
                />
              </div>
              {q.trim() && (
                <ul className="mt-1.5 max-h-56 divide-y divide-ink/6 overflow-auto rounded-lg border border-ink/10 dark:divide-white/8 dark:border-white/10">
                  {matches.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setService(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-brand-50/70 dark:hover:bg-white/5">
                        <span className="text-sm font-semibold text-ink">{en && s.name_en ? s.name_en : s.name_ar}</span>
                        <span className="flex shrink-0 gap-1">
                          {s.modality && <Badge variant="info">{t(`org.modality.${s.modality}`)}</Badge>}
                          {s.contrast && <Badge variant="warning">{t('imaging.contrast')}</Badge>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink/50">{t('imaging.noMatch')}</li>}
                  <li>
                    <button type="button" onClick={() => setFreeName(q.trim())} className="w-full px-3 py-2 text-start text-sm font-semibold text-brand-700 hover:bg-brand-50/70 dark:text-brand-300 dark:hover:bg-white/5">
                      {t('imaging.useFree', { name: q.trim() })}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink/90">{t('imaging.priority')}</p>
          <div className="grid grid-cols-3 gap-2">
            {IMAGING_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
                className={cn('rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors', priority === p ? PRIORITY_TONE[p] : 'border-transparent bg-ink/5 text-ink/50 hover:text-ink', priority === p && 'ring-1 ring-current')}
              >
                {t(`imaging.priorities.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Textarea label={t('imaging.indication')} rows={2} value={indication} onChange={(e) => setIndication(e.target.value)} />
          <p className="mt-1 text-xs text-ink/50">{t('imaging.indicationHint')}</p>
        </div>

        {service && <SafetyAnswersForm modality={service.modality} contrast={Boolean(service.contrast)} gender={gender} value={safety} onChange={setSafety} />}

        {withReport && <Textarea label={t('orders.reportOptional')} rows={4} value={report} onChange={(e) => setReport(e.target.value)} />}
      </div>
    </Dialog>
  );
}
