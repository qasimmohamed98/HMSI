import { QLockup, QMark } from '@/components/brand/QBrand';
import { cn } from '@/lib/utils';

/**
 * شعار الواجهة:
 * - بلا عنوان (الصفحات العامة وصفحة الدخول): الشعار الكامل Q VIREXA.
 * - مع عنوان (داخل النظام): اسم المستشفى بجانب شعاره إن وُجد وإلا رمز Q، وتحته «Q VIREXA».
 * - compact: الرمز وحده.
 * light: على خلفية داكنة (يقلب ألوان الرمز والنص).
 */
export function Logo({ compact = false, light = false, src, title }: { compact?: boolean; light?: boolean; src?: string | null; title?: string }) {
  const icon = src ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-ink/10">
      <img src={src} alt="" className="h-full w-full object-contain" />
    </span>
  ) : (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1.5', light ? 'q-on-dark bg-white/10' : 'bg-[var(--q-ink)] q-on-dark')}>
      <QMark className="h-full w-full" />
    </span>
  );

  if (compact) return <div className={cn('flex items-center', light && 'q-on-dark')}>{icon}</div>;

  if (!title) {
    return (
      <div className={cn('flex items-center', light ? 'q-on-dark' : '')}>
        <QLockup className="h-8" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="min-w-0 leading-tight">
        <span className={cn('block truncate text-sm font-extrabold', light ? 'text-white' : 'text-ink')}>{title}</span>
        <span dir="ltr" className={cn('block truncate text-start font-[Syncopate] text-[0.55rem] font-bold tracking-[0.12em]', light ? 'text-white/60' : 'text-ink/45')}>
          Q VIREXA
        </span>
      </span>
    </div>
  );
}
