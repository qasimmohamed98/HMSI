import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { API, type AppNotification } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { currentLang } from '@/i18n';
import { cn } from '@/lib/utils';

/** جرس الإشعارات: يُحدَّث كل دقيقة، والقائمة تُحمَّل عند الفتح */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const count = useQuery({ queryKey: ['notifications', 'count'], queryFn: API.notificationCount, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const list = useQuery({ queryKey: ['notifications', 'list'], queryFn: API.listNotifications, enabled: open });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications'] });
  const read = useMutation({ mutationFn: API.readNotification, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: API.readAllNotifications, onSuccess: refresh });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = count.data?.unread ?? 0;
  const en = currentLang() === 'en';
  const openItem = (n: AppNotification) => {
    if (!n.is_read) read.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={t('notifications.title')} aria-expanded={open} title={t('notifications.title')}>
        <Bell className={cn('h-[1.15rem] w-[1.15rem]', count.data?.top === 'critical' && unread > 0 && 'text-danger-600')} />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[0.65rem] font-extrabold text-white tabular',
              count.data?.top === 'critical' ? 'bg-danger-600' : count.data?.top === 'warning' ? 'bg-warning-600' : 'bg-brand-600',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-ink/10 bg-surface-raised shadow-xl dark:border-white/10">
          <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3 dark:border-white/10">
            <p className="font-bold text-ink">{t('notifications.title')}</p>
            {unread > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.readAll')}
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.isLoading ? (
              <p className="p-6 text-center text-sm text-ink/50">{t('common.loading')}</p>
            ) : !list.data?.length ? (
              <p className="p-6 text-center text-sm text-ink/50">{t('notifications.empty')}</p>
            ) : (
              <ul>
                {list.data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn('flex w-full gap-3 border-b border-ink/5 px-4 py-3 text-start hover:bg-ink/[0.03] dark:border-white/5 dark:hover:bg-white/[0.04]', !n.is_read && 'bg-brand-50/50 dark:bg-brand-900/15')}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                          n.is_read ? 'bg-transparent' : n.severity === 'critical' ? 'bg-danger-600' : n.severity === 'warning' ? 'bg-warning-500' : 'bg-brand-500',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm text-ink', !n.is_read && 'font-bold', n.severity === 'critical' && 'text-danger-700 dark:text-danger-300')}>
                          {(en && n.title_en) || n.title_ar}
                        </span>
                        {(n.body_ar || n.body_en) && <span className="mt-0.5 block truncate text-xs text-ink/55">{(en && n.body_en) || n.body_ar}</span>}
                        <span className="mt-0.5 block text-[0.7rem] text-ink/40 tabular">{fmtDateTime(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
