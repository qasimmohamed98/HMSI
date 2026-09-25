import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:8787';
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'favicon.svg', 'fonts/syncopate-700.woff2'],
        manifest: {
          name: 'Q VIREXA',
          short_name: 'Q VIREXA',
          description: 'Q VIREXA — منصة تشغيل رقمية للمنشآت الصحية',
          lang: 'ar',
          dir: 'rtl',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          theme_color: '#13204A',
          background_color: '#f6f8f7',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // طلبات الـ API لا تُخدم أبداً من الكاش (بيانات طبية حساسة ومتغيرة)
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // فتح رابط التنبيه عند الضغط على إشعار الجهاز (web/public/sw-notify.js)
          importScripts: ['/sw-notify.js'],
          /*
           * Background Sync لإدخالات التمريض فقط (علامات حيوية، سوائل، جرعات): إن فشل الإرسال لانقطاع الشبكة
           * يحفظه الـ Service Worker ويعيد إرساله عند عودة الاتصال حتى لو أُغلقت الصفحة (متصفحات Chromium).
           * كل طلب يحمل client_id، فالإرسال المزدوج (من هنا ومن طابور الواجهة offline-queue.ts) لا يكرر السجل.
           * لا شيء من الـ API يُخزَّن مؤقتاً (NetworkOnly).
           */
          runtimeCaching: [
            {
              urlPattern: /\/api\/(vitals|patients\/[^/]+\/(fluids|medications\/[^/]+\/administrations))$/,
              method: 'POST',
              handler: 'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'hmsi-nursing-entries',
                  // بالدقائق — نفس نافذة الخادم (48 ساعة)
                  options: { maxRetentionTime: 48 * 60 },
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    // معاينة البناء محلياً (لاختبار سياسة CSP على ملفات الإنتاج)
    preview: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});