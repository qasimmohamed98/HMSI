import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo<ToastCtx>(
    () => ({
      toast: push,
      success: (m) => push('success', m),
      error: (m) => push('error', m),
    }),
    [push],
  );

  const icons: Record<ToastKind, ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-success-500" />,
    error: <XCircle className="h-5 w-5 text-danger-500" />,
    info: <Info className="h-5 w-5 text-info-500" />,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-surface-raised px-4 py-3 shadow-float animate-fade-up dark:bg-surface-raised',
              t.kind === 'success' && 'border-success-200 dark:border-success-900/60',
              t.kind === 'error' && 'border-danger-200 dark:border-danger-900/60',
              t.kind === 'info' && 'border-info-200 dark:border-info-900/60',
            )}
          >
            {icons[t.kind]}
            <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="text-ink/40 hover:text-ink" aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}