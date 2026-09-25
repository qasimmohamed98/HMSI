import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from './nav';
import { useAuth } from '@/lib/auth';
import { ROLE_PERMISSIONS } from '@hmsi/shared';

export function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perms = user ? ROLE_PERMISSIONS[user.role] : [];
  // اشتراك منتهٍ: لا يظهر إلا «الاشتراك والدفع» (بقية الصفحات محجوبة)
  const expired = user?.role !== 'super_admin' && user?.subscription?.status === 'expired';

  return (
    <nav className="flex flex-col gap-1">
      {NAV_GROUPS.map((group, gi) => {
        const visible = expired
          ? group.items.filter((item) => item.to === '/billing')
          : group.items.filter((item) => !item.permission || perms.includes(item.permission as never));
        if (visible.length === 0) return null;
        return (
          <div key={gi} className="flex flex-col gap-1">
            {group.group &&
              (collapsed ? (
                <hr className="mx-3 my-2 border-ink/8 dark:border-white/10" />
              ) : (
                <p className="px-3 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-wider text-ink/40 dark:text-white/35">
                  {t(`nav.${group.group}`)}
                </p>
              ))}
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                title={collapsed ? t(`nav.${item.key}`) : undefined}
                aria-label={collapsed ? t(`nav.${item.key}`) : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'text-ink/65 hover:bg-surface-muted hover:text-ink dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
                  )
                }
              >
                <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden />
                {!collapsed && <span className="flex-1">{t(`nav.${item.key}`)}</span>}
                {!collapsed && item.soon && (
                  <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-warning-800 dark:bg-warning-900/50 dark:text-warning-300">
                    {t('nav.soon')}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}