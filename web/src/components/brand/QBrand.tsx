import { useEffect, useState } from 'react';
import { BRAND, measureWordWidth, qLockupSvg, qMarkSvg, WORDMARK } from './q-geometry';
import { cn } from '@/lib/utils';

/**
 * رموز الهوية للواجهة. الألوان من متغيرات CSS:
 *   --q-a (المعمل) و --q-b (المنتج) — مضبوطة في tokens.css للثيمين، وتُقلب داخل .q-on-dark.
 */

/** رمز Q وحده */
export function QMark({ className, small, title }: { className?: string; small?: boolean; title?: string }) {
  return <span className={cn('inline-flex [&>svg]:h-full [&>svg]:w-full', className)} dangerouslySetInnerHTML={{ __html: qMarkSvg({ small, title }) }} />;
}

/** الشعار الكامل: Q + اسم المنتج على خط الإنتاج */
export function QLockup({ name = BRAND.product, className }: { name?: string; className?: string }) {
  const width = useWordWidth(name);
  return <span dir="ltr" className={cn('inline-flex [&>svg]:h-full [&>svg]:w-auto', className)} dangerouslySetInnerHTML={{ __html: qLockupSvg(name, { wordWidth: width }) }} />;
}

/** يعيد قياس عرض الاسم بعد تحميل خط الشعار حتى يطابق خط الإنتاج طول الاسم تماماً */
function useWordWidth(name: string): number {
  const [w, setW] = useState(() => measureWordWidth(name));
  useEffect(() => {
    let alive = true;
    setW(measureWordWidth(name));
    document.fonts?.load(`${WORDMARK.weight} ${WORDMARK.size}px ${WORDMARK.family}`).then(() => alive && setW(measureWordWidth(name)), () => undefined);
    return () => {
      alive = false;
    };
  }, [name]);
  return w;
}
