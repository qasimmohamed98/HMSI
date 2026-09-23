# 3. Security Architecture

## المبدأ
**Zero Trust**: لا يُثق بأي طلب (Browser/Mobile/Desktop). كل Request يخضع للتحقق Server-Side.
**الأمان Priority #2** لكنه يُبنى مع التصميم معاً (لا أمان يدمر UX، ولا UI يضعف الأمان).

## المصادقة (Authentication)
- Password Hashed بـ **Argon2id** (معامل memory/time عالية).
- جلسات في قاعدة البيانات + **HttpOnly Cookie** (`hospital_session`):
  - `HttpOnly; Secure; SameSite=Lax`
  - انتهاء صلاحية + **Session Rotation** عند الدخول/الخروج.
- لا تخزين لإسرار المصادقة في `localStorage`.
- رسائل خطأ موحّدة (لا كشف عن وجود حساب: نفس رسالة "بيانات غير صحيحة").

## التفويض (Authorization)
- RBAC: دور → صلاحيات.
- نطاق (Scope): المستشفى ← القسم ← الردهة ← المريض.
- كل Endpoint يتحقق: Authenticated → Role/Permission → Hospital → Department → Patient Scope.
- Middleware مركزي `requireAuth` + `requirePermission` + `scopePatient`.

## حماية API
- **Input Validation**: Zod Schema لكل Body/Params/Query.
- **Rate Limiting**: على Login، Password Reset، User Creation، File Upload (عداد في DB مشترك).
- **SQL Injection**: Parameterized Queries فقط (لا String Concatenation).
- **XSS**: الفصل التام API/UI، لا `innerHTML` ببيانات مستخدم، الهروب الأوتوماتيكي في React.
- **CSRF**: Cookie `SameSite=Lax` + **Token CSRF** (قيمة عند الدخول، تُرسل في Header مخصص مع عمليات Mutating).
- **Secrets**: `TURSO_AUTH_TOKEN` وغيرها حصراً في Vercel Environment Variables — تُقرأ Server-Side فقط.

## الملفات الطبية
- تحقق `MIME + Extension + Size` مع السماح بأمثلة معروفة فقط (PDF, PNG, JPG, WEBP).
- التخزين في حاوية خاصة، **لا Public URL**؛ التسليم عبر Endpoint موثق مع فحص صلاحية.

## الحماية من Brute Force
- اطالقة مضادة: تجميد/تأخير بعد محاولات فاشلة متكررة، دون كشف تفاصيل.

## Audit Logs (سجل تدقيق)
- تسجيل: Login, Logout, Failed Login, Patient Created/Viewed/Updated, Medical Note Created/Updated, Medication Changed, Lab Result Added, Radiology Report Added, Patient Transferred, Patient Discharged, User Permission Changed, Settings Changed.
- جداول زمنية لا تُحذف في Transaction.
- **Immutable Medical Events**: التصحيح يُسجَّل كإضافة (Correction Event) ولا يُحذف التاريخ.

## الحماية الوثائقية
- HTTPS دائم في Production.
- Security Headers: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-Frame-Options`.

## Backup & Recovery
- نسخ Turso آلية (Snapshots دورية) + Export دوري.
- لا اعتماد على GitHub كنسخة من بيانات المرضى.