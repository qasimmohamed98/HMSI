import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Logo } from './Logo';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { useMediaQuery } from '@/lib/use-media';

export function AppShell() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside
          className={cn(
            'sticky top-0 flex h-dvh shrink-0 flex-col border-e border-ink/8 bg-surface-raised transition-[width] duration-200 dark:border-white/10 dark:bg-surface-raised',
            collapsed ? 'w-[76px]' : 'w-[264px]',
          )}
        >
          <div className={cn('flex h-16 items-center border-b border-ink/8 px-4 dark:border-white/10', collapsed && 'justify-center px-2')}>
            <Logo compact={collapsed} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav />
          </div>
          <div className="border-t border-ink/8 p-3 dark:border-white/10">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <>
                  <PanelLeftOpen className="h-4 w-4" />
                  <span className="sr-only">Expand</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>طيّ القائمة</span>
                </>
              )}
            </Button>
          </div>
        </aside>
      )}

      {/* Drawer for tablet/mobile */}
      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 flex w-[290px] max-w-[85vw] flex-col bg-surface-raised shadow-float animate-slide-end dark:bg-surface-raised">
            <div className="flex h-16 items-center justify-between border-b border-ink/8 px-4 dark:border-white/10">
              <Logo />
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
        <main className={cn('flex-1', 'pb-20 lg:pb-6')}>
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">{<Outlet />}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}