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
/** صور الدليل الإنجليزي مأخوذة من الواجهة الإنجليزية */
const imgEn = (src: string, caption: string) => ({ src: `/guide/en/${src}.jpg`, caption });

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
          tips: [
            'كلمة المرور 8 أحرف على الأقل، حروف وأرقام، ولا تحتوي اسم المستخدم أو كلمة شائعة.',
            'إن كانت كلمتك مؤقتة (وضعها المدير) أو ضعيفة يطلب منك النظام تغييرها قبل أي عمل.',
            'نسيت كلمة المرور؟ مدير المستشفى يعيد تعيينها من صفحة «المستخدمون».',
          ],
        },
        {
          id: 'alerts',
          title: 'التنبيهات المكتوبة والمسموعة',
          intro: 'عند حدث مهم يخصك (نتيجة غير طبيعية، إنذار مبكر MEWS، طلب فحص أو دواء جديد، طلب استعادة) يصلك تنبيه فوراً: بطاقة مكتوبة أسفل الشاشة مع صوت، ويزيد عدّاد الجرس 🔔 أعلى الشاشة.',
          steps: [
            'التنبيه العادي والمهم: بطاقة تختفي بعد ثوانٍ — اضغطها لفتح ملف المريض.',
            'التنبيه الحرج (مثل MEWS ≥ 7): شريط أحمر أعلى الشاشة وصوت يتكرر كل 20 ثانية حتى تضغط «اطّلعت».',
            'كل التنبيهات تبقى في الجرس 14 يوماً؛ «تعليم الكل كمقروء» يصفّر العدّاد.',
            'من «الإعدادات» ← «التنبيهات المسموعة والمكتوبة»: الصوت ومستواه، الاهتزاز، وإشعارات الجهاز. جرّب كل صوت بزر «تجربة».',
          ],
          images: [img('alerts', 'تنبيه حرج أعلى الشاشة وتنبيه نتيجة غير طبيعية أسفلها'), img('alerts-settings', 'إعدادات التنبيهات')],
          tips: [
            'المتصفح لا يسمح بالصوت قبل أول نقرة على الصفحة — انقر أي مكان بعد فتح النظام، أو اضغط «تشغيل الصوت» إن ظهر.',
            'فعّل «إشعارات الجهاز» لتصلك التنبيهات حتى والنافذة مصغّرة أو على الهاتف.',
            'اترك صوت الحاسوب مفعّلاً في محطة التمريض.',
          ],
        },
        {
          id: 'install-push',
          title: 'ثبّت النظام وفعّل الإشعارات (حتى والنظام مغلق)',
          intro: 'ثبّت Q VIREXA على الشاشة الرئيسية لهاتفك أو على سطح مكتب حاسوبك، ثم فعّل الإشعارات: تصلك مواعيد جرعات وقياسات مرضاك، والنتائج غير الطبيعية، والإنذار المبكر، وطلبات التسليم — حتى والنظام مغلق والهاتف مقفل.',
          steps: [
            'أندرويد: افتح النظام في Chrome ← القائمة ⋮ ← «تثبيت التطبيق» (أو اضغط «ثبّت الآن» في الشريط أعلى النظام).',
            'آيفون وآيباد: افتح النظام في Safari ← زر المشاركة ⬆︎ ← «إضافة إلى الشاشة الرئيسية» ← «إضافة»، ثم افتحه من أيقونته. على آيفون لا تعمل الإشعارات إلا بهذه الطريقة (iOS 16.4 فأحدث).',
            'الحاسوب (Chrome أو Edge): رمز التثبيت ⊕ في شريط العنوان، أو القائمة ⋮ ← «تثبيت Q VIREXA». يفتح بعدها في نافذته الخاصة كبرنامج.',
            'بعد التثبيت: «الإعدادات» ← «هذا الجهاز: التثبيت والإشعارات» ← «فعّل الإشعارات» ← «السماح». ثم «أرسل إشعاراً تجريبياً» للتأكد.',
            'اختر ما يصلك: كل التنبيهات، أو المهمة والحرجة، أو الحرجة فقط.',
          ],
          tips: [
            'الإشعار على شاشة القفل لا يحمل اسم المريض — العنوان وموقع السرير فقط، والتفاصيل داخل النظام بعد الدخول.',
            'الإشعارات مرتبطة بالموظف وجهازه: عند تسجيل الخروج تتوقف على ذلك الجهاز، ومن يسجّل عليه بعدك تصله إشعاراته هو.',
            'مواعيد الجرعات والقياسات تصل للممرض المعيَّن على المريض فقط؛ بعد التسليم تنتقل للممرض المستلم.',
            'بعض هواتف أندرويد توقف التطبيقات في الخلفية: اجعل Chrome أو Q VIREXA «بلا قيود» في إعدادات البطارية.',
          ],
        },
        {
          id: 'security',
          title: 'حماية حسابك: التحقق بخطوتين والخروج التلقائي',
          steps: [
            'من «الإعدادات» ← «التحقق بخطوتين» اضغط «تفعيل التحقق بخطوتين».',
            'امسح الرمز بتطبيق Google Authenticator أو Microsoft Authenticator، ثم اكتب الرمز المكوّن من 6 أرقام.',
            'احفظ رموز الاسترداد الثمانية (نسخ أو تنزيل) في مكان آمن.',
            'عند الدخول بعدها: كلمة المرور ثم الرمز من التطبيق.',
          ],
          images: [img('twofa-setup', 'إعداد التحقق بخطوتين')],
          tips: [
            'فقدت هاتفك؟ ادخل برمز استرداد، أو اطلب من مدير المستشفى «إعادة ضبط التحقق بخطوتين».',
            'يخرج النظام تلقائياً بعد 30 دقيقة بلا نشاط (مع تنبيه قبل دقيقة) لحماية الأجهزة المشتركة.',
          ],
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
          id: 'my-patients',
          title: 'مرضاي وفريق الرعاية',
          intro: 'يرى الطبيب مرضاه فقط: من هو في فريق رعايتهم (حالياً أو سابقاً). يمكن أن يكون للمريض أكثر من طبيب بتخصصات مختلفة، وأحدهم «رئيسي» (الطبيب المعالج).',
          steps: [
            'بطاقة «فريق الرعاية» أعلى ملف المريض تعرض الأطباء وتخصصاتهم والممرض المسؤول.',
            'لإضافة طبيب استشاري اضغط «إضافة طبيب» واختر الطبيب واكتب تخصصه.',
            'إن فتحت مريضاً ليس من مرضاك تظهر رسالة «ليس ضمن مرضاك». في الطوارئ اكتب السبب واضغط «فتح الملف (وصول طارئ)» — يُفتح 12 ساعة ويُبلَّغ مدير المستشفى.',
          ],
          images: [img('careteam', 'فريق الرعاية في ملف المريض'), img('not-yours', 'مريض ليس من مرضاك والوصول الطارئ')],
          tips: ['الاستقبال يحدد الطبيب المعالج عند التنويم، فيصبح المريض ضمن مرضاه تلقائياً.'],
        },
        {
          id: 'care-plan',
          title: 'الخطة العلاجية',
          steps: [
            'افتح تبويب «الخطة العلاجية» واضغط «وضع الخطة».',
            'اكتب الأهداف، النظام الغذائي، الحركة، المراقبة، وتعليمات التمريض، وحدد تكرار قياس العلامات الحيوية وتاريخ المراجعة.',
            'يُبلَّغ الممرض المسؤول فوراً بأي تحديث، وتظهر التعليمات في صفحة تسليم المناوبة.',
          ],
          images: [img('care-plan', 'الخطة العلاجية')],
          tips: ['تكرار القياس يُقصَّر تلقائياً إن ارتفع MEWS (متوسط: كل ساعتين، مرتفع: كل ساعة).'],
        },
        {
          id: 'meds',
          title: 'وصف الأدوية',
          steps: ['في تبويب «الأدوية» اضغط «وصف دواء».', 'اكتب اسم الدواء والجرعة وطريقة الإعطاء والتكرار وتاريخ البداية.', 'اضغط «حفظ» — يظهر الدواء «بانتظار الصرف» حتى يصرفه الصيدلي.', 'لإيقاف دواء غيّر حالته إلى «موقوف».'],
          images: [img('chart-meds', 'قائمة الأدوية وسجل الإعطاء'), img('chart-meds-new', 'وصف دواء جديد')],
          tips: [
            'اكتب التكرار بصيغة مفهومة (كل 8 ساعات، مرتين يومياً، صباحاً، عند الحاجة) — يظهر تحت الحقل كيف ستُجدول الجرعات.',
            'إن تعارض الدواء مع حساسية مسجلة للمريض (أو فئة قريبة منها) يظهر تحذير أحمر ولا يُحفظ إلا بكتابة سبب التجاوز.',
            'الدواء الذي أُعطيت منه جرعات لا يُحذف — يُوقف فقط.',
          ],
        },
        {
          id: 'allergy',
          title: 'تحذير الحساسية عند الوصف',
          intro: 'يقارن النظام الدواء بحساسيات المريض أثناء الكتابة: نفس الفئة (مثل البنسلين وأوجمنتين) أو تفاعل متصالب (مثل البنسلين والسيفالوسبورين).',
          images: [img('allergy-warning', 'تحذير حساسية أثناء وصف الدواء')],
          tips: ['سبب التجاوز يُحفظ مع الدواء ويظهر للصيدلي والتمريض، ويُسجَّل في سجل التدقيق.', 'التحذير مساعد وليس بديلاً عن مراجعة الطبيب والصيدلي.'],
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
          id: 'rounds',
          title: 'مرضاي وجولة التمريض',
          intro: 'كل مريض له ممرض مسؤول واحد فقط. «مرضاي» يعرض مرضاك المعيَّنين، و«كل الردهة» يعرض الجميع.',
          steps: [
            'مريض غير معيَّن؟ افتح ملفه واضغط «استلام المريض».',
            'افتح «جولة التمريض»: تبويب «العلامات الحيوية» يعرض موعد القياس التالي لكل مريض (حسب الخطة العلاجية وMEWS)، وتبويب «الأدوية» يعرض الجرعات المتأخرة والمستحقة.',
            'اضغط «تسجيل القياس» لفتح العلامات الحيوية مباشرة، و«أُعطيت» أو «لم تُعطَ» للجرعات.',
            'عند حلول موعد جرعة أو قياس لمرضاك يصلك تنبيه مكتوب مع صوت، وتنبيه آخر إن تأخر.',
          ],
          images: [img('rounds', 'جولة التمريض: العلامات الحيوية')],
          tips: ['«تكرار غير محدد» في الأدوية يعني أن الطبيب كتب التكرار بصيغة غير مفهومة — راجعه لتعديلها.'],
        },
        {
          id: 'nurse-handover',
          title: 'التسليم والاستلام بين الممرضين',
          steps: [
            'قبل نهاية مناوبتك اكتب ملاحظة SBAR لكل مريض من «تسليم المناوبة» ← «ملخص المرضى».',
            'في تبويب «التسليم والاستلام» اختر مرضاك والممرض المستلم واكتب ملاحظة، ثم اضغط «تسليم».',
            'تبقى أنت المسؤول حتى يراجع زميلك المرضى ويضغط «استلام» — عندها تنتقل المسؤولية إليه. يمكنه «رفض» مع ذكر السبب.',
          ],
          images: [img('nurse-handover', 'طلب استلام وارد وتسليم المرضى')],
          tips: ['لا يمكن تعيين ممرضين على نفس المريض؛ النقل يتم فقط بالتسليم والاستلام (أو بواسطة مدير المستشفى).'],
        },
        {
          id: 'handover',
          title: 'تسليم المناوبة',
          steps: [
            'افتح «تسليم المناوبة» واختر ردهتك: لكل مريض ملخص بالتشخيص والحساسية وآخر علامات حيوية وMEWS والطلبات المعلقة.',
            'اضغط «كتابة التسليم» واكتب بصيغة SBAR: الوضع الحالي، الخلفية، التقييم، والتوصيات للمناوبة القادمة.',
            'اضغط «طباعة ورقة التسليم» لنسخة ورقية يوقّع عليها المسلِّم والمستلِم.',
          ],
          images: [img('handover', 'صفحة تسليم المناوبة'), img('handover-sbar', 'كتابة ملاحظة التسليم')],
          tips: ['الملاحظة الأقدم من 12 ساعة تُعلَّم «أقدم من 12 ساعة» لتذكيرك بتحديثها.'],
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
          tips: ['زر «تسجيل جديد هذا الأسبوع» يعرض المستشفيات المسجّلة ذاتياً حديثاً مع بيانات التواصل لمتابعتها.'],
        },
        {
          id: 'system-health',
          title: 'صحة النظام والنسخ الاحتياطي',
          steps: [
            'افتح «صحة النظام»: حالة قاعدة البيانات، آخر نسخة احتياطية، أخطاء آخر 24 ساعة، والجلسات النشطة.',
            'النسخ الاحتياطي تلقائي يومياً؛ اضغط «نسخة احتياطية الآن» قبل أي تغيير كبير، ونزّل نسخة دورياً واحفظها خارج الخادم.',
            'سجل الأخطاء يجمع أخطاء الخادم والواجهة — افتح أي خطأ لتفاصيله.',
          ],
          images: [img('system-health', 'صفحة صحة النظام')],
          tips: [
            'مدير كل مستشفى يستطيع تنزيل كل بيانات مستشفاه من «الإعدادات» ← «تصدير بيانات المستشفى».',
            'قبل تسليم النظام للمستشفيات: «حذف البيانات التجريبية» في صحة النظام (مع نسخة احتياطية تلقائية). ولحذف مستشفى تجريبي: «حذف نهائي» في صفحة المستشفيات.',
          ],
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
    { q: 'لا أسمع صوت التنبيهات؟', a: 'انقر أي مكان في الصفحة بعد فتح النظام (المتصفح يمنع الصوت قبل ذلك)، وتأكد أن الصوت مفعّل في «الإعدادات» ← «التنبيهات» وفي الحاسوب نفسه. جرّب زر «تجربة: حرج».' },
    { q: 'فقدت هاتفي وعليه تطبيق التحقق بخطوتين؟', a: 'ادخل بأحد رموز الاسترداد بدل رمز التطبيق، أو اطلب من مدير المستشفى إعادة ضبط التحقق بخطوتين لحسابك.' },
    { q: 'كيف أغيّر لغة النظام؟', a: 'اضغط زر EN / ع في الشريط العلوي، أو من «الإعدادات» ← اللغة.' },
    { q: 'كيف أتواصل مع الدعم الفني أو مطوّر النظام؟', a: 'تطوير: قاسم محمد — البريد qasimmohamed14@gmail.com — الهاتف وواتساب ‎+964 774 477 7950. لمشكلات الحسابات والصلاحيات راجع مدير مستشفاك أولاً.' },
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
          images: [imgEn('login', 'Sign-in page')],
          tips: ['If you see “Too many attempts”, wait 15 minutes and try again.', 'No account? Ask your hospital admin. Representing a new hospital? Use “Register your hospital”.'],
        },
        {
          id: 'layout',
          title: 'The interface',
          intro: 'The sidebar shows only the pages available to your role. The top bar shows the hospital name, the language button (EN/ع), dark mode and your account menu (settings and sign out).',
          images: [imgEn('dashboard', "Dashboard: today's numbers, early warnings, ward occupancy and recent activity")],
          tips: ['On phones, open the menu with ☰ at the top; the main pages are in the bottom bar.', 'You can install the system as an app: in the browser menu choose “Add to Home screen”.'],
        },
        {
          id: 'password',
          title: 'Changing your password',
          steps: ['From your account menu choose “Settings”.', 'In “Change password” enter the current password and the new one twice.', 'Press “Save”.'],
          tips: [
            'Passwords need at least 8 characters, letters and digits, and must not contain your username or a common word.',
            'If your password is temporary (set by the admin) or weak, the system asks you to change it before anything else.',
            'Forgot your password? The hospital admin resets it from the Users page.',
          ],
        },
        {
          id: 'alerts',
          title: 'Sound and on-screen alerts',
          intro: 'When something important for you happens (abnormal result, MEWS early warning, new lab or medication order, restore request) you are alerted at once: a written card at the bottom of the screen with a sound, and the bell 🔔 counter goes up.',
          steps: [
            'Normal and important alerts: a card that disappears after a few seconds — click it to open the patient chart.',
            'Critical alerts (e.g. MEWS ≥ 7): a red bar at the top of the screen and a sound repeated every 20 seconds until you press Acknowledge.',
            'All alerts stay in the bell for 14 days; "Mark all as read" clears the counter.',
            'In Settings → "Sound and on-screen alerts": sound and volume, vibration and device notifications. Try each sound with the Test buttons.',
          ],
          images: [imgEn('alerts', 'A critical alert at the top and an abnormal-result alert at the bottom'), imgEn('alerts-settings', 'Alert settings')],
          tips: [
            'Browsers block sound until the first click on the page — click anywhere after opening the system, or press "Turn on sound" if it appears.',
            'Turn on "Device notifications" to receive alerts even when the window is minimised or on your phone.',
            'Keep the computer sound on at the nursing station.',
          ],
        },
        {
          id: 'install-push',
          title: 'Install the system and turn on notifications (even when it is closed)',
          intro: 'Install Q VIREXA on your phone home screen or your computer desktop, then turn on notifications: dose and vitals times for your patients, abnormal results, early warnings and handover requests reach you even when the system is closed and the phone is locked.',
          steps: [
            'Android: open the system in Chrome → menu ⋮ → “Install app” (or press “Install now” in the bar at the top of the system).',
            'iPhone and iPad: open the system in Safari → Share ⬆︎ → “Add to Home Screen” → “Add”, then open it from its icon. On iPhone, notifications work only this way (iOS 16.4 or later).',
            'Computer (Chrome or Edge): the install icon ⊕ in the address bar, or menu ⋮ → “Install Q VIREXA”. It then opens in its own window like a program.',
            'After installing: Settings → “This device: install and notifications” → “Turn on notifications” → “Allow”. Then “Send a test notification” to check.',
            'Choose what reaches you: all alerts, important and critical, or critical only.',
          ],
          tips: [
            'A lock-screen notification never shows the patient name — only the title and bed location; details stay inside the system after sign-in.',
            'Notifications belong to the staff member and their device: signing out turns them off on that device, and whoever signs in next gets their own.',
            'Dose and vitals times go only to the nurse assigned to the patient; after a handover they move to the receiving nurse.',
            'Some Android phones stop background apps: set Chrome or Q VIREXA to “No restrictions” in the battery settings.',
          ],
        },
        {
          id: 'security',
          title: 'Protect your account: 2-step verification and automatic sign-out',
          steps: [
            'In Settings → "2-step verification" press "Turn on 2-step verification".',
            'Scan the code with Google Authenticator or Microsoft Authenticator, then type the 6-digit code.',
            'Keep the 8 recovery codes (copy or download) somewhere safe.',
            'From then on, sign in with your password and then the code from the app.',
          ],
          images: [imgEn('twofa-setup', 'Setting up 2-step verification')],
          tips: [
            'Lost your phone? Sign in with a recovery code, or ask the hospital admin to "Reset 2-step verification".',
            'The system signs you out after 30 minutes without activity (with a warning a minute before) to protect shared computers.',
          ],
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
          images: [imgEn('signup', 'New hospital registration form')],
          tips: ['A bar at the top shows the trial days left.'],
        },
        {
          id: 'logo',
          title: 'Hospital name and logo',
          steps: ['Open “Settings”.', 'In the “Hospital” card press ✎ to edit the name.', 'In “Hospital logo” press “Upload logo” and choose a PNG or JPEG image (up to 300 KB).'],
          images: [imgEn('settings-logo', 'Hospital card and logo in settings')],
          tips: ['The logo appears in the sidebar, the family page and all printouts.'],
        },
        {
          id: 'structure',
          title: 'Departments, wards and beds',
          steps: ['In “Departments” add the hospital departments.', 'In “Wards & beds” press “Add ward” and choose its department.', 'Inside the ward add beds (room and bed number).', 'Click any bed to see its status, edit it and print its QR code.'],
          images: [imgEn('departments', 'Departments'), imgEn('wards', 'Wards, beds and occupancy'), imgEn('wards-bed', 'Bed window: patient, management and family QR code')],
          tips: ['Print each bed’s QR code and stick it on the bed — families scan it to follow the patient.', '“Vacate bed” only detaches the patient from the bed; it does not discharge them.'],
        },
        {
          id: 'users',
          title: 'Adding staff and roles',
          steps: ['Open “Users” and press “New user”.', 'Enter username, password and full name.', 'Choose the role: doctor, nurse, lab, radiology, pharmacist, reception or viewer.', 'Press “Save” and give the staff member their username and password.'],
          images: [imgEn('users', 'Users list'), imgEn('users-new', 'Adding a user and choosing the role')],
          tips: ['The role decides what the person sees and can do — see “About the system” for the permissions table.', 'Deactivate the account of someone who left instead of deleting it.'],
        },
        {
          id: 'billing',
          title: 'Subscription and payment',
          steps: ['Open “Subscription” to see the status and payment details.', 'Pay using the stated method.', 'Fill in “Report a payment” (amount, method, reference) and press “Send payment notice”.', 'After the system admin verifies it, the subscription is activated and the notice shows “Approved”.'],
          images: [imgEn('billing', 'Subscription & payment page')],
          tips: ['When the subscription ends, all data is kept but only the payment page is available until renewal.'],
        },
        {
          id: 'reports',
          title: 'Reports and Excel export',
          steps: ['Open “Reports” and pick the report at the top (admissions, discharges, current inpatients, labs...).', 'Pick the period or a custom range, and optionally filter by department or doctor.', 'Press “Export Excel” to download, or “Print” for an A4 printout with the hospital logo.'],
          images: [imgEn('reports', 'Admissions register with summary and table')],
          tips: ['“Current inpatients” is very useful for shift handover.'],
        },
        {
          id: 'audit',
          title: 'Audit log',
          intro: 'Every action is recorded: who opened a chart, who edited or deleted what, and when. Open “Audit log” to review.',
          images: [imgEn('audit', 'Audit log')],
        },
        {
          id: 'trash',
          title: 'Trash and restore',
          steps: ['Nothing is deleted permanently — deleted items go to “Trash”.', 'Staff see what they deleted and press “Request restore” with a reason.', 'The hospital admin sees requests highlighted in yellow and presses “Restore”.'],
          images: [imgEn('trash', 'Trash as seen by the hospital admin')],
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
          images: [imgEn('patients', 'Patients list and search')],
          tips: ['Always search before registering a new patient to avoid duplicate files.'],
        },
        {
          id: 'new-patient',
          title: 'Registering a new patient',
          steps: ['Press “New patient”.', 'Enter full name, gender, date of birth, phone, national ID and blood type.', 'Add allergies and critical alerts if any.', 'Press “Save” — a file number is assigned automatically.'],
          images: [imgEn('patients-new', 'New patient form')],
        },
        {
          id: 'admit',
          title: 'Admitting a patient to a bed',
          steps: ['Press “Admit” next to the patient.', 'Choose the department, then the ward, then a free bed.', 'Choose the attending doctor and enter the reason.', 'Press “Confirm admission” — the 6-digit family PIN appears.'],
          images: [imgEn('patients-admit', 'Admission window')],
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
          images: [imgEn('chart-overview', 'Chart overview')],
          tips: ['Previous admissions? Pick one from the “Admissions” list above the tabs.'],
        },
        {
          id: 'diagnosis',
          title: 'Diagnoses and notes',
          steps: ['In “Diagnosis” add the diagnosis, optional ICD-10 code and status (suspected, confirmed, resolved).', 'In “Doctor notes” write your note and press “Add note”.'],
          images: [imgEn('chart-diagnosis', 'Diagnosis tab'), imgEn('chart-notes', 'Doctor notes')],
          tips: ['Only the author can edit a note; edited notes are marked.'],
        },
        {
          id: 'my-patients',
          title: 'My patients and the care team',
          intro: 'Doctors see their own patients only: those whose care team they are (or were) on. A patient can have several doctors from different specialties; one of them is the primary (attending) doctor.',
          steps: [
            'The "Care team" card at the top of the chart shows the doctors, their specialties and the responsible nurse.',
            'To add a consultant press "Add doctor", choose the doctor and write the specialty.',
            'If you open a patient who is not yours you see "not one of yours". In an emergency write the reason and press "Open chart (emergency access)" — it opens for 12 hours and the hospital admin is notified.',
          ],
          images: [imgEn('careteam', 'The care team on the patient chart'), imgEn('not-yours', 'A patient who is not yours and emergency access')],
          tips: ['Reception chooses the attending doctor on admission, so the patient becomes that doctor\'s patient automatically.'],
        },
        {
          id: 'care-plan',
          title: 'Care plan',
          steps: [
            'Open the "Care plan" tab and press "Create plan".',
            'Write the goals, diet, activity, monitoring and nursing instructions, and set the vital signs frequency and the review date.',
            'The responsible nurse is notified of every update, and the instructions appear on the shift handover page.',
          ],
          images: [imgEn('care-plan', 'Care plan')],
          tips: ['The frequency shortens automatically when MEWS rises (medium: every 2 hours, high: every hour).'],
        },
        {
          id: 'meds',
          title: 'Prescribing medications',
          steps: ['In “Medications” press “Prescribe medication”.', 'Enter name, dose, route, frequency and start date.', 'Press “Save” — it shows “Awaiting dispensing” until the pharmacist dispenses it.', 'To stop a medication change its status to “Discontinued”.'],
          images: [imgEn('chart-meds', 'Medications and administration record'), imgEn('chart-meds-new', 'New prescription')],
          tips: [
            'Write the frequency in a recognised form (every 8 hours, twice daily, morning, as needed) — the field shows how doses will be scheduled.',
            'If the drug conflicts with a recorded allergy (or a related class) a red warning appears and it is saved only with an override reason.',
            'A medication that already has recorded doses cannot be deleted — only discontinued.',
          ],
        },
        {
          id: 'allergy',
          title: 'Allergy warning when prescribing',
          intro: 'While you type, the system compares the drug with the patient allergies: the same class (e.g. penicillin and Augmentin) or cross-reactivity (e.g. penicillin and cephalosporins).',
          images: [imgEn('allergy-warning', 'Allergy warning while prescribing')],
          tips: ['The override reason is saved with the medication, shown to pharmacy and nursing, and written to the audit log.', 'The warning helps; it does not replace review by the doctor and pharmacist.'],
        },
        {
          id: 'orders',
          title: 'Ordering labs and imaging',
          steps: ['In “Laboratory” press “Order test” and enter the test name.', 'In “Radiology” press “Order imaging”.', 'The order stays “Pending” until the technician enters the result, which then appears in the chart.'],
          images: [imgEn('chart-lab', 'Laboratory tab'), imgEn('chart-lab-order', 'New lab order')],
        },
        {
          id: 'family-share',
          title: 'Choosing what the family sees',
          steps: ['In the family PIN strip press “Customize”.', 'Enable what to share: vitals, diagnosis, medications, labs, radiology, procedures.', 'Optionally write a message to the family, then “Save”.'],
          images: [imgEn('family-share', '“What the family can see” window')],
          tips: ['Only completed records are shown, and suspected diagnoses never are.'],
        },
        {
          id: 'print',
          title: 'Printing',
          intro: 'The chart’s “Print” button prints the full record, the lab report, the radiology report, the discharge summary, or just the current section — on A4 with the hospital logo.',
          images: [imgEn('print-menu', 'Print menu in the chart')],
        },
        {
          id: 'discharge',
          title: 'Discharging a patient',
          steps: ['Open the “Discharge” tab.', 'Choose the discharge type and write the summary.', 'Press “Record discharge” — the bed is freed and the family PIN is cancelled.', 'Print the discharge summary for the patient and the archive.'],
          images: [imgEn('chart-discharge', 'Discharge tab')],
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
          images: [imgEn('vitals-new', 'Recording vitals'), imgEn('vitals', 'Early-warning card, chart and readings')],
          tips: ['MEWS 3–4: observe more often and inform the nurse in charge. 5+: request urgent medical review.', 'Abnormal values are shown in red.'],
        },
        {
          id: 'fluids',
          title: 'Fluid balance',
          steps: ['In the “Fluid balance” card press “Intake” or “Output”.', 'Choose the type and volume in mL — or tap a quick amount.', 'Intake, output and net for the last 24 hours are calculated automatically.'],
          images: [imgEn('fluids-new', 'Adding fluids')],
        },
        {
          id: 'mar',
          title: 'Giving medication doses (MAR)',
          steps: ['Open “Medications”; each active medication shows its administration record.', 'Press “Record dose” and choose: given, held or refused.', 'For held or refused doses enter the reason, then “Save”.'],
          images: [imgEn('mar', 'Administration record under each medication'), imgEn('mar-dialog', 'Recording a dose')],
          tips: ['You are warned if the medication has not been dispensed or a dose was recorded within the last hour.', 'Made a mistake? Remove your entry within one hour with the × next to it.'],
        },
        {
          id: 'rounds',
          title: 'My patients and the nursing round',
          intro: 'Each patient has exactly one responsible nurse. "My patients" shows the patients assigned to you; "Whole ward" shows everyone.',
          steps: [
            'Unassigned patient? Open the chart and press "Take patient".',
            'Open "Nursing round": the "Vital signs" tab shows when each patient is next due for measurement (from the care plan and MEWS), and the "Medications" tab shows overdue and due doses.',
            'Press "Record vitals" to go straight to the vital signs, and "Given" or "Not given" for doses.',
            'When a dose or measurement for your patients becomes due you get a written alert with a sound, and another if it becomes overdue.',
          ],
          images: [imgEn('rounds', 'Nursing round: vital signs')],
          tips: ['"Frequency not recognised" on a medication means the doctor wrote it in a form the system cannot read — ask for it to be corrected.'],
        },
        {
          id: 'nurse-handover',
          title: 'Handing over and receiving patients between nurses',
          steps: [
            'Before your shift ends write an SBAR note for each patient in "Shift handover" → "Patient summary".',
            'In the "Hand over / receive" tab choose your patients and the receiving nurse, write a note, then press "Hand over".',
            'You stay responsible until your colleague reviews the patients and presses "Accept" — then responsibility moves to them. They can "Decline" with a reason.',
          ],
          images: [imgEn('nurse-handover', 'An incoming handover request and handing over patients')],
          tips: ['Two nurses cannot be assigned to the same patient; moving a patient happens only through handover (or by the hospital admin).'],
        },
        {
          id: 'handover',
          title: 'Shift handover',
          steps: [
            'Open "Shift handover" and choose your ward: each patient shows diagnosis, allergies, latest vitals and MEWS, and pending orders.',
            'Press "Write handover" and write it as SBAR: situation, background, assessment and recommendation for the next shift.',
            'Press "Print handover sheet" for a paper copy signed by the person handing over and the person receiving.',
          ],
          images: [imgEn('handover', 'Shift handover page'), imgEn('handover-sbar', 'Writing the handover note')],
          tips: ['Notes older than 12 hours are marked "older than 12 hours" as a reminder to update them.'],
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
          images: [imgEn('lab-page', 'Pending lab orders'), imgEn('lab-result', 'Entering a result')],
          tips: ['To print a specimen barcode label open the chart → Laboratory and press the label icon next to the order.'],
        },
        {
          id: 'rad-reports',
          title: 'Radiology reports',
          steps: ['Open “Radiology” — pending orders are shown.', 'Press “Enter report”, write it and “Save”.'],
          images: [imgEn('radiology-page', 'Radiology page')],
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
          images: [imgEn('pharmacy-page', 'Prescriptions awaiting dispensing')],
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
          images: [imgEn('track-public', 'What anyone who scans the code sees'), imgEn('track-family', 'Details after entering the family PIN')],
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
          images: [imgEn('hospitals', 'Hospitals page')],
          tips: ['The "new sign-ups this week" button lists recently self-registered hospitals with their contact details for follow-up.'],
        },
        {
          id: 'system-health',
          title: 'System health and backups',
          steps: [
            'Open "System health": database status, the latest backup, errors in the last 24 hours and active sessions.',
            'Backups run automatically every day; press "Back up now" before any big change, and download a copy regularly to keep outside the server.',
            'The error log collects server and interface errors — open any error for its details.',
          ],
          images: [imgEn('system-health', 'System health page')],
          tips: [
            'Each hospital admin can download all of the hospital data from Settings → "Export hospital data".',
            'Before handing the system to hospitals: "Delete demo data" on System health (with an automatic backup). To remove a test hospital: "Delete permanently" on the Hospitals page.',
          ],
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
    { q: 'I cannot hear the alert sounds?', a: 'Click anywhere on the page after opening the system (browsers block sound before that), and make sure sound is on in Settings → alerts and on the computer itself. Try the "Test: critical" button.' },
    { q: 'I lost the phone with my 2-step verification app?', a: 'Sign in with one of your recovery codes instead of the app code, or ask the hospital admin to reset 2-step verification for your account.' },
    { q: 'How do I change the language?', a: 'Press EN / ع in the top bar, or Settings → Language.' },
    { q: 'How do I contact technical support or the developer?', a: 'Developed by Qasim Mohammed — email qasimmohamed14@gmail.com — phone & WhatsApp +964 774 477 7950. For account and permission issues, ask your hospital admin first.' },
  ],
};
