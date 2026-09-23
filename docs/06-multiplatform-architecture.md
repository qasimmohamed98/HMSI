# 6. Multi-Platform Architecture

## النموذج
```
                    Shared Core (web/src + packages/shared)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
       WEB           WINDOWS         ANDROID
        │               │               │
     Browser          Tauri          PWA/Capacitor
```

جميع المنصات تشترك في: نفس الـ Backend، المصادقة، الـ API، قاعدة البيانات، منطق الأعمال، الصلاحيات.

## Web
- SPA على **Vercel** (HTTPS تلقائي + Custom Domain لاحقاً).
- نفس البنية Responsive بالكامل.

## Windows Desktop (Tauri — الاختيار الأول)
**لماذا Tauri بدل Electron؟**
| المعيار | Tauri | Electron |
|---|---|---|
| Performance | أعلى (WebView نظامي + Rust Core) | أقل (Chromium كامل) |
| Security | أصغر، Rust يعزز الطرفيات | أكبر |
| RAM Usage | أقل بكثير | مرتفع |
| Build Size | ~10MB مقابل ~100MB+ | كبير |
| Maintenance | تحديثات الواجهة نفسها | حمل أكبر |

- **المبدأ**: لا يُبنى النظام من الصفر — `tauri/` يغلف نفس بناء `web` عبر `beforeBuildCommand` ثم `distDir`.
- يستخدم نفس الحساب/API/Database. لا قاعدة بيانات منفصلة.
- الناتج: `Hospital Management System Setup.exe`.
- التحديثات عبر آليات Tauri Updater لاحقاً.

## Android
- **مرحلة أولى: PWA** — Installable (manifest + icons + Service Worker)، Add to Home Screen، تجربة App-like، وصول للكاميرا/الملف حيث يسمح المتصفح.
- **مستقبلاً: Capacitor** لتغليف PWA↑ كتطبيق Android حقيقي مع إعادة استخدام كود React قدر الإمكان.
- **ممنوع**: Flutter / Dart.

## الاشتراطات العمومية
- التكيف: `window.__TAURI__` / `navigator.standalone` تُكشف بيئة التشغيل لتغيير تفاصيل طفيفة فقط.
- نسخة وحيدة من أصول الواجهة؛ المنصات مجرد "حاملات" (Hosts).