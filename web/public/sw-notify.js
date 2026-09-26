/*
 * إضافة لـ Service Worker (تُحمَّل عبر workbox.importScripts):
 * - push: إشعار من الخادم يصل والنظام مغلق (Web Push) — يُعرض على الجهاز.
 * - notificationclick: الضغط على الإشعار يفتح نافذة النظام (أو يركّز عليها) وينتقل إلى رابط التنبيه.
 */
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { title: event.data ? event.data.text() : '' };
  }
  const title = d.title || 'Q VIREXA';
  const critical = d.severity === 'critical';
  const options = {
    body: d.body || '',
    // نفس معرّف تنبيه الواجهة: إن كان النظام مفتوحاً وأظهر التنبيه نفسه، يحل أحدهما محل الآخر ولا يتكرر
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    lang: d.lang || 'ar',
    dir: d.lang === 'en' ? 'ltr' : 'rtl',
    requireInteraction: critical,
    vibrate: critical ? [300, 120, 300, 120, 600] : d.severity === 'warning' ? [200, 100, 200] : [120],
    timestamp: Date.now(),
    data: { link: d.link || '/' },
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // النظام ظاهر أمام المستخدم الآن: التنبيه داخل الصفحة (صوت + بطاقة) يكفي، ونطلب منها التحديث فوراً
      const visible = wins.filter((w) => w.visibilityState === 'visible' && new URL(w.url).origin === self.location.origin);
      if (visible.length && !critical) {
        visible.forEach((w) => w.postMessage({ type: 'hmsi-push', payload: d }));
        return undefined;
      }
      return self.registration.showNotification(title, options);
    }),
  );
});

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
