import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Logo } from './Logo';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { useMediaQuery } from '@/lib/use-media';
import { useAuth } from '@/lib/auth';
import { QLockup, QMark } from '@/components/brand/QBrand';
import { DEVELOPER } from '@/lib/developer';
import { ProductsLink } from '@/features/products/OurProducts';
import { localName } from '@/lib/format';
import { ForcePasswordChange } from '@/features/security/ForcePasswordChange';
import { IdleLogout } from '@/features/security/IdleLogout';
import { AlertCenter } from '@/features/alerts/AlertCenter';
import { DeviceSetupBanner } from '@/features/alerts/DeviceSetupBanner';
import { TermsGate } from '@/features/legal/TermsGate';

export function AppShell() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem('hmsi.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const setCollapsed = (fn: (c: boolean) => boolean) =>
    setCollapsedState((c) => {
      const next = fn(c);
      try {
        localStorage.setItem('hmsi.sidebar', next ? 'collapsed' : 'open');
      } catch {
        /* التخزين غير متاح */
      }
      return next;
    });
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const CollapseIcon = collapsed ? (rtl ? PanelRightOpen : PanelLeftOpen) : rtl ? PanelRightClose : PanelLeftClose;
  const { user } = useAuth();
  const location = useLocation();
  // انتهى الاشتراك: صفحة الدفع فقط (المدير العام غير مقيّد)
  const expired = user?.role !== 'super_admin' && user?.subscription?.status === 'expired';
  // كلمة مرور مؤقتة أو ضعيفة: لا شيء قبل تغييرها
  if (user?.must_change_password)
    return (
      <>
        <IdleLogout />
        <ForcePasswordChange />
      </>
    );
  // الموافقة على شروط الاستخدام وسياسة الخصوصية قبل أي عمل
  if (user?.terms_required)
    return (
      <>
        <IdleLogout />
        <TermsGate />
      </>
    );

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside
          className={cn(
            'sticky top-0 flex h-dvh shrink-0 flex-col print:hidden border-e border-ink/8 bg-surface-raised transition-[width] duration-200 dark:border-white/10 dark:bg-surface-raised',
            collapsed ? 'w-[72px]' : 'w-[264px]',
          )}
        >
          <div className={cn('flex h-16 items-center border-b border-ink/8 px-4 dark:border-white/10', collapsed && 'justify-center px-2')}>
            <Logo compact={collapsed} src={user?.hospital_logo_url} title={localName(user, 'hospital_name')} subtitle={t('nav.hospital')} />
          </div>
          <div className={cn('flex-1 overflow-y-auto overflow-x-hidden py-4', collapsed ? 'px-2' : 'px-3')}>
            <SidebarNav collapsed={collapsed} />
          </div>
          {/* هوية النظام: Q VIREXA والمطوّر، وزر طيّ القائمة كأيقونة */}
          <div className={cn('flex items-center gap-2 border-t border-ink/8 dark:border-white/10', collapsed ? 'flex-col px-2 py-3' : 'px-3 py-3')}>
            <a
              href={`mailto:${DEVELOPER.email}`}
              className={cn('min-w-0 flex-1 rounded-lg p-1 hover:bg-surface-muted dark:hover:bg-white/5', collapsed && 'flex justify-center')}
              title={`Q VIREXA · DEVELOPED BY ${DEVELOPER.nameEn.toUpperCase()} · ${DEVELOPER.email}`}
            >
              {collapsed ? (
                <QMark className="h-7 w-7" />
              ) : (
                <span className="block">
                  <QLockup className="h-6" />
                  <span dir="ltr" className="mt-1 block text-start text-[0.55rem] font-bold tracking-wide text-ink/35">
                    DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}
                  </span>
                </span>
              )}
            </a>
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? t('a11y.expand') : t('a11y.collapse')} title={collapsed ? t('a11y.expand') : t('a11y.collapse')}>
              <CollapseIcon className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      )}

      {/* Drawer for tablet/mobile */}
      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <button
            type="button"
            aria-label={t('a11y.closeMenu')}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 flex w-[290px] max-w-[85vw] flex-col bg-surface-raised shadow-float animate-slide-end dark:bg-surface-raised">
            <div className="flex h-16 items-center justify-between border-b border-ink/8 px-4 dark:border-white/10">
              <Logo src={user?.hospital_logo_url} title={localName(user, 'hospital_name')} subtitle={t('nav.hospital')} />
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label={t('a11y.close')}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="border-t border-ink/8 px-4 py-3 dark:border-white/10">
              <QLockup className="h-6" />
              <span dir="ltr" className="mt-1 block text-start text-[0.55rem] font-bold tracking-wide text-ink/35">DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}</span>
              <ProductsLink source="sidebar" className="mt-1 text-[0.7rem] text-brand-700 dark:text-brand-300" />
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
            <MfaHint />
            <DeviceSetupBanner />
            {expired && location.pathname !== '/billing' ? <Navigate to="/billing" replace /> : <Outlet />}
          </div>
        </main>
      </div>

      <BottomNav />
      <IdleLogout />
      <AlertCenter />
    </div>
  );
}

/** تنبيه الفترة التجريبية أو قرب انتهاء الاشتراك (7 أيام) */
/** توصية للمدراء بتفعيل التحقق بخطوتين (يمكن إخفاؤها 30 يوماً) */
function MfaHint() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const key = `hmsi.mfaHint.${user?.id ?? ''}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() < Number(localStorage.getItem(key) ?? 0);
    } catch {
      return false;
    }
  });
  if (!user || hidden || user.totp_enabled || (user.role !== 'admin' && user.role !== 'super_admin')) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(key, String(Date.now() + 30 * 86_400_000));
    } catch {
      /* */
    }
    setHidden(true);
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-info-300 bg-info-50 px-4 py-2.5 text-sm text-info-900 print:hidden dark:border-info-900/60 dark:bg-info-900/20 dark:text-info-100">
      <span className="font-semibold">{t('twofa.banner')}</span>
      <Link to="/settings#security" className="ms-auto rounded-lg bg-info-600 px-3 py-1 text-xs font-bold text-white hover:bg-info-700">
        {t('twofa.enable')}
      </Link>
      <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1 text-xs font-semibold text-info-800/70 hover:bg-info-100 dark:text-info-200/70 dark:hover:bg-info-900/40">
        {t('twofa.later')}
      </button>
    </div>
  );
}

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
