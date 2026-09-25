import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarClock, Copy, CreditCard, Hourglass, LogOut, Send } from 'lucide-react';
import type { PaymentInfo } from '@hmsi/shared';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * الاشتراك والدفع: حالة الاشتراك، معلومات الدفع (يضبطها المدير العام)، وإرسال إشعار دفع.
 * تبقى متاحة حتى بعد انتهاء الاشتراك — هي الصفحة الوحيدة المتاحة حينها.
 */
export default function BillingPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: API.billing });
  const sub = data?.subscription ?? user?.subscription;
  const expired = sub?.status === 'expired';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')} />

      {expired && (
        <Alert variant="danger" title={t('billing.expiredTitle')}>
          {data?.can_submit ? t('billing.expiredAdmin') : t('billing.expiredStaff')}
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl', expired ? 'bg-danger-100 text-danger-700' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200')}>
            {sub?.status === 'active' || sub?.status === 'unlimited' ? <BadgeCheck className="h-6 w-6" /> : <Hourglass className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-ink">{sub ? t(`billing.status.${sub.status}`) : '—'}</p>
            {sub?.ends_at && (
              <p className="text-sm text-ink/60">
                {expired ? t('billing.endedOn', { date: fmtDate(sub.ends_at) }) : t('billing.endsOn', { date: fmtDate(sub.ends_at), count: sub.days_left ?? 0 })}
              </p>
            )}
          </div>
          {expired && (
            <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={() => void logout()}>
              {t('nav.logout')}
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        data && (
          <>
            <PaymentInfoCard info={data.payment_info} />
            {data.can_submit && <NoticeForm />}
            {data.notices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('billing.noticesTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-ink/6 text-sm dark:divide-white/5">
                    {data.notices.map((n) => (
                      <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span>
                          <span className="font-bold text-ink">{n.amount}</span> · {n.method}
                          {n.reference && <span className="text-ink/55"> · <bdi dir="ltr">{n.reference}</bdi></span>}
                          <span className="block text-xs tabular text-ink/45">{fmtDateTime(n.submitted_at)}</span>
                          {n.review_note && <span className="block text-xs text-ink/60">{n.review_note}</span>}
                        </span>
                        <Badge variant={n.status === 'approved' ? 'success' : n.status === 'rejected' ? 'danger' : 'warning'}>{t(`billing.noticeStatus.${n.status}`)}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}

function PaymentInfoCard({ info }: { info: PaymentInfo }) {
  const { t } = useTranslation();
  const toast = useToast();
  const rows: [string, string][] = (
    [
      ['bank_name', info.bank_name],
      ['account_name', info.account_name],
      ['account_number', info.account_number],
      ['phone', info.phone],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const empty = rows.length === 0 && !info.price && !info.notes;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-600" />
          {t('billing.howToPay')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <p className="text-sm text-ink/55">{t('billing.noInfo')}</p>
        ) : (
          <>
            {info.price && <p className="text-xl font-extrabold text-brand-700 dark:text-brand-300">{info.price}</p>}
            <dl className="grid gap-2 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted/70 px-3 py-2 dark:bg-white/5">
                  <span className="min-w-0">
                    <dt className="text-xs font-bold text-ink/50">{t(`billing.fields.${k}`)}</dt>
                    <dd className="truncate font-bold text-ink" dir={k === 'account_number' || k === 'phone' ? 'ltr' : undefined}>{v}</dd>
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={t('familyPin.copyLink')} onClick={() => void navigator.clipboard?.writeText(v).then(() => toast.success(t('billing.copied')))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </dl>
            {info.notes && <p className="whitespace-pre-wrap text-sm text-ink/70">{info.notes}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NoticeForm() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ amount: '', method: '', reference: '', note: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mut = useMutation({
    mutationFn: () => API.submitPaymentNotice({ amount: form.amount.trim(), method: form.method.trim(), reference: form.reference.trim() || null, note: form.note.trim() || null }),
    onSuccess: () => {
      setForm({ amount: '', method: '', reference: '', note: '' });
      void qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success(t('billing.noticeSent'));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-brand-600" />
          {t('billing.noticeTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-ink/60">{t('billing.noticeHint')}</p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <Input label={t('billing.amount')} value={form.amount} onChange={set('amount')} required />
          <Input label={t('billing.method')} value={form.method} onChange={set('method')} required placeholder={t('billing.methodPlaceholder')} />
          <Input label={t('billing.reference')} value={form.reference} onChange={set('reference')} dir="ltr" />
          <Input label={t('billing.note')} value={form.note} onChange={set('note')} />
          <div className="sm:col-span-2">
            <Button type="submit" loading={mut.isPending} disabled={!form.amount.trim() || !form.method.trim()} icon={<Send className="h-4 w-4" />}>
              {t('billing.sendNotice')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
