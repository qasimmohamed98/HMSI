import { Menu, Moon, Sun, Languages, LogOut, ChevronDown, CircleHelp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Avatar } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { setLanguage, currentLang } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { localName } from '@/lib/format';
import { useOutboxSync } from '@/lib/offline-queue';
import { OutboxIndicator } from './OutboxIndicator';
import { NotificationBell } from './NotificationBell';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();
  const { resolved, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  useOutboxSync(user?.id);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const switchLang = () => {
    setLanguage(currentLang() === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="sticky top-0 z-30 print:hidden flex h-14 items-center gap-2 border-b border-ink/8 bg-surface/85 px-3 backdrop-blur-md sm:h-16 sm:px-5 dark:border-white/10 dark:bg-surface/85">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label={t('a11y.menu')}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex flex-1 items-center gap-2">
        <span className="hidden text-sm font-bold text-ink md:block">{t('nav.hospital')}</span>
        <span className="hidden text-ink/25 md:block">·</span>
        <span className="truncate text-sm text-ink/55">{localName(user, 'hospital_name')}</span>
        {user?.home_hospital_id && user.home_hospital_id !== user.hospital_id && (
          // المدير العام يعمل داخل مستشفى آخر
          <button
            type="button"
            onClick={() => navigate('/hospitals')}
            className="truncate rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-bold text-warning-800 hover:bg-warning-200 dark:bg-warning-900/40 dark:text-warning-200"
            title={t('hospitals.actingBanner', { name: localName(user, 'hospital_name') })}
          >
            {t('hospitals.back')}
          </button>
        )}
      </div>

      <OutboxIndicator />

      <Button variant="ghost" size="sm" onClick={switchLang} className="hidden xs:inline-flex sm:inline-flex">
        <Languages className="h-4 w-4" />
        <span className="font-bold">{currentLang() === 'ar' ? 'EN' : 'ع'}</span>
      </Button>

      <NotificationBell />

      <Button variant="ghost" size="icon" onClick={() => navigate('/guide')} aria-label={t('nav.guide')} title={t('nav.guide')}>
        <CircleHelp className="h-[1.15rem] w-[1.15rem]" />
      </Button>

      <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')}>
        {resolved === 'dark' ? <Sun className="h-[1.15rem] w-[1.15rem]" /> : <Moon className="h-[1.15rem] w-[1.15rem]" />}
      </Button>

      {user && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-muted dark:hover:bg-white/5"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={localName(user, 'full_name') || user.username} className="h-8 w-8 text-xs" />
            <span className="hidden max-w-[10rem] flex-col items-start leading-tight sm:flex">
              <span className="truncate text-sm font-bold text-ink">{localName(user, 'full_name') || user.username}</span>
              <span className="truncate text-[0.68rem] font-semibold text-ink/45">{t(`user.role.${user.role}`)}</span>
            </span>
            <ChevronDown className={cn('h-4 w-4 text-ink/40 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface-raised shadow-float animate-fade-up dark:border-white/10 dark:bg-surface-raised">
              <div className="border-b border-ink/8 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-bold text-ink">{localName(user, 'full_name') || user.username}</p>
                <p className="text-xs text-ink/50">{user.username}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink/75 hover:bg-surface-muted dark:hover:bg-white/5"
              >
                <SettingsIcon />
                {t('nav.settings')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void logout().then(() => navigate('/login'));
                }}
                className="flex w-full items-center gap-2 border-t border-ink/8 px-4 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-50 dark:border-white/10 dark:hover:bg-danger-900/30"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}