# 5. Application Architecture

## التشكل
Monorepo عبر npm workspaces:

```
HMSI/
├── docs/                 # المعماريات والمستندات
├── packages/
│   └── shared/           # أنواع TypeScript + Zod Schemas مشتركة
├── web/                  # تطبيق الواجهة (React) — النواة المشتركة لكل المنصات
│   └── src/
│       ├── app/          # Router + Providers
│       ├── components/   # ui/ (Design System) + layout/ + domain
│       ├── features/     # حسب الوحدة (auth, patients, dashboard …)
│       ├── i18n/         # ترجمات ar/en
│       ├── lib/          # api client, auth store, utils
│       ├── pages/        # عناصر توجيه
│       └── styles/       # tokens + globals
├── api/                  # Backend: Hono (Serverless على Vercel)
│   ├── db/               # migrations + schema + seed
│   └── src/              # routes, middleware, repositories
└── tauri/                # غلاف Windows Desktop
```

## الطبقات (Layered)
```
UI (React) → API Client (fetch) → API (Hono) → Repositories (Parameterized SQL) → Turso
                                     ↓
                              Middleware: Auth → RBAC → Scope → Validation → Audit
```

## تدفق البيانات
- UI لا يلمس قاعدة البيانات إطلاقاً.
- كل التفاعل عبر REST endpoints بمواصفات Zod Schema مشتركة في `packages/shared`.
- معاملات الفتح: `React Query` لإدارة الحالة الخادمية + `React Router`.

## اختيارات تقنية
| مجال | الاختيار | السبب |
|---|---|---|
| إطار الواجهة | React + TypeScript + Vite | إعادة استخدام عبر المنصات، أداء، مجتمع |
| التصميم | Tailwind v4 (CSS-first tokens) | نظام تصميم قابل للتوسع + RTL سلس |
| التوجيه | React Router | قياسي، يدعم Layouts |
| البيانات | TanStack Query | كاش، إعادة محاولة، Optimistic UI |
| الرسوم | Recharts | رسوم طبية خفيفة |
| الأيقونات | lucide-react | نظيفة وموحّدة |
| i18n | i18next | عربية/إنجليزية + قابلية إضافة لغات |
| Backend | Hono | خفيف، يعمل على Edge/Vercel Functions |
| قاعدـة بيانات | Turso (libsql) | SQLite موزّع، أمان، سرعة |
| تحقق | Zod | Schema Validation مشترك |
| Windows | Tauri (وليس Electron) | أداء/أمان/حجم بناء أصغر، أولوية بالمشروع |
| Android | PWA ثم مستقبلاً Capacitor | إعادة استخدام كود React الكامل |

## يمكن التوسع
إضافة `packages/ui` مستقبلية، أو تقسيم `features` لوحدات أكبر.