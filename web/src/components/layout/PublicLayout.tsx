import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Languages, Mail, MessageCircle, Phone } from 'lucide-react';
import { DEVELOPER } from '@/lib/developer';
import { Logo } from './Logo';
import { useAuth } from '@/lib/auth';
import { currentLang, setLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

/** إطار الصفحات العامة (من نحن، عن النظام، الدليل): تُفتح للزوار وللمستخدمين المسجّلين */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const authed = status === 'authed';
  const links = [
    { to: '/guide', label: t('nav.guide') },
    { to: '/system', label: t('nav.aboutSystem') },
    { to: '/about', label: t('nav.about') },
  ];
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-ink/8 bg-surface/90 backdrop-blur-md print:hidden dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to={authed ? '/' : '/login'}>
            <Logo />
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto no-scrollbar sm:order-none sm:ms-6 sm:w-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn('shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold', isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-ink/60 hover:bg-surface-muted')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={() => setLanguage(currentLang() === 'ar' ? 'en' : 'ar')} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-ink/70 hover:bg-surface-muted">
              <Languages className="h-4 w-4" />
              {currentLang() === 'ar' ? 'EN' : 'ع'}
            </button>
            <Link to={authed ? '/' : '/login'} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700">
              {authed ? t('nav.backToSystem') : t('auth.signIn')}
              <ArrowRight className="h-4 w-4 rotate-180 ltr:rotate-0" />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-ink/8 py-6 text-center text-xs text-ink/50 print:hidden dark:border-white/10">
        <p>
          © 2026 Q VIREXA · {links.map((l, i) => (
            <span key={l.to}>
              {i > 0 && ' · '}
              <Link to={l.to} className="hover:underline">
                {l.label}
              </Link>
            </span>
          ))}
        </p>
        <p className="mt-3 font-bold tracking-wide text-ink/65" dir="ltr">
          DEVELOPED BY {DEVELOPER.nameEn.toUpperCase()}
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href={`mailto:${DEVELOPER.email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
            <Mail className="h-3.5 w-3.5" />
            <bdi dir="ltr">{DEVELOPER.email}</bdi>
          </a>
          <a href={`tel:${DEVELOPER.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
            <Phone className="h-3.5 w-3.5" />
            <bdi dir="ltr">{DEVELOPER.phoneDisplay}</bdi>
          </a>
          <a href={DEVELOPER.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-700">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </p>
      </footer>
    </div>
  );
}
