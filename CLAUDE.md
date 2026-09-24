# HMSI — تعليمات للوكلاء

اقرأ أولاً: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — حالة المشروع، القرارات المعتمدة، وخارطة الطريق.
حدّثه بعد كل مهمة (علّم البنود المنجزة وأضف سطراً في سجل التحديثات).

- Monorepo: `web/` (React+Vite)، `server/` (Hono+libsql، الحزمة `@hmsi/api`)، `packages/shared/` (أنواع + Zod + RBAC).
- النشر: Netlify (`netlify.toml` + `netlify/functions/hmsi.ts`).
- قبل التسليم: `npm run typecheck && npm test && npm run build` — كلها يجب أن تنجح.
- كل استعلام في `server/src/repos` مقيّد بـ `hospitalId` (عزل المستشفيات)؛ السجلات الطبية عبر `getAdmissionScope`.
- لا تشغّل seed على قاعدة الإنتاج (`server/.env` يشير إلى Turso حقيقي). `npm test` يستخدم قاعدة مؤقتة.
- migration جديدة = `server/db/migrations/00N_*.sql` ثم `npm run db:gen -w @hmsi/api`.
- نصوص الواجهة عبر `web/src/i18n/{ar,en}.ts` فقط؛ أي دالة API جديدة في `api.ts` و`api-live.ts` و`api-demo.ts` معاً.
- صفحة `/track/:code` عامة لذوي المريض: لا تُضف إليها أي بيانات طبية.
