import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarClock, CheckCircle2, FilePlus2, PenLine, Play, Printer, ScanLine, ShieldAlert } from 'lucide-react';
import { hasPermission, type DepartmentUnit, type Modality } from '@hmsi/shared';
import { Button, Dialog, Textarea, Select, Badge, Skeleton, EmptyState, Card, CardContent, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type RadiologyUpdateInput, type RadiologyWorkItem, type ReportTemplate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfirm } from '@/components/ui';
import { currentLang } from '@/i18n';
import { localizeServerMessage } from '@/i18n/server-messages';
import { calcAge, fmtDateTime, localName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RecordFileChips } from '@/features/patient/sections/RecordFiles';
import { ScheduleDialog } from '@/features/radiology/ScheduleDialog';
import { ScheduleView } from '@/features/radiology/ScheduleView';
import { printRadiologyWorkItem } from '@/features/patient/printChart';

const STRIPE = { stat: 'bg-danger-600', urgent: 'bg-warning-500', routine: 'bg-transparent' } as const;

/** قائمة عمل الأشعة: كل الطلبات الجارية في المستشفى (منوَّمون ومراجعون وطوارئ وفحص فقط) مرتبة بالأولوية */
export default function RadiologyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<'open' | 'schedule' | 'done'>('open');
  const [modality, setModality] = useState<Modality | ''>('');
  const [performFor, setPerformFor] = useState<RadiologyWorkItem | null>(null);
  const [reportFor, setReportFor] = useState<RadiologyWorkItem | null>(null);
  const [scheduleFor, setScheduleFor] = useState<RadiologyWorkItem | null>(null);
  const [addendumFor, setAddendumFor] = useState<RadiologyWorkItem | null>(null);

  const canPerform = hasPermission(user?.role, 'radiology.perform') || hasPermission(user?.role, 'radiology.verify');
  const canReport = hasPermission(user?.role, 'radiology.add_report');
  const canVerify = hasPermission(user?.role, 'radiology.verify');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['radiology', 'worklist', view, modality],
    queryFn: () => API.radiologyWorklist({ view: view === 'done' ? 'done' : 'open', modality: modality || undefined }),
    refetchInterval: 30_000,
    enabled: view !== 'schedule',
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['radiology', 'worklist'] });

  const reportMut = useMutation({
    mutationFn: (a: { item: RadiologyWorkItem; input: RadiologyUpdateInput }) => API.updateRadiology(a.item.admission_id, a.item.id, a.input),
    onSuccess: () => {
      refresh();
      setReportFor(null);
      toast.success(t('common.done'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  const verifyMut = useMutation({
    mutationFn: (item: RadiologyWorkItem) => API.verifyRadiology(item.id),
    onSuccess: () => {
      refresh();
      toast.success(t('imaging.verified'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  const onVerify = async (item: RadiologyWorkItem) => {
    const message = t('imaging.confirmVerify', { name: currentLang() === 'en' && item.study_type_en ? item.study_type_en : item.study_type_ar });
    if (await confirm({ message, confirmLabel: t('imaging.verifyAsIs') })) verifyMut.mutate(item);
  };

  const c = data?.counts ?? {};
  const modalities = ['XR', 'CT', 'MR', 'US', 'MG', 'RF', 'DXA', 'IR', 'NM'] as const;

  return (
    <div>
      <PageHeader
        title={t('nav.radiology')}
        subtitle={t('dept.radSubtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {view !== 'schedule' && (
              <select
                aria-label={t('imaging.allModalities')}
                value={modality}
                onChange={(e) => setModality(e.target.value as Modality | '')}
                className="h-9 rounded-lg border border-ink/12 bg-surface-raised px-2.5 text-sm font-semibold text-ink dark:border-white/12"
              >
                <option value="">{t('imaging.allModalities')}</option>
                {modalities.map((m) => (
                  <option key={m} value={m}>
                    {t(`org.modality.${m}`)}
                  </option>
                ))}
              </select>
            )}
            <div className="flex rounded-lg border border-ink/10 p-0.5 dark:border-white/10">
              {(['open', 'schedule', 'done'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={cn('rounded-md px-3 py-1.5 text-sm font-semibold', view === v ? 'bg-brand-600 text-white' : 'text-ink/60 hover:text-ink')}>
                  {v === 'schedule' ? t('imaging.scheduleTab') : t(`imaging.${v}`)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {view === 'schedule' ? (
        <ScheduleView />
      ) : (
        <>
          {view === 'open' && data && data.items.length > 0 && (
            <p className="mb-3 text-sm font-semibold text-ink/60">{t('imaging.counts', { stat: c.stat ?? 0, urgent: c.urgent ?? 0, routine: c.routine ?? 0 })}</p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          ) : error || !data ? (
            <Card>
              <CardContent>
                <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
              </CardContent>
            </Card>
          ) : data.items.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState title={view === 'open' ? t('imaging.emptyOpen') : t('imaging.emptyDone')} icon={<ScanLine className="h-6 w-6" />} />
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {data.items.map((it) => (
                <WorkCard
                  key={it.id}
                  item={it}
                  canPerform={canPerform}
                  canReport={canReport}
                  canVerify={canVerify}
                  onPerform={() => setPerformFor(it)}
                  onReport={() => setReportFor(it)}
                  onSchedule={() => setScheduleFor(it)}
                  onVerify={() => void onVerify(it)}
                  onAddendum={() => setAddendumFor(it)}
                  onPrint={() => printRadiologyWorkItem(it, t, user)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {performFor && <PerformDialog key={performFor.id} item={performFor} onClose={() => setPerformFor(null)} onDone={() => { setPerformFor(null); refresh(); }} />}
      {reportFor && (
        <ReportDialog key={reportFor.id} item={reportFor} canManageTemplates={canVerify} onClose={() => setReportFor(null)} busy={reportMut.isPending} onSubmit={(input) => reportMut.mutate({ item: reportFor, input })} />
      )}
      {scheduleFor && <ScheduleDialog key={scheduleFor.id} item={scheduleFor} onClose={() => setScheduleFor(null)} onDone={() => { setScheduleFor(null); refresh(); }} />}
      {addendumFor && <AddendumDialog key={addendumFor.id} item={addendumFor} onClose={() => setAddendumFor(null)} onDone={() => { setAddendumFor(null); refresh(); }} />}
    </div>
  );
}

function questionText(item: RadiologyWorkItem, key: string) {
  const q = item.safety.questions.find((x) => x.key === key);
  return q ? (currentLang() === 'en' ? q.en : q.ar) : key;
}

function WorkCard({
  item,
  canPerform,
  canReport,
  canVerify,
  onPerform,
  onReport,
  onSchedule,
  onVerify,
  onAddendum,
  onPrint,
}: {
  item: RadiologyWorkItem;
  canPerform: boolean;
  canReport: boolean;
  canVerify: boolean;
  onPerform: () => void;
  onReport: () => void;
  onSchedule: () => void;
  onVerify: () => void;
  onAddendum: () => void;
  onPrint: () => void;
}) {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  const waiting = item.stage === 'ordered' || item.stage === 'scheduled';
  const where = item.encounter_type === 'inpatient' && item.ward_name_ar ? t('dept.wardBed', { ward: localName({ name_ar: item.ward_name_ar, name_en: item.ward_name_en }, 'name'), bed: item.bed_no ?? '—' }) : null;
  const prep = en && item.prep_en ? item.prep_en : item.prep_ar;
  const w = item.safety.warnings.length;
  const un = item.safety.unanswered.length;

  return (
    <li className={cn('relative overflow-hidden rounded-2xl border bg-surface-raised', item.critical ? 'border-danger-400 dark:border-danger-700' : 'border-ink/10 dark:border-white/10')}>
      <span className={cn('absolute inset-y-0 start-0 w-1.5', item.critical ? 'bg-danger-600' : STRIPE[item.priority])} aria-hidden />
      <div className="space-y-2.5 p-4 ps-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/patients/${item.patient_id}?tab=radiology`} className="text-base font-extrabold text-ink hover:underline">
              {localName(item, 'full_name')}
            </Link>
            <p className="text-xs text-ink/55">
              {item.file_number}
              {item.birth_date ? ` · ${calcAge(item.birth_date)}` : ''}
              {item.gender ? ` · ${t(`gender.${item.gender}`)}` : ''}
              {` · ${t(`encounter.types.${item.encounter_type}`)}`}
              {where ? ` · ${where}` : ''}
              {item.referral_source ? ` · ${t('encounter.referredBy', { source: item.referral_source })}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.critical && (
              <Badge variant="danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('imaging.critical')}
              </Badge>
            )}
            {item.priority !== 'routine' && <Badge variant={item.priority === 'stat' ? 'danger' : 'warning'}>{t(`imaging.priorities.${item.priority}`)}</Badge>}
            <Badge variant={item.stage === 'verified' ? 'success' : item.stage === 'reported' ? 'info' : item.stage === 'performed' ? 'brand' : 'warning'}>{t(`imaging.stages.${item.stage}`)}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-4 w-4 shrink-0 text-info-600" />
          <span className="font-bold text-ink">{en && item.study_type_en ? item.study_type_en : item.study_type_ar}</span>
          {item.modality && <Badge variant="info">{t(`org.modality.${item.modality}`)}</Badge>}
        </div>
        {item.indication && (
          <p className="text-sm text-ink/80">
            <span className="font-semibold text-ink/55">{t('imaging.reasonLabel')}: </span>
            {item.indication}
          </p>
        )}
        <p className="text-xs text-ink/50">
          {t('imaging.ordered', { by: item.ordered_by, at: fmtDateTime(item.ordered_at) })}
          {item.stage === 'scheduled' && item.scheduled_at && ` · ${t('imaging.scheduledFor', { at: fmtDateTime(item.scheduled_at) })}`}
        </p>

        {waiting && (w > 0 || un > 0) && (
          <div className={cn('rounded-lg border px-3 py-2 text-sm', w > 0 ? 'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-700 dark:bg-danger-900/25 dark:text-danger-100' : 'border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-900/25 dark:text-warning-100')}>
            <p className="flex items-center gap-1.5 font-bold">
              {w > 0 ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {w > 0 ? t('imaging.warnCount', { n: w }) : t('imaging.unansweredCount', { n: un })}
              {w > 0 && un > 0 ? ` · ${t('imaging.unansweredCount', { n: un })}` : ''}
            </p>
            {w > 0 && (
              <ul className="mt-1 list-disc ps-5">
                {item.safety.warnings.map((k) => (
                  <li key={k}>{questionText(item, k)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {waiting && prep && (
          <p className="text-xs leading-relaxed text-ink/60">
            <span className="font-bold">{t('imaging.prep')}: </span>
            {prep}
          </p>
        )}

        {item.exam_done_at && (
          <p className="text-xs font-semibold text-ink/60">
            {t('imaging.performedAt', { by: item.exam_done_by ?? '—', at: fmtDateTime(item.exam_done_at) })}
            {item.unit_name_ar ? ` · ${localName({ name_ar: item.unit_name_ar, name_en: item.unit_name_en }, 'name')}` : ''}
            {item.exam_note ? ` — ${item.exam_note}` : ''}
          </p>
        )}
        {item.report && (
          <div className="rounded-lg bg-surface-muted/80 px-3.5 py-3 dark:bg-white/5">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">{item.report}</p>
            <p className="mt-1.5 text-xs text-ink/45">
              {item.stage === 'verified' ? t('imaging.verifiedBy', { name: item.verified_by ?? item.performed_by ?? '—' }) : t('imaging.reportedBy', { name: item.performed_by ?? '—' })}
            </p>
            {item.stage === 'reported' && <p className="mt-0.5 text-xs font-semibold text-info-600 dark:text-info-300">{t('imaging.preliminaryNote')}</p>}
            {item.addendum && (
              <div className="mt-2.5 rounded-md border border-warning-300 bg-warning-50 px-3 py-2 dark:border-warning-700 dark:bg-warning-900/25">
                <p className="text-xs font-bold text-warning-800 dark:text-warning-200">{t('imaging.addendumLabel')}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink/85">{item.addendum}</p>
                <p className="mt-1 text-xs text-ink/45">{t('imaging.addendumBy', { name: item.addendum_by ?? '—', at: item.addendum_at ? fmtDateTime(item.addendum_at) : '—' })}</p>
              </div>
            )}
          </div>
        )}

        <RecordFileChips admissionId={item.admission_id} files={item.files} recordType="radiology" recordId={item.id} />

        {(canPerform || canReport || canVerify) && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {waiting && canPerform && (
              <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={onPerform}>
                {t('imaging.perform')}
              </Button>
            )}
            {waiting && canPerform && (
              <Button size="sm" variant="outline" icon={<CalendarClock className="h-3.5 w-3.5" />} onClick={onSchedule}>
                {item.stage === 'scheduled' ? t('imaging.reschedule') : t('imaging.schedule')}
              </Button>
            )}
            {canReport && (item.stage === 'performed' || item.stage === 'reported' || (waiting && !canPerform)) && (
              <Button size="sm" variant={item.stage === 'performed' ? 'primary' : 'outline'} icon={<PenLine className="h-3.5 w-3.5" />} onClick={onReport}>
                {t('imaging.writeReport')}
              </Button>
            )}
            {canVerify && item.stage === 'reported' && (
              <Button size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={onVerify}>
                {t('imaging.verifyAsIs')}
              </Button>
            )}
            {canVerify && item.stage === 'verified' && (
              <Button size="sm" variant="outline" icon={<FilePlus2 className="h-3.5 w-3.5" />} onClick={onAddendum}>
                {t('imaging.addAddendum')}
              </Button>
            )}
            {item.report && (
              <Button size="sm" variant="ghost" icon={<Printer className="h-3.5 w-3.5" />} onClick={onPrint}>
                {t('print.radReport')}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PerformDialog({ item, onClose, onDone }: { item: RadiologyWorkItem; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const en = currentLang() === 'en';
  const { data: units } = useQuery({ queryKey: ['units', 'all'], queryFn: () => API.listUnits(), staleTime: 60_000 });
  const [unitId, setUnitId] = useState(item.unit_id ?? '');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirm = item.safety.questions.length > 0;

  // أجهزة من نوع الفحص فقط (أو بلا نوع)؛ ما ليس «يعمل» يظهر معطّلاً
  const list: DepartmentUnit[] = (units ?? []).filter((u) => !item.modality || !u.modality || u.modality === item.modality);
  const mut = useMutation({
    mutationFn: () => API.performRadiology(item.id, { unitId: unitId || null, note, safetyConfirmed: confirmed }),
    onSuccess: () => {
      toast.success(t('imaging.performed'));
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('imaging.performTitle', { name: en && item.study_type_en ? item.study_type_en : item.study_type_ar })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={needsConfirm && !confirmed}>
            {t('imaging.perform')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold text-ink/70">
          {localName(item, 'full_name')} · {item.file_number}
        </p>

        {needsConfirm && (
          <div className="rounded-xl border border-ink/10 p-3.5 dark:border-white/10">
            <p className="mb-2 text-sm font-bold text-ink">{t('imaging.safetyReview')}</p>
            <ul className="space-y-1.5">
              {item.safety.questions.map((q) => {
                const a = item.safety.answers[q.key];
                const warn = a === q.warnIf;
                return (
                  <li key={q.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className={cn('flex-1', warn ? 'font-bold text-danger-700 dark:text-danger-300' : 'text-ink/80')}>{en ? q.en : q.ar}</span>
                    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-bold', warn ? 'bg-danger-600 text-white' : a ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200' : 'bg-ink/8 text-ink/50')}>
                      {a ? t(`imaging.${a}`) : t('imaging.notAnswered')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              {t('imaging.confirmSafety')}
            </label>
          </div>
        )}

        <Select
          label={t('imaging.device')}
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          placeholder={t('imaging.anyDevice')}
          options={list.map((u) => ({ value: u.id, label: `${localName(u, 'name')}${u.status !== 'active' ? ` — ${t(`org.unitStatus.${u.status}`)}` : ''}` }))}
        />
        <Textarea label={t('imaging.techNote')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('imaging.techNoteHint')} />
      </div>
    </Dialog>
  );
}

function ReportDialog({ item, canManageTemplates, onClose, onSubmit, busy }: { item: RadiologyWorkItem; canManageTemplates: boolean; onClose: () => void; onSubmit: (i: RadiologyUpdateInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const en = currentLang() === 'en';
  const toast = useToast();
  const qc = useQueryClient();
  const [report, setReport] = useState(item.report ?? '');
  const [critical, setCritical] = useState(Boolean(item.critical));
  const [templateId, setTemplateId] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: templates } = useQuery({ queryKey: ['report-templates', item.modality], queryFn: () => API.listReportTemplates(item.modality ?? undefined) });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = (templates ?? []).find((x) => x.id === id);
    if (!tpl) return;
    const body = en && tpl.body_en ? tpl.body_en : tpl.body_ar;
    setReport((prev) => (prev.trim() ? `${prev}\n\n${body}` : body));
  };

  const saveTemplateMut = useMutation({
    mutationFn: () => API.createReportTemplate({ modality: item.modality, titleAr: newTitle.trim(), bodyAr: report.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-templates'] });
      setSavingTemplate(false);
      setNewTitle('');
      toast.success(t('imaging.templateSaved'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => API.deleteReportTemplate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('imaging.writeReport')} — ${item.study_type_ar}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSubmit({ report: report.trim(), critical })} loading={busy} disabled={report.trim().length < 2}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {templates && templates.length > 0 && (
          <div className="flex items-end gap-2">
            <Select
              label={t('imaging.useTemplate')}
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              placeholder={t('imaging.pickTemplate')}
              options={templates.map((tpl: ReportTemplate) => ({ value: tpl.id, label: en && tpl.title_en ? tpl.title_en : tpl.title_ar }))}
            />
            {canManageTemplates && templateId && (
              <Button type="button" size="icon-sm" variant="ghost" className="mb-0.5 shrink-0 text-danger-500" aria-label={t('imaging.deleteTemplate')} onClick={() => { deleteTemplateMut.mutate(templateId); setTemplateId(''); }}>
                ×
              </Button>
            )}
          </div>
        )}
        <Textarea label={t('radiology.report')} rows={7} value={report} onChange={(e) => setReport(e.target.value)} autoFocus />

        {canManageTemplates && (
          <div className="rounded-lg border border-dashed border-ink/15 p-2.5 dark:border-white/15">
            {savingTemplate ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1">
                  <label className="mb-1 block text-xs font-semibold text-ink/70">{t('imaging.templateTitle')}</label>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-9 w-full rounded-lg border border-ink/15 bg-surface-raised px-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none" autoFocus />
                </div>
                <Button size="sm" loading={saveTemplateMut.isPending} disabled={newTitle.trim().length < 2 || report.trim().length < 2} onClick={() => saveTemplateMut.mutate()}>
                  {t('common.save')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSavingTemplate(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setSavingTemplate(true)}>
                {t('imaging.saveAsTemplate')}
              </Button>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-danger-200 bg-danger-50/60 p-3 text-sm font-semibold text-danger-800 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
          {t('imaging.markCritical')}
        </label>
      </div>
    </Dialog>
  );
}

function AddendumDialog({ item, onClose, onDone }: { item: RadiologyWorkItem; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [addendum, setAddendum] = useState('');
  const mut = useMutation({
    mutationFn: () => API.addRadiologyAddendum(item.id, addendum.trim()),
    onSuccess: () => {
      toast.success(t('common.done'));
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('imaging.addAddendum')} — ${item.study_type_ar}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={addendum.trim().length < 2}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-surface-muted/80 px-3.5 py-3 text-sm leading-relaxed text-ink/70 dark:bg-white/5">{item.report}</div>
        <Textarea label={t('imaging.addendumLabel')} rows={4} value={addendum} onChange={(e) => setAddendum(e.target.value)} autoFocus placeholder={t('imaging.addendumHint')} />
      </div>
    </Dialog>
  );
}
