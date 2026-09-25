import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import { reportError } from '@/lib/error-reporter';

/** خطأ غير متوقع أثناء عرض صفحة: رسالة واضحة + إبلاغ سجل الأخطاء بدل شاشة المطوّر */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  useEffect(() => reportError(error, 'route'), [error]);
  // ملف بناء قديم بعد نشر إصدار جديد: إعادة التحميل تكفي
  const stale = error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-200">
          <TriangleAlert className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-extrabold text-ink">{t(stale ? 'ui.crashUpdated' : 'ui.crashTitle')}</h1>
        <p className="text-sm text-ink/60">{t(stale ? 'ui.crashUpdatedBody' : 'ui.crashBody')}</p>
        <Button icon={<RefreshCw className="h-4 w-4" />} onClick={() => location.reload()}>
          {t('ui.crashReload')}
        </Button>
      </div>
    </div>
  );
}
