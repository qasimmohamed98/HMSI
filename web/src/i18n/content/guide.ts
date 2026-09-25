/**
 * الدليل التعليمي المصوَّر. الصور في web/public/guide (تُعاد بالتقاطها من النسخة المحلية عبر سكربت Playwright).
 * أي تعديل هنا يجب أن يُطابق في اللغتين، وبنفس أسماء الأزرار الظاهرة في الواجهة.
 */
export type GuideRole = 'all' | 'admin' | 'reception' | 'doctor' | 'nurse' | 'lab' | 'pharmacy' | 'family' | 'super';

export interface GuideTopic {
  id: string;
  title: string;
  intro?: string;
  steps?: string[];
  images?: { src: string; caption: string }[];
  tips?: string[];
}

export interface GuideChapter {
  id: string;
  role: GuideRole;
  title: string;
  summary: string;
  topics: GuideTopic[];
}

export interface GuideContent {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  roles: Record<GuideRole, string>;
  tipLabel: string;
  noResults: string;
  chapters: GuideChapter[];
  faqTitle: string;
  faq: { q: string; a: string }[];
}

const img = (src: string, caption: string) => ({ src: `/guide/${src}.jpg`, caption });

export const GUIDE_AR: GuideContent = {
  title: 'دليل استخدام النظام',
  subtitle: 'شرح مصوَّر خطوة بخطوة لكل ما تحتاجه — اختر دورك أو ابحث عن المهمة.',
  searchPlaceholder: 'ابحث: تنويم، علامات حيوية، تقرير، كلمة المرور...',
  roles: { all: 'الكل', admin: 'مدير المستشفى', reception: 'الاستقبال', doctor: 'الطبيب', nurse: 'التمريض', lab: 'المختبر والأشعة', pharmacy: 'الصيدلية', family: 'ذوو المريض', super: 'المدير العام' },
  tipLabel: 'نصيحة',
  noResults: 'لا توجد نتائج — جرّب كلمة أخرى.',
  chapters: [
    {
      id: 'start',
      role: 'all',
      title: 'البداية',
      summary: 'تسجيل الدخول والتعرف على الواجهة.',
      topics: [
        {
          id: 'login',
          title: 'تسجيل الدخول',
          steps: [
            'افتح رابط النظام من المتصفح (على الحاسوب أو الهاتف).',
            'اكتب «اسم المستخدم» و«كلمة المرور» اللذين أعطاك إياهما مدير المستشفى.',
            'اضغط «تسجيل الدخول».',
          ],
          images: [img('login', 'صفحة تسجيل الدخول')],
          tips: [
            'إن ظهرت رسالة «محاولات كثيرة» انتظر 15 دقيقة ثم حاول مجدداً.',
            'ليس لديك حساب؟ اطلبه من مدير مستشفاك. أما إن كنت تمثل مستشفى جديداً فاستخدم «سجّل مستشفاك».',
          ],
        },
        {
          id: 'layout',
          title: 'التعرف على الواجهة',
          intro: 'القائمة الجانبية فيها كل الصفحات المتاحة لدورك فقط. الشريط العلوي فيه اسم المستشفى، زر اللغة (EN/ع)، الوضع الليلي، وقائمة حسابك (الإعدادات وتسجيل الخروج).',
          images: [img('dashboard', 'لوحة التحكم: أرقام اليوم، الإنذار المبكر، إشغال الردهات، والنشاط الأخير')],
          tips: ['على الهاتف تظهر القائمة من زر ☰ أعلى الشاشة، وأهم الصفحات في الشريط السفلي.', 'يمكن تثبيت النظام كتطبيق على الهاتف: من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية».'],
        },
        {
          id: 'password',
          title: 'تغيير كلمة المرور',
          steps: ['من قائمة حسابك أعلى الشاشة اختر «الإعدادات».', 'في بطاقة «تغيير كلمة المرور» اكتب الحالية ثم الجديدة مرتين.', 'اضغط «حفظ».'],
          tips: ['كلمة المرور 8 أحرف على الأقل وتحتوي حروفاً وأرقاماً.', 'نسيت كلمة المرور؟ مدير المستشفى يعيد تعيينها من صفحة «المستخدمون».'],
        },
      ],
    },
    {
      id: 'admin',
      role: 'admin',
      title: 'مدير المستشفى',
      summary: 'تجهيز المستشفى، المستخدمون، الأقسام والأسرّة، الاشتراك، التقارير، والمحذوفات.',
      topics: [
        {
          id: 'signup',
          title: 'تسجيل مستشفى جديد والفترة التجريبية',
          steps: [
            'من صفحة الدخول اضغط «سجّل مستشفاك وجرّب النظام مجاناً 14 يوماً».',
            'املأ بيانات المستشفى، ثم بياناتك كمدير (الاسم، الهاتف، اسم المستخدم، كلمة المرور).',
            'اضغط «ابدأ التجربة المجانية» — تدخل النظام مباشرة كمدير لمستشفاك.',
          ],
          images: [img('signup', 'نموذج تسجيل مستشفى جديد')],
          tips: ['يظهر أعلى الشاشة شريط بعدد الأيام المتبقية من التجربة.'],
        },
        {
          id: 'logo',
          title: 'اسم المستشفى وشعاره',
          steps: ['افتح «الإعدادات».', 'في بطاقة «المستشفى» اضغط ✎ لتعديل الاسم.', 'في «شعار المستشفى» اضغط «رفع الشعار» واختر صورة PNG أو JPEG (حتى 300 كيلوبايت).'],
          images: [img('settings-logo', 'بطاقة المستشفى وشعاره في الإعدادات')],
          tips: ['الشعار يظهر في القائمة الجانبية، وصفحة ذوي المريض، وكل المطبوعات.'],
        },
        {
          id: 'structure',
          title: 'الأقسام والردهات والأسرّة',
          steps: [
            'من «الأقسام» أضف أقسام المستشفى (الباطنية، الجراحة...).',
            'من «الردهات والأسرّة» اضغط «إضافة ردهة» واختر قسمها.',
            'داخل الردهة أضف الأسرّة (رقم الغرفة ورقم السرير).',
            'اضغط على أي سرير لرؤية حالته، وتعديله، وطباعة رمز QR الخاص به.',
          ],
          images: [img('departments', 'صفحة الأقسام'), img('wards', 'الردهات والأسرّة وإشغالها'), img('wards-bed', 'نافذة السرير: المريض، الإدارة، ورمز QR لذوي المريض')],
          tips: ['اطبع رمز QR لكل سرير وألصقه عليه — يمسحه ذوو المريض لمتابعة حالته.', '«إخلاء السرير» يفصل المريض عن السرير فقط ولا يُخرجه من المستشفى.'],
        },
        {
          id: 'users',
          title: 'إضافة الموظفين وأدوارهم',
          steps: ['افتح «المستخدمون» واضغط «مستخدم جديد».', 'اكتب اسم المستخدم وكلمة المرور والاسم الكامل.', 'اختر الدور: طبيب، تمريض، مختبر، أشعة، صيدلي، استقبال، أو مشاهد.', 'اضغط «حفظ» وأعطِ الموظف اسم المستخدم وكلمة المرور.'],
          images: [img('users', 'قائمة المستخدمين'), img('users-new', 'إضافة مستخدم واختيار دوره')],
          tips: ['الدور يحدد ما يراه الموظف ويستطيع فعله — راجع صفحة «عن النظام» لجدول الصلاحيات.', 'لإيقاف موظف غادر العمل عطّل حسابه بدل حذفه.'],
        },
        {
          id: 'billing',
          title: 'الاشتراك والدفع',
          steps: [
            'افتح «الاشتراك والدفع» لرؤية حالة الاشتراك ومعلومات الدفع.',
            'ادفع بالطريقة المذكورة (تحويل مصرفي أو محفظة).',
            'املأ «أبلغ عن دفعة»: المبلغ، طريقة الدفع، رقم الحوالة، ثم «إرسال إشعار الدفع».',
            'بعد تحقق مدير النظام يُفعَّل الاشتراك ويظهر في «إشعارات الدفع السابقة» كـ«معتمد».',
          ],
          images: [img('billing', 'صفحة الاشتراك والدفع')],
          tips: ['عند انتهاء الاشتراك تبقى البيانات محفوظة كاملة، لكن لا تظهر إلا صفحة الدفع حتى التجديد.'],
        },
        {
          id: 'reports',
          title: 'التقارير والتصدير إلى Excel',
          steps: ['افتح «التقارير» واختر نوع التقرير من الأعلى (سجل الدخول، الخروج، المنوّمون حالياً، التحاليل...).', 'اختر الفترة (اليوم، هذا الشهر...) أو تاريخاً مخصصاً، ويمكن التصفية حسب القسم أو الطبيب.', 'اضغط «تصدير Excel» لتنزيل الملف، أو «طباعة» لطباعته على A4 بشعار المستشفى.'],
          images: [img('reports', 'تقرير سجل الدخول مع الملخص والجدول')],
          tips: ['تقرير «المنوّمون حالياً» مفيد جداً لتسليم المناوبة.'],
        },
        {
          id: 'audit',
          title: 'سجل التدقيق',
          intro: 'كل عملية في النظام تُسجَّل: من فتح ملف مريض، من عدّل، من حذف، ومتى. افتح «سجل التدقيق» للمراجعة.',
          images: [img('audit', 'سجل التدقيق')],
        },
        {
          id: 'trash',
          title: 'سلة المحذوفات والاستعادة',
          steps: [
            'لا يُحذف شيء نهائياً — كل محذوف ينتقل إلى «المحذوفات».',
            'الموظف يرى ما حذفه ويضغط «طلب استعادة» مع ذكر السبب.',
            'مدير المستشفى يرى الطلبات مميزة بإطار أصفر ويضغط «استعادة» فيعود العنصر إلى مكانه.',
          ],
          images: [img('trash', 'سلة المحذوفات كما يراها مدير المستشفى')],
        },
      ],
    },
    {
      id: 'reception',
      role: 'reception',
      title: 'الاستقبال',
      summary: 'تسجيل المرضى وتنويمهم وإعطاء ذويهم رمز العائلة.',
      topics: [
        {
          id: 'search',
          title: 'البحث عن مريض',
          intro: 'في صفحة «المرضى» اكتب في مربع البحث الاسم أو رقم الملف أو الرقم الوطني أو رقم الهاتف. زر «المنوّمون حالياً» يعرض المرضى الموجودين في المستشفى فقط.',
          images: [img('patients', 'قائمة المرضى والبحث')],
          tips: ['ابحث دائماً قبل تسجيل مريض جديد لتجنب تكرار الملف.'],
        },
        {
          id: 'new-patient',
          title: 'تسجيل مريض جديد',
          steps: ['اضغط «مريض جديد».', 'اكتب الاسم الكامل، الجنس، تاريخ الميلاد، الهاتف، الرقم الوطني وفصيلة الدم.', 'أضف الحساسية والتنبيهات الحرجة إن وُجدت (مثل حساسية البنسلين).', 'اضغط «حفظ» — يُعطى المريض رقم ملف تلقائياً.'],
          images: [img('patients-new', 'نموذج تسجيل مريض جديد')],
        },
        {
          id: 'admit',
          title: 'تنويم المريض على سرير',
          steps: ['في قائمة المرضى اضغط «تنويم» بجانب المريض.', 'اختر القسم، ثم الردهة، ثم السرير الشاغر.', 'اختر الطبيب المعالج واكتب سبب الدخول.', 'اضغط «تأكيد التنويم» — يظهر «رمز متابعة العائلة» المكوّن من 6 أرقام.'],
          images: [img('patients-admit', 'نافذة التنويم')],
          tips: ['أعطِ رمز العائلة لذوي المريض واطلب منهم مسح رمز QR على السرير.', 'لطباعة سوار المريض افتح ملفه واضغط «سوار المريض».'],
        },
      ],
    },
    {
      id: 'doctor',
      role: 'doctor',
      title: 'الطبيب',
      summary: 'الملف الطبي، التشخيص، الأدوية، طلب الفحوص، ما يراه ذوو المريض، والخروج.',
      topics: [
        {
          id: 'chart',
          title: 'الملف الطبي',
          intro: 'افتح المريض من «المرضى». في الأعلى بياناته وتنويمه والحساسية، وتحتها تبويبات الملف: نظرة عامة، العلامات الحيوية، التشخيص، ملاحظات الطبيب، التمريض، الأدوية، المختبر، الأشعة، الاستشارات، الإجراءات، المرفقات، الجدول الزمني، والخروج.',
          images: [img('chart-overview', 'نظرة عامة على ملف المريض')],
          tips: ['للمريض تنويمات سابقة؟ اختر التنويم من قائمة «التنويمات» أعلى التبويبات.'],
        },
        {
          id: 'diagnosis',
          title: 'التشخيص والملاحظات',
          steps: ['في تبويب «التشخيص» اضغط الإضافة واكتب التشخيص ورمز ICD-10 (اختياري) وحالته: مشتبه، مؤكد، أو تم علاجه.', 'في «ملاحظات الطبيب» اكتب ملاحظتك اليومية واضغط «إضافة ملاحظة».'],
          images: [img('chart-diagnosis', 'تبويب التشخيص'), img('chart-notes', 'ملاحظات الطبيب')],
          tips: ['يستطيع كاتب الملاحظة فقط تعديلها، ويظهر عليها «عُدّلت».'],
        },
        {
          id: 'meds',
          title: 'وصف الأدوية',
          steps: ['في تبويب «الأدوية» اضغط «وصف دواء».', 'اكتب اسم الدواء والجرعة وطريقة الإعطاء والتكرار وتاريخ البداية.', 'اضغط «حفظ» — يظهر الدواء «بانتظار الصرف» حتى يصرفه الصيدلي.', 'لإيقاف دواء غيّر حالته إلى «موقوف».'],
          images: [img('chart-meds', 'قائمة الأدوية وسجل الإعطاء'), img('chart-meds-new', 'وصف دواء جديد')],
          tips: ['الدواء الذي أُعطيت منه جرعات لا يُحذف — يُوقف فقط.'],
        },
        {
          id: 'orders',
          title: 'طلب التحاليل والأشعة',
          steps: ['في تبويب «المختبر» اضغط «طلب فحص» واكتب اسم الفحص.', 'في تبويب «الأشعة» اضغط «طلب أشعة» واختر نوع الدراسة.', 'يظهر الطلب «معلّق» حتى يُدخل الفني النتيجة، ثم تظهر النتيجة مباشرة في الملف.'],
          images: [img('chart-lab', 'تبويب المختبر'), img('chart-lab-order', 'طلب فحص جديد')],
        },
        {
          id: 'family-share',
          title: 'تحديد ما يراه ذوو المريض',
          steps: ['في شريط «رمز متابعة العائلة» اضغط «تخصيص».', 'فعّل ما تريد مشاركته: العلامات الحيوية، التشخيص، الأدوية، التحاليل، الأشعة، الإجراءات.', 'اكتب رسالة للعائلة إن أردت (مثل مواعيد الزيارة)، ثم «حفظ».'],
          images: [img('family-share', 'نافذة «ما يراه ذوو المريض»')],
          tips: ['تظهر للعائلة النتائج المكتملة فقط، ولا يظهر التشخيص «المشتبه» أبداً.'],
        },
        {
          id: 'print',
          title: 'الطباعة',
          intro: 'زر «طباعة» في ملف المريض يطبع: الملف الطبي كاملاً، تقرير التحاليل، تقرير الأشعة، ملخص الخروج، أو القسم المعروض فقط — على ورق A4 بشعار المستشفى.',
          images: [img('print-menu', 'قائمة الطباعة في ملف المريض')],
        },
        {
          id: 'discharge',
          title: 'خروج المريض',
          steps: ['افتح تبويب «الخروج».', 'اختر نوع الخروج (إلى المنزل، تحويل، وفاة، على مسؤوليته) واكتب ملخص الخروج.', 'اضغط «تسجيل الخروج» — يتحرر السرير ويُلغى رمز العائلة تلقائياً.', 'اطبع «ملخص الخروج» للمريض وللأرشيف.'],
          images: [img('chart-discharge', 'تبويب الخروج')],
        },
      ],
    },
    {
      id: 'nurse',
      role: 'nurse',
      title: 'التمريض',
      summary: 'العلامات الحيوية، الإنذار المبكر، ميزان السوائل، وإعطاء الجرعات.',
      topics: [
        {
          id: 'vitals',
          title: 'تسجيل العلامات الحيوية',
          steps: ['في تبويب «العلامات الحيوية» اضغط «تسجيل علامات جديدة».', 'أدخل الحرارة والنبض والتنفس والأكسجين والضغط، ومقياس الألم ومستوى الوعي.', 'تظهر درجة MEWS أسفل النافذة أثناء الإدخال — اضغط «حفظ».'],
          images: [img('vitals-new', 'نافذة تسجيل العلامات الحيوية'), img('vitals', 'بطاقة الإنذار المبكر، المخطط، وسجل القراءات')],
          tips: ['MEWS من 3 إلى 4: زد تكرار القياس وأبلغ الممرض المسؤول. 5 فأكثر: اطلب تقييماً طبياً عاجلاً.', 'القيم غير الطبيعية تظهر باللون الأحمر.'],
        },
        {
          id: 'fluids',
          title: 'ميزان السوائل',
          steps: ['في نفس التبويب، ببطاقة «ميزان السوائل»، اضغط «سوائل داخلة» أو «سوائل خارجة».', 'اختر النوع (فموي، وريدي، بول، نزح...) والكمية بالمل — أو اضغط أحد الأزرار السريعة.', 'يُحسب الداخل والخارج والصافي لآخر 24 ساعة تلقائياً.'],
          images: [img('fluids-new', 'إضافة سوائل')],
        },
        {
          id: 'mar',
          title: 'إعطاء جرعات الأدوية (MAR)',
          steps: ['افتح تبويب «الأدوية». تحت كل دواء فعّال سجل إعطائه.', 'اضغط «تسجيل جرعة» واختر: أُعطيت، أُجِّلت، أو رفضها المريض.', 'عند التأجيل أو الرفض اكتب السبب، ثم «حفظ».'],
          images: [img('mar', 'سجل الإعطاء تحت كل دواء'), img('mar-dialog', 'نافذة تسجيل الجرعة')],
          tips: ['ينبهك النظام إن لم يُصرف الدواء بعد، أو إن سُجّلت جرعة منه خلال آخر ساعة.', 'أخطأت؟ يمكنك إلغاء إدخالك خلال ساعة من زر × بجانبه.'],
        },
        {
          id: 'offline',
          title: 'العمل عند انقطاع الإنترنت',
          intro: 'إن انقطع الاتصال استمر في تسجيل العلامات الحيوية والسوائل والجرعات: تُحفظ على الجهاز ويظهر أعلى الشاشة «غير متصل · إدخال محفوظ»، وتُرسل تلقائياً عند عودة الاتصال.',
          tips: ['لا تسجّل الخروج على جهاز مشترك قبل إرسال الإدخالات المحفوظة.'],
        },
      ],
    },
    {
      id: 'lab',
      role: 'lab',
      title: 'المختبر والأشعة',
      summary: 'استلام الطلبات، إدخال النتائج، والملصقات.',
      topics: [
        {
          id: 'lab-results',
          title: 'إدخال نتائج التحاليل',
          steps: ['افتح «المختبر» — تظهر الطلبات المعلّقة فقط.', 'اضغط «إدخال النتيجة» بجانب الطلب.', 'اكتب النتيجة والوحدة والمعدل الطبيعي، وعلّم «غير طبيعية» إن لزم، ثم «حفظ».'],
          images: [img('lab-page', 'الطلبات المعلّقة في المختبر'), img('lab-result', 'إدخال النتيجة')],
          tips: ['لطباعة ملصق باركود للأنبوب افتح ملف المريض ← «المختبر» واضغط رمز الملصق بجانب الطلب.'],
        },
        {
          id: 'rad-reports',
          title: 'تقارير الأشعة',
          steps: ['افتح «الأشعة» — تظهر الطلبات المعلّقة.', 'اضغط «إدخال التقرير» واكتب التقرير ثم «حفظ».'],
          images: [img('radiology-page', 'صفحة الأشعة')],
        },
      ],
    },
    {
      id: 'pharmacy',
      role: 'pharmacy',
      title: 'الصيدلية',
      summary: 'صرف الأدوية الموصوفة.',
      topics: [
        {
          id: 'dispense',
          title: 'صرف الأدوية',
          steps: ['افتح «الصيدلية» — تظهر الوصفات بانتظار الصرف.', 'راجع الدواء والجرعة والمريض.', 'اضغط «صرف» — يظهر للطبيب والتمريض «مصروف» مع اسمك ووقت الصرف.'],
          images: [img('pharmacy-page', 'الوصفات بانتظار الصرف')],
        },
      ],
    },
    {
      id: 'family',
      role: 'family',
      title: 'ذوو المريض',
      summary: 'متابعة حالة المريض من الهاتف دون حساب.',
      topics: [
        {
          id: 'track',
          title: 'متابعة المريض عبر رمز QR',
          steps: ['امسح رمز QR الملصق على سرير المريض بكاميرا الهاتف.', 'تظهر معلومات عامة: المستشفى، الردهة، مدة التنويم، والأحرف الأولى من اسم المريض.', 'أدخل «رمز العائلة» (6 أرقام) الذي أعطاك إياه الاستقبال أو التمريض، واضغط «عرض التفاصيل».', 'تظهر المعلومات التي اختار الفريق الطبي مشاركتها ورسالته لكم.'],
          images: [img('track-public', 'ما يظهر لأي شخص يمسح الرمز'), img('track-family', 'التفاصيل بعد إدخال رمز العائلة')],
          tips: ['لا تشارك رمز العائلة مع غير المقربين. يمكن للطاقم إصدار رمز جديد في أي وقت.'],
        },
      ],
    },
    {
      id: 'super',
      role: 'super',
      title: 'المدير العام',
      summary: 'المستشفيات والاشتراكات ومعلومات الدفع.',
      topics: [
        {
          id: 'hospitals',
          title: 'إدارة المستشفيات والاشتراكات',
          steps: [
            'من «المستشفيات» ترى كل المستشفيات وحالة اشتراكها وإشعارات الدفع الجديدة.',
            'اضغط «الاشتراك» على المستشفى: راجع إشعار الدفع، اختر المدة (شهر، 3، 6، 12) أو تاريخاً، ثم «تفعيل / تمديد».',
            'زر «دخول» ينقلك للعمل داخل المستشفى بكل الصلاحيات، و«العودة» يرجعك لمستشفاك.',
            'من «الإعدادات» اضبط «معلومات الدفع» ومحتوى صفحة «من نحن».',
          ],
          images: [img('hospitals', 'صفحة المستشفيات')],
        },
      ],
    },
  ],
  faqTitle: 'أسئلة شائعة',
  faq: [
    { q: 'نسيت كلمة المرور، ماذا أفعل؟', a: 'اطلب من مدير المستشفى إعادة تعيينها من صفحة «المستخدمون». مدير المستشفى نفسه يطلبها من المدير العام.' },
    { q: 'حذفت شيئاً بالخطأ، هل يمكن استعادته؟', a: 'نعم. افتح «المحذوفات» واضغط «طلب استعادة»، وسيستعيده مدير المستشفى.' },
    { q: 'لماذا لا أرى بعض الصفحات أو الأزرار؟', a: 'تظهر لكل موظف الصفحات والأزرار الخاصة بدوره فقط. إن احتجت صلاحية إضافية راجع مدير المستشفى.' },
    { q: 'انقطع الإنترنت أثناء العمل، هل ضاعت البيانات؟', a: 'العلامات الحيوية والسوائل والجرعات تُحفظ على الجهاز وتُرسل تلقائياً عند عودة الاتصال (خلال 48 ساعة).' },
    { q: 'مسحتُ رمز QR فظهرت صفحة تسجيل الدخول؟', a: 'الجهاز يعرض نسخة قديمة محفوظة من الموقع. افتح الموقع مرة وأعد تحميل الصفحة، ثم امسح الرمز مجدداً.' },
    { q: 'كيف أغيّر لغة النظام؟', a: 'اضغط زر EN / ع في الشريط العلوي، أو من «الإعدادات» ← اللغة.' },
  ],
};

export const GUIDE_EN: GuideContent = {
  title: 'User guide',
  subtitle: 'An illustrated step-by-step walkthrough of everything you need — pick your role or search for a task.',
  searchPlaceholder: 'Search: admit, vitals, report, password...',
  roles: { all: 'All', admin: 'Hospital admin', reception: 'Reception', doctor: 'Doctor', nurse: 'Nursing', lab: 'Lab & radiology', pharmacy: 'Pharmacy', family: 'Family', super: 'Super admin' },
  tipLabel: 'Tip',
  noResults: 'No results — try another word.',
  chapters: [
    {
      id: 'start',
      role: 'all',
      title: 'Getting started',
      summary: 'Signing in and finding your way around.',
      topics: [
        {
          id: 'login',
          title: 'Signing in',
          steps: ['Open the system link in your browser (computer or phone).', 'Enter the username and password your hospital admin gave you.', 'Press “Sign in”.'],
          images: [img('login', 'Sign-in page')],
          tips: ['If you see “Too many attempts”, wait 15 minutes and try again.', 'No account? Ask your hospital admin. Representing a new hospital? Use “Register your hospital”.'],
        },
        {
          id: 'layout',
          title: 'The interface',
          intro: 'The sidebar shows only the pages available to your role. The top bar shows the hospital name, the language button (EN/ع), dark mode and your account menu (settings and sign out).',
          images: [img('dashboard', "Dashboard: today's numbers, early warnings, ward occupancy and recent activity")],
          tips: ['On phones, open the menu with ☰ at the top; the main pages are in the bottom bar.', 'You can install the system as an app: in the browser menu choose “Add to Home screen”.'],
        },
        {
          id: 'password',
          title: 'Changing your password',
          steps: ['From your account menu choose “Settings”.', 'In “Change password” enter the current password and the new one twice.', 'Press “Save”.'],
          tips: ['At least 8 characters with letters and digits.', 'Forgot it? The hospital admin can reset it from the Users page.'],
        },
      ],
    },
    {
      id: 'admin',
      role: 'admin',
      title: 'Hospital admin',
      summary: 'Setting up the hospital, users, departments and beds, subscription, reports and trash.',
      topics: [
        {
          id: 'signup',
          title: 'Registering a new hospital (free trial)',
          steps: ['On the sign-in page press “Register your hospital — free for 14 days”.', 'Fill in the hospital details, then your admin details (name, phone, username, password).', 'Press “Start free trial” — you are signed in as your hospital admin.'],
          images: [img('signup', 'New hospital registration form')],
          tips: ['A bar at the top shows the trial days left.'],
        },
        {
          id: 'logo',
          title: 'Hospital name and logo',
          steps: ['Open “Settings”.', 'In the “Hospital” card press ✎ to edit the name.', 'In “Hospital logo” press “Upload logo” and choose a PNG or JPEG image (up to 300 KB).'],
          images: [img('settings-logo', 'Hospital card and logo in settings')],
          tips: ['The logo appears in the sidebar, the family page and all printouts.'],
        },
        {
          id: 'structure',
          title: 'Departments, wards and beds',
          steps: ['In “Departments” add the hospital departments.', 'In “Wards & beds” press “Add ward” and choose its department.', 'Inside the ward add beds (room and bed number).', 'Click any bed to see its status, edit it and print its QR code.'],
          images: [img('departments', 'Departments'), img('wards', 'Wards, beds and occupancy'), img('wards-bed', 'Bed window: patient, management and family QR code')],
          tips: ['Print each bed’s QR code and stick it on the bed — families scan it to follow the patient.', '“Vacate bed” only detaches the patient from the bed; it does not discharge them.'],
        },
        {
          id: 'users',
          title: 'Adding staff and roles',
          steps: ['Open “Users” and press “New user”.', 'Enter username, password and full name.', 'Choose the role: doctor, nurse, lab, radiology, pharmacist, reception or viewer.', 'Press “Save” and give the staff member their username and password.'],
          images: [img('users', 'Users list'), img('users-new', 'Adding a user and choosing the role')],
          tips: ['The role decides what the person sees and can do — see “About the system” for the permissions table.', 'Deactivate the account of someone who left instead of deleting it.'],
        },
        {
          id: 'billing',
          title: 'Subscription and payment',
          steps: ['Open “Subscription” to see the status and payment details.', 'Pay using the stated method.', 'Fill in “Report a payment” (amount, method, reference) and press “Send payment notice”.', 'After the system admin verifies it, the subscription is activated and the notice shows “Approved”.'],
          images: [img('billing', 'Subscription & payment page')],
          tips: ['When the subscription ends, all data is kept but only the payment page is available until renewal.'],
        },
        {
          id: 'reports',
          title: 'Reports and Excel export',
          steps: ['Open “Reports” and pick the report at the top (admissions, discharges, current inpatients, labs...).', 'Pick the period or a custom range, and optionally filter by department or doctor.', 'Press “Export Excel” to download, or “Print” for an A4 printout with the hospital logo.'],
          images: [img('reports', 'Admissions register with summary and table')],
          tips: ['“Current inpatients” is very useful for shift handover.'],
        },
        {
          id: 'audit',
          title: 'Audit log',
          intro: 'Every action is recorded: who opened a chart, who edited or deleted what, and when. Open “Audit log” to review.',
          images: [img('audit', 'Audit log')],
        },
        {
          id: 'trash',
          title: 'Trash and restore',
          steps: ['Nothing is deleted permanently — deleted items go to “Trash”.', 'Staff see what they deleted and press “Request restore” with a reason.', 'The hospital admin sees requests highlighted in yellow and presses “Restore”.'],
          images: [img('trash', 'Trash as seen by the hospital admin')],
        },
      ],
    },
    {
      id: 'reception',
      role: 'reception',
      title: 'Reception',
      summary: 'Registering and admitting patients and giving families the family PIN.',
      topics: [
        {
          id: 'search',
          title: 'Finding a patient',
          intro: 'On “Patients” search by name, file number, national ID or phone. “Currently admitted” shows only patients in the hospital now.',
          images: [img('patients', 'Patients list and search')],
          tips: ['Always search before registering a new patient to avoid duplicate files.'],
        },
        {
          id: 'new-patient',
          title: 'Registering a new patient',
          steps: ['Press “New patient”.', 'Enter full name, gender, date of birth, phone, national ID and blood type.', 'Add allergies and critical alerts if any.', 'Press “Save” — a file number is assigned automatically.'],
          images: [img('patients-new', 'New patient form')],
        },
        {
          id: 'admit',
          title: 'Admitting a patient to a bed',
          steps: ['Press “Admit” next to the patient.', 'Choose the department, then the ward, then a free bed.', 'Choose the attending doctor and enter the reason.', 'Press “Confirm admission” — the 6-digit family PIN appears.'],
          images: [img('patients-admit', 'Admission window')],
          tips: ['Give the family PIN to the relatives and ask them to scan the QR code on the bed.', 'To print the wristband open the chart and press “Wristband”.'],
        },
      ],
    },
    {
      id: 'doctor',
      role: 'doctor',
      title: 'Doctor',
      summary: 'Chart, diagnoses, medications, orders, family view and discharge.',
      topics: [
        {
          id: 'chart',
          title: 'The medical chart',
          intro: 'Open the patient from “Patients”. At the top are their details, admission and allergies; below are the chart tabs: overview, vitals, diagnosis, doctor notes, nursing, medications, lab, radiology, consultations, procedures, attachments, timeline and discharge.',
          images: [img('chart-overview', 'Chart overview')],
          tips: ['Previous admissions? Pick one from the “Admissions” list above the tabs.'],
        },
        {
          id: 'diagnosis',
          title: 'Diagnoses and notes',
          steps: ['In “Diagnosis” add the diagnosis, optional ICD-10 code and status (suspected, confirmed, resolved).', 'In “Doctor notes” write your note and press “Add note”.'],
          images: [img('chart-diagnosis', 'Diagnosis tab'), img('chart-notes', 'Doctor notes')],
          tips: ['Only the author can edit a note; edited notes are marked.'],
        },
        {
          id: 'meds',
          title: 'Prescribing medications',
          steps: ['In “Medications” press “Prescribe medication”.', 'Enter name, dose, route, frequency and start date.', 'Press “Save” — it shows “Awaiting dispensing” until the pharmacist dispenses it.', 'To stop a medication change its status to “Discontinued”.'],
          images: [img('chart-meds', 'Medications and administration record'), img('chart-meds-new', 'New prescription')],
          tips: ['A medication with recorded doses cannot be deleted — only discontinued.'],
        },
        {
          id: 'orders',
          title: 'Ordering labs and imaging',
          steps: ['In “Laboratory” press “Order test” and enter the test name.', 'In “Radiology” press “Order imaging”.', 'The order stays “Pending” until the technician enters the result, which then appears in the chart.'],
          images: [img('chart-lab', 'Laboratory tab'), img('chart-lab-order', 'New lab order')],
        },
        {
          id: 'family-share',
          title: 'Choosing what the family sees',
          steps: ['In the family PIN strip press “Customize”.', 'Enable what to share: vitals, diagnosis, medications, labs, radiology, procedures.', 'Optionally write a message to the family, then “Save”.'],
          images: [img('family-share', '“What the family can see” window')],
          tips: ['Only completed records are shown, and suspected diagnoses never are.'],
        },
        {
          id: 'print',
          title: 'Printing',
          intro: 'The chart’s “Print” button prints the full record, the lab report, the radiology report, the discharge summary, or just the current section — on A4 with the hospital logo.',
          images: [img('print-menu', 'Print menu in the chart')],
        },
        {
          id: 'discharge',
          title: 'Discharging a patient',
          steps: ['Open the “Discharge” tab.', 'Choose the discharge type and write the summary.', 'Press “Record discharge” — the bed is freed and the family PIN is cancelled.', 'Print the discharge summary for the patient and the archive.'],
          images: [img('chart-discharge', 'Discharge tab')],
        },
      ],
    },
    {
      id: 'nurse',
      role: 'nurse',
      title: 'Nursing',
      summary: 'Vitals, early warning, fluid balance and giving doses.',
      topics: [
        {
          id: 'vitals',
          title: 'Recording vitals',
          steps: ['In “Vitals” press “Record new vitals”.', 'Enter temperature, pulse, respiration, SpO₂, blood pressure, pain score and consciousness.', 'The MEWS score appears as you type — press “Save”.'],
          images: [img('vitals-new', 'Recording vitals'), img('vitals', 'Early-warning card, chart and readings')],
          tips: ['MEWS 3–4: observe more often and inform the nurse in charge. 5+: request urgent medical review.', 'Abnormal values are shown in red.'],
        },
        {
          id: 'fluids',
          title: 'Fluid balance',
          steps: ['In the “Fluid balance” card press “Intake” or “Output”.', 'Choose the type and volume in mL — or tap a quick amount.', 'Intake, output and net for the last 24 hours are calculated automatically.'],
          images: [img('fluids-new', 'Adding fluids')],
        },
        {
          id: 'mar',
          title: 'Giving medication doses (MAR)',
          steps: ['Open “Medications”; each active medication shows its administration record.', 'Press “Record dose” and choose: given, held or refused.', 'For held or refused doses enter the reason, then “Save”.'],
          images: [img('mar', 'Administration record under each medication'), img('mar-dialog', 'Recording a dose')],
          tips: ['You are warned if the medication has not been dispensed or a dose was recorded within the last hour.', 'Made a mistake? Remove your entry within one hour with the × next to it.'],
        },
        {
          id: 'offline',
          title: 'Working without internet',
          intro: 'If the connection drops, keep recording vitals, fluids and doses: they are saved on the device, the top bar shows “Offline · entry saved”, and they are sent automatically when the connection returns.',
          tips: ['On a shared device, do not sign out before saved entries are sent.'],
        },
      ],
    },
    {
      id: 'lab',
      role: 'lab',
      title: 'Lab & radiology',
      summary: 'Receiving orders, entering results and labels.',
      topics: [
        {
          id: 'lab-results',
          title: 'Entering lab results',
          steps: ['Open “Laboratory” — only pending orders are shown.', 'Press “Enter result”.', 'Enter the result, unit and reference range, mark “abnormal” if needed, then “Save”.'],
          images: [img('lab-page', 'Pending lab orders'), img('lab-result', 'Entering a result')],
          tips: ['To print a specimen barcode label open the chart → Laboratory and press the label icon next to the order.'],
        },
        {
          id: 'rad-reports',
          title: 'Radiology reports',
          steps: ['Open “Radiology” — pending orders are shown.', 'Press “Enter report”, write it and “Save”.'],
          images: [img('radiology-page', 'Radiology page')],
        },
      ],
    },
    {
      id: 'pharmacy',
      role: 'pharmacy',
      title: 'Pharmacy',
      summary: 'Dispensing prescribed medications.',
      topics: [
        {
          id: 'dispense',
          title: 'Dispensing medications',
          steps: ['Open “Pharmacy” — prescriptions awaiting dispensing are shown.', 'Check the medication, dose and patient.', 'Press “Dispense” — doctors and nurses then see “Dispensed” with your name and time.'],
          images: [img('pharmacy-page', 'Prescriptions awaiting dispensing')],
        },
      ],
    },
    {
      id: 'family',
      role: 'family',
      title: 'Families',
      summary: 'Following the patient from a phone without an account.',
      topics: [
        {
          id: 'track',
          title: 'Following the patient with the QR code',
          steps: ['Scan the QR code on the patient’s bed with the phone camera.', 'General information appears: hospital, ward, length of stay and the patient’s initials.', 'Enter the 6-digit family PIN from reception or nursing and press “Show details”.', 'You see what the care team chose to share and their message.'],
          images: [img('track-public', 'What anyone who scans the code sees'), img('track-family', 'Details after entering the family PIN')],
          tips: ['Share the family PIN only with close relatives. Staff can issue a new PIN at any time.'],
        },
      ],
    },
    {
      id: 'super',
      role: 'super',
      title: 'Super admin',
      summary: 'Hospitals, subscriptions and payment details.',
      topics: [
        {
          id: 'hospitals',
          title: 'Managing hospitals and subscriptions',
          steps: [
            '“Hospitals” lists every hospital with its subscription status and new payment notices.',
            'Press “Subscription” on a hospital: review the payment notice, pick the period (1, 3, 6, 12 months) or a date, then “Activate / extend”.',
            '“Enter” lets you work inside the hospital with full permissions; “Back” returns you.',
            'In “Settings” set the payment details and the “About us” content.',
          ],
          images: [img('hospitals', 'Hospitals page')],
        },
      ],
    },
  ],
  faqTitle: 'Frequently asked questions',
  faq: [
    { q: 'I forgot my password. What now?', a: 'Ask your hospital admin to reset it from the Users page. The hospital admin asks the super admin.' },
    { q: 'I deleted something by mistake. Can it be restored?', a: 'Yes. Open “Trash” and press “Request restore”; the hospital admin will restore it.' },
    { q: "Why can't I see some pages or buttons?", a: 'Each person sees only the pages and buttons for their role. Ask your hospital admin if you need more access.' },
    { q: 'The internet dropped while working. Is data lost?', a: 'Vitals, fluids and doses are saved on the device and sent automatically when the connection returns (within 48 hours).' },
    { q: 'I scanned the QR code and got the sign-in page?', a: 'The device is showing an old cached copy of the site. Open the site once, reload, then scan again.' },
    { q: 'How do I change the language?', a: 'Press EN / ع in the top bar, or Settings → Language.' },
  ],
};
