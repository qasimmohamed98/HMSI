import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Building2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const ITEMS = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard },
  { to: '/patients', key: 'patients', icon: Users },
  { to: '/wards', key: 'wards', icon: Building2 },
  { to: '/settings', key: 'settings', icon: Settings },
];

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  if (user?.role !== 'super_admin' && user?.subscription?.status === 'expired') return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 print:hidden border-t border-ink/10 bg-surface-raised/95 backdrop-blur-md dark:border-white/10 dark:bg-surface-raised/95 sm:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[0.65rem] font-bold"
            >
              <span
                className={cn(
                  'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                  active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200' : 'text-ink/45 dark:text-white/50',
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span className={cn(active ? 'text-brand-700 dark:text-brand-200' : 'text-ink/45 dark:text-white/50')}>
                {t(`nav.${item.key}`)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}