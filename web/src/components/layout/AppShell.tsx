import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Logo } from './Logo';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { useMediaQuery } from '@/lib/use-media';
import { useAuth } from '@/lib/auth';
import { DEVELOPER } from '@/lib/developer';
import { localName } from '@/lib/format';

export function AppShell() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  // انتهى الاشتراك: صفحة الدفع فقط (المدير العام غير مقيّد)
  const expired = user?.role !== 'super_admin' && user?.subscription?.status === 'expired';

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside
          className={cn(
            'sticky top-0 flex h-dvh shrink-0 flex-col print:hidden border-e border-ink/8 bg-surface-raised transition-[width] duration-200 dark:border-white/10 dark:bg-surface-raised',
            collapsed ? 'w-[76px]' : 'w-[264px]',
          )}
        >
          <div className={cn('flex h-16 items-center border-b border-ink/8 px-4 dark:border-white/10', collapsed && 'justify-center px-2')}>
            <Logo compact={collapsed} src={user?.hospital_logo_url} title={localName(user, 'hospital_name')} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav />
          </div>
          {!collapsed && (
            <a href={`mailto:${DEVELOPER.email}`} className="block px-4 pb-2 text-center text-[0.62rem] font-bold tracking-wide text-ink/35 hover:text-brand-700" dir="ltr" title={`${DEVELOPER.email} · ${DEVELOPER.phoneDisplay}`}>
              DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}
            </a>
          )}
          <div className="border-t border-ink/8 p-3 dark:border-white/10">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? t('ui.expand') : t('ui.collapse')}
            >
              {collapsed ? (
                <>
                  <PanelLeftOpen className="h-4 w-4" />
                  <span className="sr-only">{t('ui.expand')}</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>{t('ui.collapse')}</span>
                </>
              )}
            </Button>
          </div>
        </aside>
      )}

      {/* Drawer for tablet/mobile */}
      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 flex w-[290px] max-w-[85vw] flex-col bg-surface-raised shadow-float animate-slide-end dark:bg-surface-raised">
            <div className="flex h-16 items-center justify-between border-b border-ink/8 px-4 dark:border-white/10">
              <Logo src={user?.hospital_logo_url} title={localName(user, 'hospital_name')} />
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label="إغلاق">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        <main className={cn('flex-1', 'pb-20 lg:pb-6 print:p-0')}>
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
            <TrialBanner />
            {expired && location.pathname !== '/billing' ? <Navigate to="/billing" replace /> : <Outlet />}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

/** تنبيه الفترة التجريبية أو قرب انتهاء الاشتراك (7 أيام) */
function TrialBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const sub = user?.subscription;
  if (!sub || user?.role === 'super_admin') return null;
  const show = sub.status === 'trial' || (sub.status === 'active' && (sub.days_left ?? 99) <= 7);
  if (!show) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning-300 bg-warning-50 px-4 py-2.5 text-sm text-warning-900 print:hidden dark:border-warning-900/60 dark:bg-warning-900/20 dark:text-warning-100">
      <span className="font-bold">{sub.status === 'trial' ? t('billing.trialBanner', { count: sub.days_left ?? 0 }) : t('billing.renewBanner', { count: sub.days_left ?? 0 })}</span>
      <Link to="/billing" className="ms-auto rounded-lg bg-warning-600 px-3 py-1 text-xs font-bold text-white hover:bg-warning-700">
        {t('billing.payNow')}
      </Link>
    </div>
  );
}
