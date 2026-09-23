# 9. Deployment Architecture

## Web (Production)
- Hosting: **Vercel** (رهن HTTPS تلقائي؛ Custom Domain جاهز عبر إعداد Vercel).
- **Monorepo Detector**: root `vercel.json` يوجه `web` كـ hotel Frontend، و `api` كـ Serverless Functions (مسار `api/*` تلقائي).
- Build: `npm run build -w web` → ثابت من `web/dist`.
- Serverless: نقاط Hono تُصدَّر دالات (handler لكل route).
- المرحلة التجريبية: Seed تُشغّل مرة واحدة عبر script أو Serverless function محمية.

## Environment Variables (Vercel Dashboard — ليست في GitHub)
```
TURSO_URL=
TURSO_AUTH_TOKEN=
SESSION_SECRET=          (اختياري لتوقيع إضافي)
VITE_API_MODE=http       (استخدام في dev عبر proxy)
ALLOWED_ORIGINS=         (Cross-origin صائم للنسخة المخصصة)
```

## Windows (Tauri)
- `tauri/` يصدّر بناء كهيئة:
  - `Hospital Management System Setup.exe` (NSIS) للمستخدم النهائي.
  - `Hospital Management System.exe` (portable).
- مسار التحديثات: Tauri Updater (signed artifacts لاحقاً) مع نفس Backend.

## Android (PWA)
- `web` service worker + manifest → يُثبَّت من المتصفح مباشرة.
- مستقبلاً: Capacitor `npx cap sync android` + توقيع APK/AAB على Google Play.

## الأمان في الإنتاج
- Security Headers عبر `vercel.json` headers.
- HTTPS فقط (إعادة توجيه HTTP→HTTPS).
- Rate limit على مناطق حساسة داخل الـ API (معتمد على DB).

## CI/CD (أساس مؤجل)
- GitHub Actions: الفحص `tsc` + `npm audit` + build.
- نشر تلقائي على Vercel من الفرع `main`.

## نسخ احتياطي
- Snapshots تلقائية من Turso + Export دوري.
- لا يُستخدم GitHub كنسخة بيانات مرضى.