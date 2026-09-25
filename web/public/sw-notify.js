/*
 * إضافة لـ Service Worker (تُحمَّل عبر workbox.importScripts):
 * الضغط على إشعار الجهاز يفتح نافذة النظام (أو يركّز عليها) وينتقل إلى رابط التنبيه.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          return w.focus().then(() => (w.navigate ? w.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
