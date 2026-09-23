import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className={headerClassName}>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-0.5 text-sm text-ink/55">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-ink/12 px-4 py-10 text-sm font-medium text-ink/45 dark:border-white/15 dark:text-white/40">
      {children}
    </div>
  );
}