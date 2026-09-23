import { type ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: { label: string; onClick?: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-ink/40 dark:bg-white/10 dark:text-white/40">
        {icon ?? <FolderOpen className="h-7 w-7" />}
      </div>
      <h4 className="mt-1 text-base font-bold text-ink">{title}</h4>
      {description && <p className="max-w-sm text-sm text-ink/55">{description}</p>}
      {action && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ title, description, onRetry }: { title: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500 dark:bg-danger-900/30">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M12 8v5M12 16.5v.01" />
          <path d="M10.3 4.2 2.7 17.3a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h4 className="mt-1 text-base font-bold text-ink">{title}</h4>
      {description && <p className="max-w-sm text-sm text-ink/55">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}