# HMSI — نظام إدارة المستشفى (Hospital Management System)

تطبيق إدارة مستشفى متعدد المنصات من قاعدة كود واحدة:
**ويب (React PWA) + ويندوز (Tauri) + أندرويد (PWA/Tauri) + Backend (Hono + Turso) على Vercel**.

التصميم عربي بالافتراضي (RTL) مع دعم الإنجليزي (LTR) عبر `i18n` — لا نصوص مكتوبة بشكل ثابت.

---

## البنية (Monorepo)

```
web/                      React + Vite + PWA (الواجهة)
  src/lib/api-live.ts     عميل الـ API (بالوضع live يشير إلى /api)
api/                      Backend Hono + libsql/Turso
  src/routes/             auth, dashboard, patients, records, vitals, wards, admissions, users, staff
  src/seed/               migrations + seed (وحدات قابلة لإعادة الاستخدام)
  scripts/                migrate.ts / seed.ts / smoke.ts
  index.ts                entrypoint Vercel (hono/vercel)
packages/shared/          الأنواع والصلاحيات المشتركة (RBAC)
tauri/                    غلاف ويندوز (Tauri v2)
docs/                     01-09: معمارية، أمان، قاعدة بيانات، نشر
REEDME.md.txt             مواصفات النظام الأصلية
```

### واجهة الويب (حالة)
صفحات كاملة: تسجيل الدخول، لوحة التحكم، المرضى + الملف الطبي، الردهات، **المختبر**، **الأشعة**،
**الصيدلية** (كلها مقرونة بحساب الحالة — أقسام خدمات)، **التقارير** (إحصاءات/إشغال/نشاط)،
**المستخدمون** (`GET /api/users` لإدارة حقيقية)، **الإعدادات** (لغة/مظهر).

### الصلاحيات (RBAC)
حسابات ديمو بكلمة مرور `password123`:
`admin` (super_admin)، `doctor`، `doctor2`، `doctor3`، `nurse`، `nurse2`، `pharmacist`،
`lab`، `radiology`، `reception`، `viewer`. الصلاحيات في `packages/shared/src/types.ts`.

---

## التشغيل محلياً

```bash
npm install
npm run typecheck        # فحص كل الـ workspaces
npm run dev              # API (:3000) + web (:5173) معاً عبر concurrently
```

الـ API له وضعان:
- **ملف محلي** (`file:local.db`) عند غياب `TURSO_URL` — كافٍ للتطوير والديمو.
- **Turso** عند توفر `TURSO_URL` + `TURSO_AUTH_TOKEN`.

```bash
npm run db:migrate -w @hmsi/api   # تطبيق الـ migrations (تتتبعها schema_migrations)
npm run db:seed    -w @hmsi/api   # زرع البيانات (8 مرضى، 11 مستخدم) وأي إعادة تشغيل
$env:SEED_TOKEN='test-token-123'; npx tsx scripts/smoke.ts   # فحص e2e
```

> ملاحظة: SQLite المضمّن في `@libsql/client` لا يدعم `ADD COLUMN IF NOT EXISTS`
> — لِذلك تُضاف الأعمدة عبر ALTER يُسجَّل مرة واحدة في `schema_migrations`.
> عند مشاكل DB محلياً: احذف `api/local.db{, -wal, -shm}` وأعد migrate/seed.

---

## متغيرات البيئة

| المتغير | الغرض |
| --- | --- |
| `TURSO_URL` | رابط قاعدة Turso (إن غاب → ملف محلي) |
| `TURSO_AUTH_TOKEN` | توكن Turso |
| `SESSION_SECRET` | توقيع الجلسة (ضروري في الإنتاج) |
| `SEED_TOKEN` | يحمي `POST /api/__staff/seed` (header `x-staff-token`) |
| `ALLOWED_ORIGINS` | قائمة الأصول المسموح بها في الإنتاج (CSRF/CORS) |
| `VITE_API_MODE` | `live` أو `mock` لواجهة الويب |
| `VITE_API_URL` | أساس API خارجي اختياري (يُسبق `/api`) — مفيد لغلاف Tauri |

---

## نشر Vercel

- `vercel.json`: build = `npm run build:vercel`، output = `web/dist`،
  route `/api/*` → `api/index.ts`، fallback → `/index.html`، headers أمنية.
- استبدل توكن وظيفة `api/index.ts` بالمتغيرات البيئية أعلاه (Vercel → Settings → Environment Variables).
- بعد النشر أعد تعبئة البيانات مرة واحدة عبر:
  `POST {BASE}/api/__staff/seed` مع `x-staff-token: <SEED_TOKEN>` (يعيد `{"ok":true,...}`).
- الـ migrations تُطبق تلقائياً عند تشغيل الـ API (محدثة لـ seed وكذلك نشر).

### الأمان
- جلسة كوكي `hmsi_session` (HttpOnly، SameSite) + توكن `X-CSRF-Token` للكتابة مع جلسة.
- كلمات مرور بـ Argon2id، استعلامات Parameterized فقط، تسجيل Audits.
- `GET /api/me` بلا جلسة → `200 null` (الواجهة تقرر).

---

## ويندوز (Tauri v2)

البنية جاهزة في `tauri/src-tauri/` (أيقونات مولّدة لكل المنصات).

> البناء يتطلب **Rust + MSVC** على الجهاز — حالياً غير متوفر هنا،
> فالبنية مكتوبة ومتحقق منها فقط بالـ CLI.

```bash
npm run tauri:dev       # تطوير داخل نافذة سطح المكتب (يعمل على :5173)
npm run tauri:build     # إنتاج NSIS + MSI (يحتاج Rust)
npm run tauri:icon      # إعادة توليد الأيقونات من tauri/src-tauri/icons/icon.png
```

في غلاف سطح المكتب عند الحاجة لوصل API خارجي: عيّن `VITE_API_URL` أثناء البناء.

---

## الاختبار

```bash
npx tsx api/scripts/smoke.ts    # سلسلة e2e: auth/RBAC/CSRF/discharge/staff-seed
npm run typecheck               # tsc لكل الـ workspaces
npm run build:vercel            # بناء النشر الفعلي
```