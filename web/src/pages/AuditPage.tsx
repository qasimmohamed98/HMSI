import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import type { AuditEntry } from '@hmsi/shared';
import { Button, Card, CardContent, EmptyState, Skeleton, TableRoot, THead, TBody, Th, Td, TRow } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { currentLang } from '@/i18n';

/** أسماء مقروءة لأهم العمليات — غير المعروف يُعرض برمزه */
const ACTIONS: Record<string, [string, string]> = {
  login: ['تسجيل دخول', 'Sign in'],
  login_failed: ['محاولة دخول فاشلة', 'Failed sign-in'],
  logout: ['تسجيل خروج', 'Sign out'],
  password_changed: ['تغيير كلمة المرور', 'Password changed'],
  password_reset: ['إعادة تعيين كلمة مرور', 'Password reset'],
  patient_viewed: ['فتح ملف مريض', 'Chart viewed'],
  patient_created: ['تسجيل مريض', 'Patient registered'],
  patient_updated: ['تعديل بيانات مريض', 'Patient updated'],
  patient_archived: ['أرشفة مريض', 'Patient archived'],
  patient_admitted: ['تنويم', 'Admission'],
  patient_transferred: ['نقل سرير', 'Bed transfer'],
  patient_discharged: ['خروج', 'Discharge'],
  family_pin_regenerated: ['إصدار رمز عائلة جديد', 'Family code reissued'],
  family_track_viewed: ['اطلاع ذوي المريض', 'Family viewed status'],
  medication_prescribed: ['وصف دواء', 'Medication prescribed'],
  medication_dispensed: ['صرف دواء', 'Medication dispensed'],
  lab_ordered: ['طلب فحص', 'Lab ordered'],
  lab_result_updated: ['إدخال نتيجة', 'Lab result'],
  radiology_ordered: ['طلب أشعة', 'Imaging ordered'],
  attachment_downloaded: ['تنزيل مرفق', 'Attachment downloaded'],
  user_created: ['إنشاء مستخدم', 'User created'],
  user_updated: ['تعديل مستخدم', 'User updated'],
  hospital_switched: ['دخول المدير العام', 'Super admin entered'],
  allergy_override: ['تجاوز تحذير حساسية', 'Allergy warning overridden'],
  backup_created: ['نسخة احتياطية', 'Backup created'],
  backup_downloaded: ['تنزيل نسخة احتياطية', 'Backup downloaded'],
  hospital_exported: ['تصدير بيانات المستشفى', 'Hospital data exported'],
  errors_cleared: ['مسح سجل الأخطاء', 'Error log cleared'],
  mfa_enabled: ['تفعيل التحقق بخطوتين', '2-step verification on'],
  handover_written: ['تسليم مناوبة', 'Shift handover'],
  emergency_access: ['وصول طارئ لملف مريض', 'Emergency chart access'],
  care_team_added: ['إضافة لفريق الرعاية', 'Added to care team'],
  care_team_removed: ['إزالة من فريق الرعاية', 'Removed from care team'],
  nurse_handover_sent: ['طلب تسليم مرضى', 'Patient handover sent'],
  nurse_handover_accepted: ['استلام مرضى', 'Patient handover accepted'],
  nurse_handover_rejected: ['رفض استلام', 'Patient handover declined'],
  nurse_handover_cancelled: ['إلغاء تسليم', 'Patient handover cancelled'],
  care_plan_updated: ['تحديث الخطة العلاجية', 'Care plan updated'],
  demo_purged: ['حذف البيانات التجريبية', 'Demo data deleted'],
  hospital_purged: ['حذف مستشفى نهائياً', 'Hospital deleted permanently'],
  mfa_disabled: ['إيقاف التحقق بخطوتين', '2-step verification off'],
  mfa_failed: ['رمز تحقق خاطئ', 'Wrong verification code'],
  mfa_reset: ['إعادة ضبط التحقق بخطوتين', '2-step verification reset'],
  mfa_recovery_regenerated: ['رموز استرداد جديدة', 'New recovery codes'],
};

export default function AuditPage() {
  const { t } = useTranslation();
  const lang = currentLang();
  const q = useInfiniteQuery({
    queryKey: ['audit'],
    queryFn: ({ pageParam }) => API.listAudit(pageParam ? { before: pageParam } : undefined),
    initialPageParam: '' as string,
    getNextPageParam: (last: AuditEntry[]) => (last.length >= 100 ? last[last.length - 1]!.created_at : undefined),
  });
  const rows = q.data?.pages.flat() ?? [];
  const label = (a: string) => ACTIONS[a]?.[lang === 'ar' ? 0 : 1] ?? a;
  const danger = (a: string) => a === 'login_failed' || a.endsWith('_deleted') || a === 'patient_archived';

  return (
    <div>
      <PageHeader title={t('ui.auditTitle')} subtitle={t('ui.auditSubtitle')} />
      {q.isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : q.error ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void q.refetch() }} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={t('ui.auditEmpty')} icon={<ScrollText className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <TableRoot>
              <THead>
                <tr>
                  <Th>{t('ui.auditTime')}</Th>
                  <Th>{t('ui.auditActor')}</Th>
                  <Th>{t('ui.auditAction')}</Th>
                  <Th>{t('ui.auditResource')}</Th>
                  <Th>{t('ui.auditIp')}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TRow key={r.id}>
                    <Td className="whitespace-nowrap tabular text-ink/60">{fmtDateTime(r.created_at)}</Td>
                    <Td className="font-semibold">{r.actor_name ?? t('ui.auditSystem')}</Td>
                    <Td className={danger(r.action) ? 'font-semibold text-danger-600' : undefined}>{label(r.action)}</Td>
                    <Td className="text-xs text-ink/50" dir="ltr">
                      {r.resource_type}
                      {r.resource_id ? ` · ${r.resource_id}` : ''}
                    </Td>
                    <Td className="text-xs text-ink/45 tabular" dir="ltr">{r.ip ?? '—'}</Td>
                  </TRow>
                ))}
              </TBody>
            </TableRoot>
          </div>
          {q.hasNextPage && (
            <div className="border-t border-ink/8 p-3 text-center dark:border-white/10">
              <Button variant="ghost" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {t('ui.loadMore')}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
