import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CreditCard, Hospital as HospitalIcon, LogIn, Plus, Power, PowerOff, UserPlus } from 'lucide-react';
import { SubscriptionDialog } from '@/features/billing/SubscriptionDialog';
import { fmtDate } from '@/lib/format';
import type { HospitalListItem } from '@hmsi/shared';
import { Badge, Button, Card, CardContent, ConfirmDialog, Dialog, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { API, type CreateHospitalInput, type HospitalAdminInput } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentLang } from '@/i18n';
import { localName } from '@/lib/format';

/** إدارة المستشفيات — للمدير العام فقط (hospitals.manage) */
export default function HospitalsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['hospitals'], queryFn: API.listHospitals });
  const [createOpen, setCreateOpen] = useState(false);
  const [adminFor, setAdminFor] = useState<HospitalListItem | null>(null);
  const [toggleTarget, setToggleTarget] = useState<HospitalListItem | null>(null);
  const [subFor, setSubFor] = useState<HospitalListItem | null>(null);
  const pendingTotal = (data ?? []).reduce((n, h) => n + (h.pending_payments ?? 0), 0);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['hospitals'] });

  const createMut = useMutation({
    mutationFn: API.createHospital,
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast.success(t('common.done'));
    },
  });

  const adminMut = useMutation({
    mutationFn: (args: { hospitalId: string; input: HospitalAdminInput }) => API.addHospitalAdmin(args.hospitalId, args.input),
    onSuccess: () => {
      invalidate();
      setAdminFor(null);
      toast.success(t('common.done'));
    },
  });

  const toggleMut = useMutation({
    mutationFn: (h: HospitalListItem) => API.updateHospitalById(h.id, { isActive: !h.is_active }),
    onSuccess: () => {
      invalidate();
      setToggleTarget(null);
      toast.success(t('common.done'));
    },
  });

  const switchMut = useMutation({
    mutationFn: API.switchHospital,
    onSuccess: async () => {
      qc.clear(); // بيانات المستشفى السابق لا تظهر في المستشفى الجديد
      await refresh();
      navigate('/');
    },
  });

  return (
    <div>
      <PageHeader
        title={t('hospitals.title')}
        subtitle={t('hospitals.subtitle')}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            {t('hospitals.add')}
          </Button>
        }
      />

      {pendingTotal > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm font-bold text-warning-900 dark:border-warning-900/60 dark:bg-warning-900/20 dark:text-warning-100">
          <BellRing className="h-4 w-4" />
          {t('subscriptionAdmin.pendingBanner', { count: pendingTotal })}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent>
            <EmptyState title={t('errors.generic')} action={{ label: t('common.retry'), onClick: () => void refetch() }} />
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title={t('hospitals.empty')} icon={<HospitalIcon className="h-6 w-6" />} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((h) => {
            const isCurrent = h.id === user?.hospital_id;
            const isHome = h.id === (user?.home_hospital_id ?? user?.hospital_id);
            return (
              <Card key={h.id} className={isCurrent ? 'ring-2 ring-brand-500/60' : undefined}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold text-ink">{localName(h, 'name')}</p>
                      <p className="truncate text-sm text-ink/50">{currentLang() === 'ar' ? h.name_en : h.name_ar}</p>
                      <p className="mt-0.5 font-mono text-xs text-ink/40" dir="ltr">{h.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isCurrent && <Badge variant="brand">{t('hospitals.current')}</Badge>}
                      {isHome && <Badge variant="neutral">{t('hospitals.home')}</Badge>}
                      {!h.is_active && <Badge variant="danger">{t('hospitals.disabled')}</Badge>}
                      {h.subscription && h.subscription.status !== 'unlimited' && (
                        <Badge variant={h.subscription.status === 'expired' ? 'danger' : h.subscription.status === 'trial' ? 'warning' : 'success'}>
                          {t(`billing.status.${h.subscription.status}`)}
                          {h.subscription.ends_at ? ` · ${fmtDate(h.subscription.ends_at, { day: 'numeric', month: 'short' })}` : ''}
                        </Badge>
                      )}
                      {h.signup_source === 'self' && <Badge variant="info">{t('subscriptionAdmin.selfSignup')}</Badge>}
                      {(h.pending_payments ?? 0) > 0 && <Badge variant="warning">{t('subscriptionAdmin.pending', { count: h.pending_payments })}</Badge>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label={t('hospitals.users')} value={h.users_count} />
                    <Stat label={t('hospitals.beds')} value={h.beds_count} />
                    <Stat label={t('hospitals.activeAdmissions')} value={h.active_admissions} />
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-bold text-ink/45">{t('hospitals.admins')}</p>
                    {h.admins.length === 0 ? (
                      <p className="text-sm text-ink/45">{t('hospitals.noAdmins')}</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {h.admins.map((a) => (
                          <li key={a.id}>
                            <Badge variant={a.is_active ? 'neutral' : 'danger'}>
                              {a.full_name_ar} · <span dir="ltr">{a.username}</span>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-ink/8 pt-3 dark:border-white/10">
                    <Button size="sm" variant={(h.pending_payments ?? 0) > 0 ? 'primary' : 'outline'} icon={<CreditCard className="h-3.5 w-3.5" />} onClick={() => setSubFor(h)}>
                      {t('subscriptionAdmin.manage')}
                    </Button>
                    <Button size="sm" variant="outline" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setAdminFor(h)}>
                      {t('hospitals.addAdmin')}
                    </Button>
                    {!isCurrent && h.is_active && (
                      <Button size="sm" variant="secondary" icon={<LogIn className="h-3.5 w-3.5" />} loading={switchMut.isPending && switchMut.variables === h.id} onClick={() => switchMut.mutate(h.id)}>
                        {isHome ? t('hospitals.back') : t('hospitals.enter')}
                      </Button>
                    )}
                    {!isHome && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={h.is_active ? 'text-danger-600' : 'text-success-600'}
                        icon={h.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        onClick={() => (h.is_active ? setToggleTarget(h) : toggleMut.mutate(h))}
                      >
                        {h.is_active ? t('hospitals.disable') : t('hospitals.enable')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {createOpen && <CreateHospitalDialog onClose={() => setCreateOpen(false)} onSubmit={(i) => createMut.mutate(i)} busy={createMut.isPending} />}
      {adminFor && (
        <AddAdminDialog
          hospitalName={localName(adminFor, 'name')}
          onClose={() => setAdminFor(null)}
          onSubmit={(input) => adminMut.mutate({ hospitalId: adminFor.id, input })}
          busy={adminMut.isPending}
        />
      )}
      {subFor && <SubscriptionDialog hospital={subFor} onClose={() => setSubFor(null)} />}
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={`${t('hospitals.disable')} — ${localName(toggleTarget, 'name')}`}
        message={t('hospitals.disableConfirm')}
        confirmLabel={t('hospitals.disable')}
        busy={toggleMut.isPending}
        onConfirm={() => toggleTarget && toggleMut.mutate(toggleTarget)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-muted/70 px-2 py-2 dark:bg-white/5">
      <p className="text-lg font-extrabold tabular text-ink">{value}</p>
      <p className="text-[0.7rem] font-bold text-ink/45">{label}</p>
    </div>
  );
}

function CreateHospitalDialog({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (i: CreateHospitalInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const valid = nameAr.trim().length >= 2 && nameEn.trim().length >= 2;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('hospitals.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={busy} onClick={() => onSubmit({ nameAr: nameAr.trim(), nameEn: nameEn.trim(), code: code.trim() || undefined })}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('hospitals.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
        <Input label={t('hospitals.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
        <Input label={t('hospitals.code')} hint={t('hospitals.codeHint')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" />
      </div>
    </Dialog>
  );
}

function AddAdminDialog({ hospitalName, onClose, onSubmit, busy }: { hospitalName: string; onClose: () => void; onSubmit: (i: HospitalAdminInput) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ username: '', password: '', fullNameAr: '', fullNameEn: '', email: '' });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = /^[a-zA-Z0-9_.-]{3,64}$/.test(form.username) && form.password.length >= 8 && form.fullNameAr.trim().length >= 2;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('hospitals.addAdmin')} — ${hospitalName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!valid}
            loading={busy}
            onClick={() =>
              onSubmit({ username: form.username, password: form.password, fullNameAr: form.fullNameAr.trim(), fullNameEn: form.fullNameEn.trim() || undefined, email: form.email.trim() || null })
            }
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('hospitals.username')} value={form.username} onChange={(e) => set('username', e.target.value)} dir="ltr" autoComplete="off" autoFocus />
        <Input label={t('hospitals.password')} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} dir="ltr" autoComplete="new-password" />
        <Input label={t('hospitals.fullNameAr')} value={form.fullNameAr} onChange={(e) => set('fullNameAr', e.target.value)} />
        <Input label={t('hospitals.fullNameEn')} value={form.fullNameEn} onChange={(e) => set('fullNameEn', e.target.value)} dir="ltr" />
        <Input label={t('hospitals.email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} dir="ltr" />
      </div>
    </Dialog>
  );
}
