import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { chipKey } from '@/lib/format';

export function Avatar({ name, className, ...props }: { name: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
        className,
      )}
      aria-hidden
      {...props}
    >
      {chipKey(name)}
    </div>
  );
}