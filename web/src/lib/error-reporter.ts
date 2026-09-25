import { API } from './api';

/**
 * يرسل أخطاء الواجهة غير المعالجة إلى سجل الأخطاء (صفحة صحة النظام).
 * حد أقصى 5 تقارير لكل تحميل صفحة، بلا تكرار لنفس الرسالة، وبصمت تام عند الفشل.
 */
const sent = new Set<string>();
let budget = 5;

export function reportError(err: unknown, extra?: string): void {
  if (budget <= 0) return;
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  const message = `${e.name}: ${e.message}`.slice(0, 500);
  // أخطاء الشبكة والجلسة معروفة وتُعرض للمستخدم أصلاً
  if (/HttpError|Failed to fetch|NetworkError|Load failed|ResizeObserver/i.test(message) || 'status' in e) return;
  if (sent.has(message)) return;
  sent.add(message);
  budget--;
  const detail = [extra, (e.stack ?? '').split('\n').slice(1, 8).join('\n')].filter(Boolean).join('\n').slice(0, 4000);
  void API.reportClientError({ message, detail: detail || null, path: location.pathname }).catch(() => undefined);
}

export function installErrorReporter(): void {
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
