# HMSI — تعليمات للوكلاء

اقرأ أولاً: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — حالة المشروع، القرارات المعتمدة، وخارطة الطريق.
حدّثه بعد كل مهمة (علّم البنود المنجزة وأضف سطراً في سجل التحديثات).

- Monorepo: `web/` (React+Vite)، `server/` (Hono+libsql، الحزمة `@hmsi/api`)، `packages/shared/` (أنواع + Zod + RBAC).
- النشر: Netlify (`netlify.toml` + `netlify/functions/hmsi.ts`).
- قبل التسليم: `npm run typecheck && npm test && npm run build` — كلها يجب أن تنجح.
- كل استعلام في `server/src/repos` مقيّد بـ `hospitalId` (عزل المستشفيات)؛ السجلات الطبية عبر `getAdmissionScope`.
- لا تشغّل seed على قاعدة الإنتاج (`server/.env` يشير إلى Turso حقيقي). `npm test` يستخدم قاعدة مؤقتة.
- migration جديدة = `server/db/migrations/00N_*.sql` ثم `npm run db:gen -w @hmsi/api`.
- نصوص الواجهة عبر `web/src/i18n/{ar,en}.ts` فقط (المحتوى الطويل للصفحات التعريفية والدليل في `web/src/i18n/content/` باللغتين)؛ أي دالة API جديدة في `api.ts` و`api-live.ts` و`api-demo.ts` معاً.
- صفحة `/track/:code` عامة لذوي المريض: بدون رمز العائلة لا بيانات طبية إطلاقاً؛ بعد الرمز يظهر فقط ما فعّله الطاقم (`admissions.family_share`) ومن السجلات المكتملة فقط.
- الهوية: اسم المنتج المعروض **Q VIREXA**؛ ارسم الرمز دائماً من `web/src/components/brand/q-geometry.ts` (أو مكوّني `QMark`/`QLockup`) ولا تعِد رسمه يدوياً.
