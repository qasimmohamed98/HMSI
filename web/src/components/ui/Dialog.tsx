import { useTranslation } from 'react-i18next';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', closable = true }: DialogProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closable, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t('a11y.backdrop')}
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
        onClick={() => closable && onClose()}
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-raised shadow-pop animate-fade-up sm:rounded-2xl',
          widths[size],
        )}
      >
        {(title || closable) && (
          <div className="flex items-start justify-between gap-4 border-b border-ink/8 px-5 py-4 dark:border-white/10">
            <div>
              {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-ink/55">{description}</p>}
            </div>
            {closable && (
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('a11y.close')}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink/8 px-5 py-3 dark:border-white/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}