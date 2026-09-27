import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/tokens.css';
import i18n from '@/i18n';
import { localizeServerMessage } from '@/i18n/server-messages';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider, ConfirmProvider, notifyError } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { router } from '@/app/router';
import { installErrorReporter } from '@/lib/error-reporter';
import { captureInstallPrompt } from '@/lib/push-client';

installErrorReporter();
// زر «تثبيت التطبيق»: المتصفح يرسل الحدث مبكراً فنلتقطه قبل رسم الواجهة
captureInstallPrompt();

// عند نشر نسخة جديدة: الـ Service Worker يفعّلها فوراً (skipWaiting + clientsClaim)، فتُعاد الصفحة تلقائياً مرة واحدة
// حتى لا يبقى المستخدم على نسخة قديمة إلى أن يغلق التبويب بنفسه (يهم خصوصاً من يبقي النظام مفتوحاً طوال يومه)
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

const queryClient = new QueryClient({
  // أي عملية كتابة تفشل بدون معالج خاص تُظهر رسالة الخادم للمستخدم بدل الفشل الصامت
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      notifyError(error instanceof Error && error.message ? localizeServerMessage(error.message) : i18n.t('errors.generic'));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
            </ConfirmProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);