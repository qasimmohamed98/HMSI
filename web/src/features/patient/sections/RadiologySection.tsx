import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, ScanLine, PenLine, Trash2, Printer } from 'lucide-react';
import { Button, Dialog, Textarea, Badge } from '@/components/ui';
import { SectionCard, EmptyLine } from './SectionCard';
import { RecordFiles } from './RecordFiles';
import { ImagingOrderDialog } from '@/features/radiology/ImagingOrderDialog';
import { printRadiologyReport } from '../printChart';
import { useAuth } from '@/lib/auth';
import { API, type RadiologyUpdateInput, type ChartData } from '@/lib/api';
import { fmtDateTime, localName } from '@/lib/format';
import { useToast, useConfirm } from '@/components/ui';

/** canOrder: طلب أشعة (الطبيب) — canResult: كتابة التقرير (فني الأشعة) */
/**
 * onNeedVisit: لا زيارة مفتوحة → يفتح «زيارة جديدة» (فحص فقط) ثم نافذة الطلب مباشرة (autoOpen).
 */
export function RadiologySection({ chart, canOrder, canResult, onNeedVisit, autoOpen }: { chart: ChartData; canOrder: boolean; canResult: boolean; onNeedVisit?: () => void; autoOpen?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editRad, setEditRad] = useState<(typeof chart.radiology)[number] | null>(null);

  const canAdd = (canOrder || canResult) && chart.patient.admission?.status === 'active';
  // بعد فتح الزيارة من هذا القسم: نافذة الطلب تُفتح مباشرة
  useEffect(() => {
    if (autoOpen && canAdd && chart.admissionId) setOpen(true);
  }, [autoOpen, canAdd, chart.admissionId]);

  const mut = useMutation({
    mutationFn: API.addRadiology,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setOpen(false);
      toast.success(t('common.done'));
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { admissionId: string; radiologyId: string; input: RadiologyUpdateInput }) => API.updateRadiology(args.admissionId, args.radiologyId, args.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      setEditRad(null);
      toast.success(t('common.done'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string }) => API.deleteRadiology(args.admissionId, args.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
      toast.success(t('common.done'));
    },
  });

  return (
    <SectionCard
      title={t('radiology.title')}
      action={
        <div className="flex gap-2">
          {chart.radiology.some((r) => r.report) && (
            <Button size="sm" variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printRadiologyReport(chart, t, user)}>
              {t('print.radReport')}
            </Button>
          )}
          {!canAdd && (canOrder || canResult) && onNeedVisit && (
            <Button size="sm" variant="secondary" onClick={onNeedVisit} icon={<Plus className="h-4 w-4" />}>
              {t('orders.radOrder')}
            </Button>
          )}
          {canAdd && chart.admissionId && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
              {canResult ? t('radiology.add') : t('orders.radOrder')}
            </Button>
          )}
        </div>
      }
    >
      {chart.radiology.length === 0 ? (
        <EmptyLine>{t('radiology.empty')}</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {chart.radiology.map((r) => (
            <div key={r.id} className="rounded-xl border border-ink/8 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 dark:bg-info-900/40 dark:text-info-300">
                    <ScanLine className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{localName(r, 'study_type')}</p>
                    <p className="text-xs text-ink/50">
                      {fmtDateTime(r.ordered_at)} · {t('radiology.orderedBy')}: {r.ordered_by}
                      {r.indication ? ` · ${r.indication}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.priority && r.priority !== 'routine' && <Badge variant={r.priority === 'stat' ? 'danger' : 'warning'}>{t(`imaging.priorities.${r.priority}`)}</Badge>}
                  <Badge variant={r.stage === 'verified' ? 'success' : r.stage === 'reported' ? 'info' : r.stage === 'performed' ? 'brand' : 'warning'}>{t(`imaging.stages.${r.stage ?? (r.report ? 'verified' : 'ordered')}`)}</Badge>
                  {r.report && (
                    <Button size="icon-sm" variant="ghost" aria-label={t('print.radReport')} title={t('print.radReport')} onClick={() => printRadiologyReport(chart, t, user, r.id)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  )}
                  {chart.admissionId && (
                    <>
                      {canResult && !r.report && (
                        <Button size="sm" variant="outline" icon={<PenLine className="h-3.5 w-3.5" />} onClick={() => setEditRad(r)}>
                          {t('actions.enterReport')}
                        </Button>
                      )}
                      {(canResult || (canOrder && !r.report)) && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                          onClick={async () => { if (await confirm(t('ui.confirmDeleteRecord'))) deleteMut.mutate({ admissionId: chart.admissionId!, id: r.id }); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {r.report && (
                <div className="mt-3 rounded-lg bg-surface-muted/80 px-3.5 py-3 dark:bg-white/5">
                  <p className="text-sm leading-relaxed text-ink/85">{r.report}</p>
                  {r.stage === 'reported' && <p className="mt-1.5 text-xs font-semibold text-info-600 dark:text-info-300">{t('imaging.preliminaryNote')}</p>}
                  {r.performed_by && <p className="mt-1.5 text-xs text-ink/45">{t('radiology.performedBy')}: {r.performed_by}</p>}
                </div>
              )}
              <RecordFiles chart={chart} recordType="radiology" recordId={r.id} />
            </div>
          ))}
        </div>
      )}

      <ImagingOrderDialog open={open} onClose={() => setOpen(false)} admissionId={chart.admissionId} gender={chart.patient.gender ?? null} withReport={canResult} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />
      {editRad && chart.admissionId && (
        <ReportRadiologyDialog
          open
          onClose={() => setEditRad(null)}
          initial={editRad}
          onSubmit={(input) => updateMut.mutate({ admissionId: chart.admissionId!, radiologyId: editRad.id, input })}
          busy={updateMut.isPending}
        />
      )}
    </SectionCard>
  );
}

function ReportRadiologyDialog({
  open,
  onClose,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: { study_type_ar: string; report: string | null };
  onSubmit: (i: RadiologyUpdateInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [report, setReport] = useState(initial.report ?? '');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('actions.enterReport')} — ${initial.study_type_ar}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSubmit({ report })} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea label={t('radiology.report')} rows={4} value={report} onChange={(e) => setReport(e.target.value)} autoFocus />
      </div>
    </Dialog>
  );
}
