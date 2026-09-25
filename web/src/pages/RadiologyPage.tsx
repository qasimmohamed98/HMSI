import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PenLine, Plus, ScanLine } from 'lucide-react';
import { Button, Dialog, Input, Textarea, Badge, Skeleton, EmptyState, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type RadiologyInput, type RadiologyUpdateInput } from '@/lib/api';
import { useToast } from '@/components/ui';
import { fmtDateTime, localName } from '@/lib/format';
import { AdmittedPatientCard, useAdmittedCharts } from '@/features/departments';

export default function RadiologyPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, refetchAll } = useAdmittedCharts();
  const toast = useToast();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [dialog, setDialog] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<{ admissionId: string; id: string; study: string } | null>(null);

  // كتابة تقرير لطلب أشعة موجود (بدل إنشاء سجل جديد)
  const reportMut = useMutation({
    mutationFn: (args: { admissionId: string; id: string; input: RadiologyUpdateInput }) => API.updateRadiology(args.admissionId, args.id, args.input),
    onSuccess: () => {
      refetchAll();
      setReportFor(null);
      toast.success(t('common.done'));
    },
  });

  const mut = useMutation({
    mutationFn: API.addRadiology,
    onSuccess: () => {
      refetchAll();
      setDialog(null);
      toast.success(t('common.done'));
    },
  });

  const isPending = (r: { report: string | null }) => !r.report;
  const rows = (data ?? [])
    .map((d) => ({ ...d, items: pendingOnly ? d.chart.radiology.filter(isPending) : d.chart.radiology }))
    .filter((d) => !pendingOnly || d.items.length > 0);
  const pendingCount = (data ?? []).reduce((n, d) => n + d.chart.radiology.filter(isPending).length, 0);

  return (
    <div>
      <PageHeader title={t('nav.radiology')} subtitle={t('dept.radSubtitle')}
        actions={
          <div className="flex rounded-lg border border-ink/10 p-0.5 dark:border-white/10">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setPendingOnly(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${pendingOnly === v ? 'bg-brand-600 text-white' : 'text-ink/60 hover:text-ink'}`}
              >
                {v ? `${t('ui.pendingOnly')} (${pendingCount})` : t('ui.showAll')}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={pendingOnly ? t('ui.noPending') : t('dept.noAdmitted')} icon={<ScanLine className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(({ patient, chart, items }) => (
            <AdmittedPatientCard key={patient.id} patient={patient}>
              {items.length === 0 ? (
                <p className="py-2 text-center text-sm font-medium text-ink/45">{t('radiology.empty')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {items.map((r) => (
                    <li key={r.id} className="rounded-lg border border-ink/8 px-3.5 py-2.5 dark:border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-ink">{localName(r, 'study_type')}</p>
                        <Badge variant={r.report ? 'success' : 'warning'}>{r.report ? t('laboratory.statuses.resulted') : t('laboratory.statuses.ordered')}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">{fmtDateTime(r.ordered_at)}</p>
                      {r.report ? (
                        <p className="mt-2 text-sm leading-relaxed text-ink/80">{r.report}</p>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          icon={<PenLine className="h-3.5 w-3.5" />}
                          onClick={() => setReportFor({ admissionId: r.admission_id, id: r.id, study: localName(r, 'study_type') })}
                        >
                          {t('actions.enterReport')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog(chart.admissionId)}
                  icon={<Plus className="h-4 w-4" />}
                >
                  {t('radiology.add')}
                </Button>
              </div>
            </AdmittedPatientCard>
          ))}
        </div>
      )}

      {dialog && <AddReportDialog key={dialog} admissionId={dialog} open onClose={() => setDialog(null)} onSubmit={(i) => mut.mutate(i)} busy={mut.isPending} />}
      {reportFor && (
        <WriteReportDialog
          key={reportFor.id}
          study={reportFor.study}
          onClose={() => setReportFor(null)}
          onSubmit={(input) => reportMut.mutate({ admissionId: reportFor.admissionId, id: reportFor.id, input })}
          busy={reportMut.isPending}
        />
      )}
    </div>
  );
}

function AddReportDialog({
  open,
  onClose,
  admissionId,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string | null;
  onSubmit: (i: RadiologyInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [studyTypeAr, setStudyTypeAr] = useState('');
  const [report, setReport] = useState('');

  if (!admissionId) return null;
  const submit = () => {
    if (studyTypeAr.trim().length < 2) return;
    onSubmit({ admissionId, studyTypeAr: studyTypeAr.trim(), report });
    setStudyTypeAr('');
    setReport('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('radiology.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('radiology.studyType')} value={studyTypeAr} onChange={(e) => setStudyTypeAr(e.target.value)} autoFocus placeholder={t('examples.radiology')} />
        <Textarea label={t('radiology.report')} rows={4} value={report} onChange={(e) => setReport(e.target.value)} />
      </div>
    </Dialog>
  );
}
function WriteReportDialog({ study, onClose, onSubmit, busy }: { study: string; onClose: () => void; onSubmit: (i: RadiologyUpdateInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [report, setReport] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('actions.enterReport')} — ${study}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSubmit({ report: report.trim() })} loading={busy} disabled={report.trim().length < 2}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Textarea label={t('radiology.report')} rows={5} value={report} onChange={(e) => setReport(e.target.value)} autoFocus />
    </Dialog>
  );
}
