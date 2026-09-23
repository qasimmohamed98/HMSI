import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from './nav';
import { useAuth } from '@/lib/auth';
import { ROLE_PERMISSIONS } from '@hmsi/shared';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perms = user ? ROLE_PERMISSIONS[user.role] : [];

  return (
    <nav className="flex flex-col gap-1">
      {NAV_GROUPS.map((group, gi) => {
        const visible = group.items.filter((item) => !item.permission || perms.includes(item.permission as never));
        if (visible.length === 0) return null;
        return (
          <div key={gi} className="flex flex-col gap-1">
            {group.group && (
              <p className="px-3 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-wider text-ink/40 dark:text-white/35">
                {t(`nav.${group.group}`)}
              </p>
            )}
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'text-ink/65 hover:bg-surface-muted hover:text-ink dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
                  )
                }
              >
                <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden />
                <span className="flex-1">{t(`nav.${item.key}`)}</span>
                {item.soon && (
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