# 2. UX Architecture

## اللغة والاتجاه
- **العربية هي اللغة الأساسية** مع `dir="rtl"` على المستوى الجذري.
- دعم **الإنجليزية** عبر i18n، مع تبديل الاتجاه تلقائياً إلى `ltr`.
- كل المسافات/المحاذاة بخصائص Logical (Inline/Block) وليس فيزيائية.

## التخطيط (Layout) حسب الشاشة — Mobile-First
| النطاق | السلوك |
|---|---|
| 320–639px (Mobile) | Bottom Navigation + Drawer، Cards بدل الجداول الطويلة، أزرار Touch-Friendly |
| 640–1023px (Tablet) | Sidebar كـ Drawer، جداول Responsive، أعمدة قابلة للتكيّف |
| 1024px+ (Desktop) | Sidebar ثابت قابل للطي + TopBar، Multi-column، جداول كاملة |
| 1440px+ (Large) | استفادة من المساحة في Patient Chart، أعمدة متعددة في الشاشات |

## هيكلة الشاشات
- **Auth**: شاشة بتصميم منقسم (نصف تسويقي + نموذج تسجيل دخول) تنهار إلى Column على الموبايل.
- **App Shell**: Sidebar + Header + محتوى. Sidebar يضم: لوحة التحكم، المرضى، الأقسام، المختبر، الأشعة، الأدوية، التقارير، الإعدادات، المستخدمون.
- **Dashboard**: بطاقات إحصائية، رسم بياني لحركة الإدخال، إشغال الردهات، آخر الأنشطة، التنبيهات الحرجة.
- **Patients List**: شريط بحث + فلترة + جدول (Desktop) / Cards (Mobile).
- **Patient Chart** — الأهم بعد Dashboard:
  - **Patient Header ثابت**: الاسم، العمر/الجنس، رقم الملف، القسم/الردهة/السرير، الطبيب المعالج، تاريخ الدخول، الحالة، الحساسية والتنبيهات الحرجة.
  - **مخطط معلوماتي**: Primary info أولاً، التفاصيل داخل أقسام قابلة للفتح.
  - **تنقل داخلي**: Overview / Vitals / Diagnosis / Doctor Notes / Nursing / Medications / Laboratory / Radiology / Consultations / Procedures / Attachments / Timeline / Discharge.
  - Desktop: Tabs بعرض كافٍ + قسم جانبي. Mobile: Horizontal Scroll Tabs.

## حالات التجربة
- **Loading**: Skeleton Loading + مؤشرات تقدم (لا صفحات فارغة).
- **Empty**: رسائل واضحة مع إجراء.
- **Error**: رسالة عربية/إنجليزية مفهومة بدل "500 Internal Server Error".
- **Toast** للإشعارات، **Alerts** للأخطاء، **Badges** للحالات.

## إمكانية الوصول
- Focus states واضحة، تباين مناسب، تنقل بلوحة المفاتيح، ARIA عند الحاجة.
- أهداف لمس ≥ 44px.

## الثيم
- Light Mode أساسي + Dark Mode تكميلي (قراءة نتائج مريحة).
- انعكاس تفضيل النظام عبر `document.documentElement`.