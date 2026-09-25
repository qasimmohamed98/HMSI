/*
 * النظام انتقل إلى https://virexa.qproductshub.tech
 * هذا الـ Service Worker يحلّ محل القديم لدى من فتح الموقع سابقاً:
 * يمسح النسخ المحفوظة، يلغي تسجيل نفسه، وينقل الصفحات المفتوحة إلى العنوان الجديد.
 */
const TARGET = 'https://virexa.qproductshub.tech';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        const u = new URL(w.url);
        w.navigate(TARGET + u.pathname + u.search).catch(() => undefined);
      }
    })(),
  );
});
