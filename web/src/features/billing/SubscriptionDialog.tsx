import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { HospitalListItem } from '@hmsi/shared';
import { Badge, Button, Dialog, Input, useToast } from '@/components/ui';
import { API } from '@/lib/api';
import { fmtDate, fmtDateTime, localName } from '@/lib/format';
import { cn } from '@/lib/utils';

const MONTHS = [1, 3, 6, 12] as const;

/** المدير العام: تفعيل/تمديد اشتراك مستشفى ومراجعة إشعارات الدفع الخاصة به */
export function SubscriptionDialog({ hospital, onClose }: { hospital: HospitalListItem; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: notices } = useQuery({ queryKey: ['paymentNotices'], queryFn: () => API.listPaymentNotices() });
  const mine = (notices ?? []).filter((n) => n.hospital_id === hospital.id);
  const pending = mine.filter((n) => n.status === 'pending');
  const [months, setMonths] = useState<number | null>(1);
  const [until, setUntil] = useState('');
  // الإشعارات تُحمَّل بعد فتح النافذة: الافتراضي أول إشعار معلّق ما لم يُختر غيره
  const [picked, setNoticeId] = useState<string | null | undefined>(undefined);
  const noticeId = picked === undefined ? (pending[0]?.id ?? null) : picked;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['hospitals'] });
    void qc.invalidateQueries({ queryKey: ['paymentNotices'] });
  };
  const activate = useMutation({
    mutationFn: () => API.updateSubscription(hospital.id, until ? { until, noticeId: noticeId ?? undefined } : { months: months ?? 1, noticeId: noticeId ?? undefined }),
    onSuccess: () => {
      refresh();
      toast.success(t('subscriptionAdmin.activated'));
      onClose();
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => API.rejectPaymentNotice(id, null),
    onSuccess: () => {
      refresh();
      toast.success(t('common.done'));
    },
  });

  const sub = hospital.subscription;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('subscriptionAdmin.title')} — ${localName(hospital, 'name')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={activate.isPending} disabled={!months && !until} onClick={() => activate.mutate()} icon={<CheckCircle2 className="h-4 w-4" />}>
            {t('subscriptionAdmin.activate')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-surface-muted/70 p-3 text-sm dark:bg-white/5">
          <p className="font-bold text-ink">{sub ? t(`billing.status.${sub.status}`) : '—'}</p>
          {sub?.ends_at && <p className="text-ink/60">{t('subscriptionAdmin.until', { date: fmtDate(sub.ends_at) })}</p>}
          {(hospital.contact_name || hospital.contact_phone) && (
            <p className="mt-1 text-ink/60">
              {hospital.contact_name} · <bdi dir="ltr">{hospital.contact_phone}</bdi>
              {hospital.city ? ` · ${hospital.city}` : ''}
            </p>
          )}
        </div>

        {mine.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-ink">{t('subscriptionAdmin.notices')}</p>
            <ul className="space-y-2">
              {mine.map((n) => (
                <li
                  key={n.id}
                  className={cn('flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm', n.id === noticeId ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-900/20' : 'border-ink/10 dark:border-white/10')}
                >
                  {n.status === 'pending' && <input type="radio" name="notice" checked={n.id === noticeId} onChange={() => setNoticeId(n.id)} className="accent-brand-600" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{n.amount}</span> · {n.method}
                    {n.reference && <> · <bdi dir="ltr">{n.reference}</bdi></>}
                    <span className="block text-xs text-ink/50">
                      {n.submitted_by} · <span className="tabular">{fmtDateTime(n.submitted_at)}</span>
                      {n.note ? ` · ${n.note}` : ''}
                    </span>
                  </span>
                  {n.status === 'pending' ? (
                    <Button size="sm" variant="ghost" className="text-danger-600" loading={reject.isPending && reject.variables === n.id} icon={<XCircle className="h-4 w-4" />} onClick={() => reject.mutate(n.id)}>
                      {t('subscriptionAdmin.reject')}
                    </Button>
                  ) : (
                    <Badge variant={n.status === 'approved' ? 'success' : 'danger'}>{t(`billing.noticeStatus.${n.status}`)}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t('subscriptionAdmin.period')}</p>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMonths(m);
                  setUntil('');
                }}
                className={cn('rounded-lg border px-3 py-2 text-sm font-bold', months === m && !until ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink/15 text-ink/70 hover:bg-surface-muted dark:border-white/15')}
              >
                {t('subscriptionAdmin.months', { count: m })}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <Input
              type="date"
              label={t('subscriptionAdmin.orUntil')}
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setMonths(null);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ink/50">{t('subscriptionAdmin.extendHint')}</p>
        </div>
      </div>
    </Dialog>
  );
}
