==================================================
112. MULTI-PLATFORM APPLICATION
==================================================

هذا المشروع ليس مجرد Website.

يجب تصميمه من البداية كمنصة طبية Multi-Platform يمكن تشغيلها على:

1. Web
2. Windows Desktop
3. Android
4. Tablet
5. Mobile
6. Laptop
7. Large Desktop Screens

==================================================
113. WEB APPLICATION
==================================================

النسخة الأساسية يجب أن تعمل بالكامل من خلال Web Browser.

المستخدم يستطيع الدخول من:

Chrome
Edge
Firefox
Safari

ويجب أن تكون الواجهة Responsive بالكامل.

الرابط الرسمي سيكون مستضافاً على Vercel.

مثال:

https://hospital-system.vercel.app

ويجب أن يكون النظام جاهزاً لاحقاً لاستخدام Custom Domain.

==================================================
114. RESPONSIVE DESIGN
==================================================

هذه من أهم نقاط المشروع.

لا أريد تصميم Desktop يتم تصغيره للموبايل.

أريد Responsive Design حقيقي.

يجب تصميم الواجهات لكل:

320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px
2560px

وما فوق.

==================================================
115. MOBILE-FIRST
==================================================

صمم Components بحيث تعمل على Mobile أولاً، ثم Tablet، ثم Desktop.

لكن لا تجعل نسخة Desktop تبدو مثل نسخة Mobile مكبرة.

يجب أن يكون لكل حجم شاشة Layout مناسب.

==================================================
116. Desktop UI
==================================================

على الشاشات الكبيرة:

Sidebar ثابت أو قابل للطي.

Top Navigation.

Dashboard Cards.

Tables.

Charts.

Patient Information Panel.

Multi-column Layout.

Patient Chart يجب أن تستفيد من مساحة الشاشة.

==================================================
117. Tablet UI
==================================================

على Tablet:

Sidebar يمكن أن يتحول إلى Drawer.

الجداول يجب أن تكون Responsive.

Buttons كبيرة بما يكفي للمس.

Patient Chart يجب أن تبقى سهلة الاستخدام.

==================================================
118. Mobile UI
==================================================

على الهاتف:

Bottom Navigation عند الحاجة.

Mobile Drawer.

Cards بدلاً من الجداول الكبيرة عند الحاجة.

الأزرار Touch Friendly.

لا تستخدم عناصر صغيرة جداً.

لا تجعل المستخدم يحتاج إلى Zoom.

==================================================
119. Windows Application
==================================================

يجب أن يكون المشروع قابلاً للتشغيل كتطبيق Windows Desktop.

لا تعيد بناء النظام بالكامل من الصفر.

استخدم نفس Web Application.

ادرس استخدام:

Tauri

أو:

Electron

واختر الأفضل للمشروع بعد مقارنة:

Performance
Security
RAM Usage
Build Size
Windows Compatibility
Maintenance

الأولوية للأمان والأداء وحجم التطبيق.

يجب أن يكون الناتج قابلاً للتثبيت مثل:

Hospital Management System Setup.exe

أو:

Hospital Management System.exe

==================================================
120. Windows Application Features
==================================================

نسخة Windows يجب أن:

- تفتح كتطبيق مستقل.
- لا تحتاج المستخدم إلى فتح Browser.
- تستخدم نفس الحساب.
- تتصل بالـBackend نفسه.
- تستخدم نفس Database.
- تحافظ على نفس التصميم.
- تدعم التحديثات.
- تدعم Windows 10 وWindows 11 قدر الإمكان.

لا تنشئ Database منفصلة لنسخة Windows.

==================================================
121. Android Application
==================================================

يجب أن يكون النظام قابلاً للتثبيت على Android.

المرحلة الأولى:

PWA

يجب أن يكون:

Installable
Responsive
Mobile Friendly
Fast
Secure

ويدعم:

Add to Home Screen

ويعمل كتطبيق App-like Experience.

==================================================
122. Android Native Wrapper
==================================================

صمم Architecture بحيث يمكن مستقبلاً تحويل PWA إلى Android Application حقيقي.

يمكن تقييم:

Capacitor

أو تقنية مناسبة أخرى.

لا تستخدم Flutter.

ولا تستخدم Dart.

ويجب إعادة استخدام نفس React Codebase قدر الإمكان.

==================================================
123. Shared Codebase
==================================================

أريد أكبر قدر ممكن من إعادة استخدام الكود.

Architecture:

                    Shared Core
                        │
        ┌───────────────┼───────────────┐
        │               │               │
       WEB           WINDOWS         ANDROID
        │               │               │
     Browser          Tauri/          PWA/
                      Electron        Capacitor

جميعها تستخدم:

نفس Backend
نفس Authentication
نفس API
نفس Database
نفس Business Logic
نفس Permissions

==================================================
124. DESIGN IS PRIORITY #1
==================================================

التصميم وتجربة المستخدم هما الأولوية الأولى في المشروع.

لا أريد:

Generic Admin Dashboard
Old Hospital Software Look
Cluttered UI
Too Many Tables
Too Many Colors
Tiny Text
Confusing Menus

أريد:

Modern
Clean
Professional
Medical
Elegant
Fast
Minimal
Clear
Accessible

==================================================
125. DESIGN SYSTEM
==================================================

أنشئ Design System موحد.

يجب أن يحتوي على:

Colors
Typography
Spacing
Border Radius
Shadows
Icons
Buttons
Inputs
Cards
Tables
Dialogs
Modals
Dropdowns
Tabs
Badges
Alerts
Toast Notifications
Loading States
Empty States
Error States

==================================================
126. Medical Visual Identity
==================================================

التصميم يجب أن يعطي إحساساً:

Medical
Professional
Trustworthy
Clean

لكن بدون مبالغة بالألوان الطبية التقليدية.

لا تجعل النظام كله أزرق فقط.

استخدم Color System متوازن.

==================================================
127. Arabic RTL
==================================================

اللغة الأساسية:

Arabic

والواجهة:

RTL

يجب أن يكون RTL حقيقياً وليس مجرد:

direction: rtl;

فقط.

تحقق من:

Sidebar
Tables
Forms
Icons
Dropdowns
Breadcrumbs
Charts
Pagination
Dialogs
Patient Chart

==================================================
128. English Support
==================================================

صمم النظام بحيث يدعم:

Arabic
English

مع إمكانية إضافة لغات أخرى.

لا تضع النصوص مباشرة داخل Components إذا كان يمكن استخدام Translation System.

==================================================
129. Typography
==================================================

استخدم خط عربي احترافي.

يمكن استخدام:

Cairo
Noto Sans Arabic

ويجب أن تكون:

Headings
Body
Tables
Forms
Buttons

واضحة ومريحة للقراءة.

==================================================
130. Patient Chart UX
==================================================

الطبلة الإلكترونية هي أهم شاشة بعد Dashboard.

يجب تصميمها بعناية شديدة.

عند فتح Patient Chart يجب أن يرى الطبيب فوراً:

Patient Name
Age
Gender
Patient ID
File Number
Department
Ward
Room
Bed
Attending Doctor
Admission Date
Current Status
Allergies
Critical Alerts

==================================================
131. Patient Header
==================================================

يجب أن يكون Patient Header واضحاً وثابتاً أثناء التصفح إذا كان ذلك مناسباً.

مثلاً:

┌────────────────────────────────────────────┐
│ محمد علي كريم                             │
│ 54 سنة | ذكر | ملف #12345                 │
│ الباطنية | ردهة الرجال | سرير 12          │
│                                            │
│ ⚠ Allergy: Penicillin                     │
└────────────────────────────────────────────┘

لا تستخدم هذا التصميم حرفياً.

استعمله كفكرة UX.

==================================================
132. Patient Chart Navigation
==================================================

يجب أن يكون الوصول إلى أقسام الطبلة سريعاً.

مثلاً:

Overview
Vitals
Diagnosis
Doctor Notes
Nursing
Medications
Laboratory
Radiology
Consultations
Procedures
Attachments
Timeline
Discharge

على Desktop يمكن أن تكون Tabs أو Sidebar داخلي.

على Mobile يمكن استخدام:

Horizontal Scroll Tabs
أو
Section Navigation

==================================================
133. INFORMATION HIERARCHY
==================================================

لا تعرض كل المعلومات بنفس الأهمية.

استخدم:

Primary Information
Secondary Information
Detailed Information

مثلاً:

الأشياء الحرجة تظهر أولاً.

المعلومات التفصيلية تكون داخل Sections قابلة للفتح.

==================================================
134. DARK MODE
==================================================

يمكن دعم:

Light Mode
Dark Mode

لكن Light Mode يجب أن يكون التصميم الأساسي.

يجب التأكد من أن Dark Mode مناسب للاستخدام الطبي ولا يسبب صعوبة في قراءة النتائج.

==================================================
135. Accessibility
==================================================

اهتم بإمكانية الوصول.

مثل:

Readable Font
Keyboard Navigation
Focus States
Proper Contrast
ARIA عند الحاجة
Accessible Forms

==================================================
136. Loading Experience
==================================================

لا تجعل المستخدم يرى صفحة فارغة أثناء تحميل البيانات.

استخدم:

Skeleton Loading
Progress Indicators
Optimistic UI عند الحاجة

==================================================
137. Error Experience
==================================================

عند حدوث مشكلة:

لا تعرض:

500 Internal Server Error

للمستخدم بشكل مباشر.

استخدم رسائل مفهومة.

مثلاً:

"تعذر تحميل بيانات المريض، يرجى المحاولة مرة أخرى."

مع تسجيل التفاصيل التقنية في Logs.

==================================================
138. SECURITY IS PRIORITY #2
==================================================

الأمان هو ثاني أعلى أولوية في المشروع.

هذا نظام يحتوي على:

Personal Data
Medical Data
User Data
Authentication Data

لذلك يجب تصميم Security Architecture قبل بناء بقية النظام.

==================================================
139. ZERO TRUST PRINCIPLE
==================================================

لا تثق بأي Request قادم من:

Browser
Mobile
Desktop

كل Request يجب التحقق منه Server-Side.

لا تعتمد على:

Hidden Buttons
Frontend Permissions
Client-side Role Checks

كوسيلة حماية وحيدة.

==================================================
140. Authentication Security
==================================================

استخدم Authentication آمن.

Passwords:

Never store plain text.

استخدم Password Hashing قوي مثل:

Argon2id

أو تقنية حديثة مناسبة.

==================================================
141. Session Security
==================================================

استخدم Secure Sessions.

يفضل:

HttpOnly Cookies
Secure Cookies
SameSite
Session Expiration
Session Rotation

حسب Architecture.

لا تخزن Authentication Secrets في:

localStorage

إذا كان يمكن تجنب ذلك.

==================================================
142. Authorization
==================================================

كل API Endpoint يجب أن يتحقق من:

Authenticated User
Role
Permission
Hospital
Department
Ward
Patient Scope

حسب الحاجة.

==================================================
143. API Security
==================================================

كل API يجب أن يحتوي على:

Authentication
Authorization
Input Validation
Rate Limiting
Error Handling

ولا تقبل بيانات غير موثوقة من Client.

==================================================
144. Input Validation
==================================================

تحقق من جميع البيانات القادمة من:

Forms
API
URL Parameters
Query Parameters
Files

استخدم Schema Validation.

==================================================
145. SQL Injection Protection
==================================================

لا تبني SQL Queries باستخدام String Concatenation.

استخدم:

Parameterized Queries

أو ORM/Query Builder آمن.

==================================================
146. XSS Protection
==================================================

يجب حماية النظام من:

Stored XSS
Reflected XSS
DOM XSS

لا تعرض HTML مدخل من المستخدم بشكل مباشر.

==================================================
147. CSRF Protection
==================================================

إذا كانت Authentication تعتمد على Cookies:

طبق CSRF Protection مناسب.

==================================================
148. File Upload Security
==================================================

الملفات الطبية تحتاج حماية خاصة.

عند رفع ملف:

تحقق من:

File Type
File Extension
MIME Type
File Size

لا تعتمد على Extension فقط.

يجب منع:

Executable Files
Malicious Files
Unexpected MIME Types

ويجب تخزين الملفات في Storage آمن.

==================================================
149. Medical File Access
==================================================

لا تجعل الملفات الطبية متاحة من Public URL بشكل مباشر.

يجب أن تكون:

Private

ويتم الوصول إليها من خلال:

Authenticated Request
+
Authorization Check

==================================================
150. Database Security
==================================================

Turso Credentials يجب ألا تظهر في Frontend.

لا ترسل:

TURSO_AUTH_TOKEN

إلى Browser.

Database Access يجب أن يكون Server-side.

==================================================
151. Secrets Management
==================================================

جميع Secrets يجب أن تكون في:

Vercel Environment Variables

ولا يتم تخزينها في GitHub.

==================================================
152. HTTPS
==================================================

Production يجب أن يعمل عبر HTTPS.

لا ترسل بيانات المرضى عبر HTTP غير مشفر.

==================================================
153. Security Headers
==================================================

أضف Security Headers مناسبة مثل:

Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Strict-Transport-Security

وقم بتكوينها بعناية حتى لا تسبب مشاكل في التطبيق.

==================================================
154. Rate Limiting
==================================================

طبق Rate Limiting على العمليات الحساسة مثل:

Login
Password Reset
User Creation
API Requests
File Upload

==================================================
155. Brute Force Protection
==================================================

عند تكرار محاولات Login الفاشلة:

طبق حماية مناسبة.

لا تكشف للمهاجم معلومات مثل:

"Username exists"

أو

"Password is wrong"

بشكل يساعد على اكتشاف الحسابات.

==================================================
156. Audit Logs
==================================================

سجل العمليات الحساسة:

Login
Logout
Failed Login
Patient Created
Patient Viewed
Patient Updated
Medical Note Created
Medical Note Updated
Medication Changed
Lab Result Added
Radiology Report Added
Patient Transferred
Patient Discharged
User Permission Changed
Settings Changed

==================================================
157. حماية السجل الطبي
==================================================

لا تسمح بتعديل أو حذف السجلات الطبية بدون صلاحية.

يفضل استخدام:

Immutable Medical Events

عند الحاجة.

إذا تم تصحيح معلومة:

سجل التصحيح بدلاً من محو التاريخ.

==================================================
158. Backup & Recovery
==================================================

صمم آلية Backup مناسبة لقاعدة البيانات.

يجب التفكير في:

Automatic Backups
Recovery
Export
Disaster Recovery

ولا تعتمد على GitHub كنسخة من بيانات المرضى.

==================================================
159. Security Review
==================================================

بعد الانتهاء من MVP:

قم بمراجعة أمنية كاملة.

راجع:

Authentication
Authorization
API
Database
File Upload
Sessions
Cookies
XSS
CSRF
SQL Injection
Rate Limiting
Secrets
Permissions
Audit Logs
Error Messages

==================================================
160. Dependency Security
==================================================

راجع Dependencies.

لا تضف مكتبة بدون حاجة.

افحص:

npm audit

وأي أدوات أمنية مناسبة.

عند وجود Vulnerability:

حلها أو قيّم تأثيرها قبل Production.

==================================================
161. Security Testing
==================================================

اختبر حالات مثل:

User without permission
Direct API access
Invalid Token
Expired Session
Wrong Hospital
Wrong Department
Wrong Ward
Unauthorized Patient
Malicious File
Oversized File
Invalid Input
Repeated Login
Session Hijacking Scenarios

==================================================
162. DESIGN + SECURITY RULE
==================================================

لا تسمح للأمان أن يدمر تجربة المستخدم.

ولا تسمح للتصميم أن يضعف الأمان.

ابنِ الاثنين معاً من البداية.

==================================================
163. FINAL PRODUCT
==================================================

المنتج النهائي يجب أن يشعر المستخدم بأنه:

Medical Professional Software

وليس:

Generic CRUD Application

يجب أن يكون:

Modern
Fast
Beautiful
Secure
Responsive
Professional
Easy to Learn
Easy to Use
Configurable
Scalable

==================================================
164. PLATFORM TARGETS
==================================================

النسخة الأولى يجب أن تستهدف:

WEB
Windows
Android

مع:

Responsive Mobile
Responsive Tablet
Responsive Desktop

==================================================
165. DEVELOPMENT PRIORITY
==================================================

ترتيب الأولويات الإلزامي:

Priority 1:
UI/UX + Design System

Priority 2:
Security + Privacy

Priority 3:
Core Medical Workflow

Priority 4:
Performance

Priority 5:
Cross-platform Experience

Priority 6:
Customization

Priority 7:
Reports and Advanced Features

==================================================
166. لا تبدأ بالكود مباشرة
==================================================

قبل كتابة الكود:

قم بإنشاء:

1. Product Architecture
2. UX Architecture
3. Security Architecture
4. Database Architecture
5. Application Architecture
6. Multi-platform Architecture
7. Component Architecture
8. Permission Architecture
9. Deployment Architecture

ثم اعرضها.

بعدها ابدأ التنفيذ على مراحل.

==================================================
END OF MULTI-PLATFORM + SECURITY SPECIFICATION
==================================================