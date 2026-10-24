# Q VIREXA (الاسم البرمجي HMSI) — تعليمات للوكلاء

> **قاعدة ثابتة لمنع خلط اللغتين (طلب المالك 2026-10-16):** أي مصطلح تقني إنكليزي وسط جملة عربية (ملف، أمر، متغيّر، حزمة) بين backticks دائماً ولا يُصرَّف مع العربية؛ أي عبارة إنكليزية كاملة بين علامتي اقتباس أو بسطر مستقل، لا مدمجة وسط الجملة العربية.

> المجلد كان `HMSI` وصار `Q VIREXA` ضمن مساحة `E:\QASIM\QPRODUCTS`؛ حزم npm وأسماء المستودع (`@hmsi/api`, `/opt/hmsi`) تبقى كما هي. راجع `..\CLAUDE.md` للإطار العام والهوية.

اقرأ أولاً: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — حالة المشروع، القرارات المعتمدة، وخارطة الطريق.
حدّثه بعد كل مهمة (علّم البنود المنجزة وأضف سطراً في سجل التحديثات).

- Monorepo: `web/` (React+Vite)، `server/` (Hono+libsql، الحزمة `@hmsi/api`)، `packages/shared/` (أنواع + Zod + RBAC).
- النشر: خادم Hostinger (`deploy/`، التحديث: `ssh qvps "bash /opt/hmsi/app/deploy/deploy.sh"` بعد الدفع إلى HMSI/main مع `[skip netlify]`. المجلد الآن جزء من مستودع QPRODUCTS ولا يحوي `.git` خاصاً به، فالدفع إلى HMSI يتم بـ `bash ../tools/publish-virexa.sh` (عرض الفروقات) ثم `--push "رسالة"` بطلب المالك). Netlify تحويل فقط.
- قبل التسليم: `npm run typecheck && npm test && npm run build` — كلها يجب أن تنجح.
- كل استعلام في `server/src/repos` مقيّد بـ `hospitalId` (عزل المستشفيات)؛ السجلات الطبية عبر `getAdmissionScope`.
- لا تشغّل seed على قاعدة الإنتاج (`server/.env` يشير إلى Turso حقيقي). `npm test` يستخدم قاعدة مؤقتة.
- migration جديدة = `server/db/migrations/00N_*.sql` ثم `npm run db:gen -w @hmsi/api`.
- نصوص الواجهة عبر `web/src/i18n/{ar,en}.ts` فقط (المحتوى الطويل للصفحات التعريفية والدليل في `web/src/i18n/content/` باللغتين)؛ أي دالة API جديدة في `api.ts` و`api-live.ts` و`api-demo.ts` معاً.
- صفحة `/track/:code` عامة لذوي المريض: بدون رمز العائلة لا بيانات طبية إطلاقاً؛ بعد الرمز يظهر فقط ما فعّله الطاقم (`admissions.family_share`) ومن السجلات المكتملة فقط.
- الهوية: اسم المنتج المعروض **Q VIREXA**؛ ارسم الرمز دائماً من `web/src/components/brand/q-geometry.ts` (أو مكوّني `QMark`/`QLockup`) ولا تعِد رسمه يدوياً.
- رسالة خطأ عربية جديدة في الخادم = أضف ترجمتها في `web/src/i18n/server-messages.ts`. اعرض أسماء البيانات بـ `localName(obj, 'name')` لا بـ `name_ar` مباشرة.
- شعار المستشفى (يرفعه المستشفى) منفصل عن شعار النظام Q VIREXA: لا تضع أحدهما مكان الآخر.
- CSP صارمة في `netlify.toml`: لا سكربت inline ولا `onclick` ولا مصادر خارجية (نوافذ الطباعة تُدار من الصفحة الأم).
- كلمة مرور البيانات التجريبية `HmsiDemo2026`؛ الكلمات الشائعة تُفرض عليها تغيير إجباري.
- الطبيب يرى مرضاه فقط (`server/src/lib/access.ts`): أي مسار جديد لبيانات مريض يمر عبر `getAdmissionScope` أو `assertPatientAccess`، وأي قائمة مرضى تستخدم `doctorAccessSql`. ممرض واحد فعّال لكل مريض (`care_team`).
- الإشعارات: `notify()`/`notifyAdmission()` تُرسل للأجهزة أيضاً (Web Push). نص الجهاز يظهر على شاشة القفل: لا تضع فيه اسم المريض (`pushBodyAr/En`).
- سكربت صور الدليل: `node scripts/capture-guide.mjs` (عربي) و`--en` (إنجليزي) على قاعدة `visual.db` بعد seed.
