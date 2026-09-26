import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, LogOut, Monitor, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, useToast } from '@/components/ui';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';

const isPhone = (device: string) => /android|iphone|ipad/i.test(device);

/** الأجهزة المسجَّل دخولها، والمتذكَّرة للتحقق بخطوتين، وآخر عمليات الدخول */
export function DevicesCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['my-sessions'], queryFn: API.listMySessions });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['my-sessions'] });
    void qc.invalidateQueries({ queryKey: ['2fa-status'] });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));

  const revoke = useMutation({
    mutationFn: (a: { id: string; current: boolean }) => API.revokeSession(a.id).then(() => a),
    onSuccess: (a) => {
      if (a.current) void logout();
      else {
        refresh();
        toast.success(t('devices.signedOut'));
      }
    },
    onError,
  });
  const revokeOthers = useMutation({
    mutationFn: API.revokeOtherSessions,
    onSuccess: (r) => {
      refresh();
      toast.success(t('devices.othersSignedOut', { count: r.revoked }));
    },
    onError,
  });
  const forget = useMutation({ mutationFn: API.forgetTrustedDevice, onSuccess: refresh, onError });

  const others = (data?.sessions ?? []).filter((s) => !s.current).length;

  return (
    <Card id="sessions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-brand-600" />
          {t('devices.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {/* الجلسات المفتوحة */}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-ink">{t('devices.active')}</h3>
                {others > 0 && (
                  <Button size="sm" variant="outline" icon={<LogOut className="h-4 w-4" />} loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
                    {t('devices.signOutOthers')}
                  </Button>
                )}
              </div>
              <p className="mb-2 text-xs text-ink/50">{t('devices.activeHint')}</p>
              <ul className="divide-y divide-ink/8 rounded-xl border border-ink/10 dark:divide-white/10 dark:border-white/10">
                {data.sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {isPhone(s.device) ? <Smartphone className="h-5 w-5 text-ink/45" /> : <Monitor className="h-5 w-5 text-ink/45" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        <bdi dir="ltr">{s.device}</bdi>
                        {s.current && <Badge variant="success">{t('devices.thisDevice')}</Badge>}
                      </span>
                      <span className="block text-xs text-ink/50">
                        {t('devices.lastActive')}: {fmtDateTime(s.last_seen_at ?? s.created_at)}
                        {s.ip && (
                          <>
                            {' · '}
                            <bdi dir="ltr">{s.ip}</bdi>
                          </>
                        )}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" className="text-danger-600" loading={revoke.isPending && revoke.variables?.id === s.id} onClick={() => revoke.mutate({ id: s.id, current: s.current })}>
                      {s.current ? t('devices.signOutHere') : t('devices.signOut')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>

            {/* الأجهزة المتذكَّرة للتحقق بخطوتين */}
            {data.trusted.length > 0 && (
              <section>
                <h3 className="mb-1 flex items-center gap-2 font-bold text-ink">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  {t('devices.trusted')}
                </h3>
                <p className="mb-2 text-xs text-ink/50">{t('devices.trustedHint')}</p>
                <ul className="divide-y divide-ink/8 rounded-xl border border-ink/10 dark:divide-white/10 dark:border-white/10">
                  {data.trusted.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <bdi dir="ltr" className="font-semibold text-ink">
                          {d.device}
                        </bdi>
                        <span className="block text-xs text-ink/50">
                          {t('devices.lastUsed')}: {fmtDateTime(d.last_used_at ?? d.created_at)} · {t('devices.expires')}: {fmtDateTime(d.expires_at)}
                        </span>
                      </span>
                      <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => forget.mutate(d.id)}>
                        {t('devices.forget')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* آخر عمليات الدخول */}
            <section>
              <h3 className="mb-1 font-bold text-ink">{t('devices.history')}</h3>
              <p className="mb-2 text-xs text-ink/50">{t('devices.historyHint')}</p>
              <ul className="space-y-1.5">
                {data.history.map((h, i) => {
                  const bad = h.action === 'login_failed' || h.action === 'mfa_failed';
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      {bad ? <XCircle className="h-4 w-4 text-danger-500" /> : <CheckCircle2 className="h-4 w-4 text-success-600" />}
                      <span className={bad ? 'font-semibold text-danger-700 dark:text-danger-300' : 'text-ink/80'}>{t(`devices.actions.${h.action}`, { defaultValue: h.action })}</span>
                      {h.via === 'trusted_device' && <Badge variant="outline">{t('devices.viaTrusted')}</Badge>}
                      <span className="text-xs text-ink/50">
                        {fmtDateTime(h.at)}
                        {h.device && (
                          <>
                            {' · '}
                            <bdi dir="ltr">{h.device}</bdi>
                          </>
                        )}
                        {h.ip && (
                          <>
                            {' · '}
                            <bdi dir="ltr">{h.ip}</bdi>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
