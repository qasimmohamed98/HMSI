import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const styles: Record<AlertVariant, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: 'border-info-200 bg-info-50 text-info-900 dark:border-info-900/50 dark:bg-info-950/40 dark:text-info-200',
    icon: <Info className="h-5 w-5 shrink-0" />,
  },
  success: {
    wrap: 'border-success-200 bg-success-50 text-success-900 dark:border-success-900/50 dark:bg-success-950/40 dark:text-success-200',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0" />,
  },
  warning: {
    wrap: 'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-200',
    icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
  },
  danger: {
    wrap: 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-900/50 dark:bg-danger-950/40 dark:text-danger-200',
    icon: <XCircle className="h-5 w-5 shrink-0" />,
  },
};

export function Alert({ variant = 'info', title, children, className }: { variant?: AlertVariant; title?: string; children?: ReactNode; className?: string }) {
  const s = styles[variant];
  return (
    <div role={variant === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', s.wrap, className)}>
      {s.icon}
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5') + ' opacity-90'}>{children}</div>}
      </div>
    </div>
  );
}