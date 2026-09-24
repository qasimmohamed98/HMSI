import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/tokens.css';
import '@/i18n';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider, notifyError } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { router } from '@/app/router';

const queryClient = new QueryClient({
  // أي عملية كتابة تفشل بدون معالج خاص تُظهر رسالة الخادم للمستخدم بدل الفشل الصامت
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      notifyError(error instanceof Error && error.message ? error.message : 'حدث خطأ');
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
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);