import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './ConfirmDialog';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

/** نافذة تأكيد موحّدة تُستدعى بـ await confirm('...') — تمنع الحذف بنقرة واحدة في السجل الطبي */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(typeof o === 'string' ? { message: o } : o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(opts)}
        onClose={() => close(false)}
        title={opts?.title ?? t('ui.confirmTitle')}
        message={opts?.message ?? ''}
        confirmLabel={opts?.confirmLabel ?? t('common.delete')}
        onConfirm={() => close(true)}
      />
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
