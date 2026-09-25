# HMSI — نظام إدارة المستشفى (Hospital Management System)

تطبيق إدارة مستشفى متعدد المستشفيات ومتعدد المنصات من قاعدة كود واحدة:
**ويب (React PWA) + ويندوز (Tauri) + Backend (Hono + Turso) منشور على Netlify**.

التصميم عربي بالافتراضي (RTL) مع دعم الإنجليزي (LTR) عبر `i18n`.

> 📌 حالة المشروع والأخطاء المعروفة وخارطة الطريق: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

---

## البنية (Monorepo)

```
web/                      React + Vite + PWA (الواجهة)
  src/lib/api.ts          واجهة الـ API — live (الخادم) أو demo (بيانات وهمية في المتصفح)
server/                   Backend: Hono + libsql/Turso (اسم الحزمة @hmsi/api)
  src/routes/             المسارات (auth, patients, records, admissions, hospitals, public ...)
  src/repos/              الوصول لقاعدة البيانات (كل استعلام مقيّد بـ hospital_id)
  db/migrations/*.sql     ملفات الـ migrations (المصدر)
  db/migrations.ts        نسخة مضمّنة مولّدة منها (npm run db:gen -w @hmsi/api)
  scripts/smoke.ts        اختبار e2e شامل (121 فحصاً)
netlify/functions/hmsi.ts دالة Netlify التي تشغّل الـ API على /api/*
packages/shared/          الأنواع + التحقق (Zod) + الصلاحيات (RBAC) المشتركة
tauri/                    غلاف ويندوز (Tauri v2)
docs/                     00: المواصفات الأصلية — 01..09: المعمارية — PROJECT_STATUS
```

## الأدوار

| الدور | الصلاحيات الأساسية |
|---|---|
| `super_admin` (المدير العام) | كل الصلاحيات على النظام: إدارة المستشفيات ومدرائها + الدخول لأي مستشفى والعمل فيه بكل الصلاحيات |
| `admin` (مدير المستشفى) | كل الصلاحيات داخل مستشفاه: الإدارة (المستخدمون، الأقسام، الأسرّة، التقارير، سجل التدقيق) والسريرية (الملاحظات، الأدوية، النتائج، الصرف، مشاركة العائلة) |
| `doctor` | الملاحظات الطبية، التشخيص، **وصف** الأدوية، **طلب** المختبر والأشعة، الاستشارات، اعتماد الخروج |
| `nurse` | ملاحظات التمريض، العلامات الحيوية والألم والسوائل، تسجيل إعطاء الجرعات (MAR)، التنويم |
| `lab` / `radiology` | إدخال نتائج المختبر / تقارير الأشعة |
| `pharmacist` | **صرف** الأدوية الموصوفة (لا يصفها) |
| `reception` | تسجيل المرضى والتنويم (ويحصل على رمز العائلة) |
| `viewer` | قراءة فقط |

الصلاحيات معرّفة في [packages/shared/src/types.ts](packages/shared/src/types.ts).

## متابعة ذوي المريض (QR)

- لكل سرير رمز QR (من صفحة الردهات ← السرير ← طباعة) يفتح `/track/<code>` **بدون تسجيل دخول**.
- الصفحة العامة تعرض فقط: المستشفى، القسم، الردهة، السرير، تاريخ الدخول، مدته، والأحرف الأولى من اسم المريض.
- عند التنويم يُولَّد **رمز عائلة من 6 أرقام** يُسلَّم لذوي المريض؛ بإدخاله يرون الاسم الكامل والطبيب المعالج وآخر علامات حيوية.
- الرمز يتغيّر مع كل تنويم ويُلغى عند الخروج، ويمكن إصدار رمز جديد من ملف المريض. المحاولات محدودة (5 لكل جهاز و20 للسرير كل 15 دقيقة).
- لا تُعرض أي ملاحظات أو تشخيصات أو أدوية أو نتائج على الصفحة العامة.

---

## التشغيل محلياً

```bash
npm install
npm run dev:local     # API على :8787 بقاعدة محلية server/local.db + الواجهة على :5173
npm run dev           # نفس الشيء لكن الـ API يقرأ server/.env (قد يشير إلى Turso الحقيقي!)
npm run typecheck     # فحص كل الحزم
npm test              # اختبار e2e شامل على قاعدة مؤقتة (يرفض العمل إذا ضُبط TURSO_URL)
npm run build         # بناء الإنتاج (shared + web)
```

- الواجهة تعمل في **وضع العرض (demo)** افتراضياً محلياً. لتتصل بالـ API أنشئ `web/.env.local` فيه `VITE_API_MODE=live`.
- الـ migrations تُطبَّق **تلقائياً** عند أول طلب للـ API. لتعبئة قاعدة محلية ببيانات تجريبية:
  `npm run db:seed:local -w @hmsi/api` (قاعدة محلية). ⚠ يمسح كل البيانات.
- حسابات تجريبية (كلمة المرور `password123`): `admin` (مدير عام)، `manager` (مدير مستشفى)، `admin2` (مستشفى ثانٍ)،
  `doctor`، `nurse`، `lab`، `radiology`، `pharmacist`، `reception`، `viewer`.

### إضافة migration

1. أنشئ `server/db/migrations/00N_وصف.sql` (لا تعدّل الملفات القديمة).
2. `npm run db:gen -w @hmsi/api` لتحديث `server/db/migrations.ts`.

---

## النشر على Netlify

الإعداد في [netlify.toml](netlify.toml): البناء `npm run build`، النشر من `web/dist`، والـ API كدالة على `/api/*`.

متغيرات البيئة المطلوبة (Site settings → Environment variables):

| المتغير | الغرض |
| --- | --- |
| `TURSO_URL` | رابط قاعدة Turso |
| `TURSO_AUTH_TOKEN` | توكن Turso |
| `SESSION_SECRET` | **إلزامي** — نص عشوائي طويل؛ بدونه يرفض الـ API العمل |
| `SEED_TOKEN` | اختياري — لنقاط الصيانة `/api/__staff/*` (رأس `x-staff-token`) |
| `ALLOWED_ORIGINS` | اختياري — أصول إضافية مسموحة (مثل تطبيق سطح المكتب) |

`VITE_API_MODE=live` مضبوط في `netlify.toml`.

نقاط الصيانة (تُعيد 404 بدون التوكن الصحيح):
- `POST /api/__staff/migrate` — تطبيق الـ migrations فقط (آمن).
- `POST /api/__staff/seed` مع `{"confirm":"WIPE_ALL_DATA"}` — ⚠ يمسح كل البيانات ويزرع بيانات تجريبية.

## الأمان

- جلسة كوكي `hmsi_session` (HttpOnly، SameSite=Lax، Secure على HTTPS) + توكن CSRF لكل طلب كتابة.
- Argon2id لكلمات المرور، استعلامات بمعاملات فقط، سجل تدقيق (audit) لكل عملية حساسة.
- حماية التخمين على الدخول وتغيير كلمة المرور ورمز العائلة.
- عزل كامل بين المستشفيات: كل استعلام مقيّد بمستشفى المستخدم.
- المرفقات في قاعدة البيانات (حتى 4MB): صور، PDF، نص، Word، Excel فقط، وتُنزَّل دائماً كملف.

## ويندوز (Tauri v2)

```bash
npm run tauri:dev       # يحتاج Rust + MSVC
npm run tauri:build     # NSIS + MSI
```

انظر [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) لما تبقى لربط نسخة ويندوز بالـ API المنشور.
