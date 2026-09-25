/**
 * محتوى صفحة «عن النظام» (نصوص طويلة لذلك منفصلة عن قواميس الواجهة).
 * أي تعديل هنا يجب أن يُطابق في اللغتين.
 */
export interface SystemContent {
  title: string;
  summary: string;
  modulesTitle: string;
  modules: { key: string; title: string; body: string }[];
  flowTitle: string;
  flow: { title: string; body: string }[];
  rolesTitle: string;
  roles: { role: string; body: string }[];
  securityTitle: string;
  security: string[];
  techTitle: string;
  tech: string[];
}

export const SYSTEM_AR: SystemContent = {
  title: 'نظام إدارة المستشفى HMSI',
  summary:
    'ملف طبي إلكتروني متكامل للمستشفيات: من تسجيل المريض وتنويمه، إلى العلاج اليومي والتحاليل والأشعة والأدوية، حتى الخروج — مع متابعة ذوي المريض عبر رمز QR، ويعمل على الحاسوب والهاتف باللغتين العربية والإنجليزية.',
  modulesTitle: 'ماذا يقدّم النظام؟',
  modules: [
    { key: 'patients', title: 'المرضى والتنويم', body: 'تسجيل المريض برقم ملف تسلسلي، البحث بالاسم أو رقم الملف أو الرقم الوطني أو الهاتف، التنويم على سرير، النقل بين الأسرّة، وسجل كل التنويمات السابقة.' },
    { key: 'chart', title: 'الملف الطبي', body: 'نظرة عامة، علامات حيوية، تشخيص (ICD-10)، ملاحظات الطبيب والتمريض، أدوية، مختبر، أشعة، استشارات، إجراءات، مرفقات، وجدول زمني لكل ما حدث للمريض.' },
    { key: 'nursing', title: 'التمريض', body: 'تسجيل العلامات الحيوية مع مقياس الألم ومستوى الوعي، ميزان السوائل الداخلة والخارجة، وسجل إعطاء الجرعات (MAR) مع التنبيه للجرعات المكررة.' },
    { key: 'mews', title: 'الإنذار المبكر (MEWS)', body: 'حساب تلقائي لدرجة الخطورة من العلامات الحيوية، وتنبيه في لوحة التحكم بالمرضى الذين تدهورت حالتهم.' },
    { key: 'services', title: 'المختبر والأشعة والصيدلية', body: 'الطبيب يطلب، والفني يُدخل النتيجة أو التقرير، والصيدلي يصرف الدواء — كل قسم يرى طلباته المعلّقة فقط.' },
    { key: 'wards', title: 'الأقسام والردهات والأسرّة', body: 'هيكل المستشفى بالكامل، إشغال الأسرّة لحظياً، ورمز QR لكل سرير.' },
    { key: 'family', title: 'متابعة ذوي المريض', body: 'تمسح العائلة رمز QR على السرير، وبعد إدخال رمز العائلة ترى ما يختار الطاقم مشاركته فقط: العلامات الحيوية، التحاليل، التشخيص، ورسالة من الفريق الطبي.' },
    { key: 'reports', title: 'التقارير', body: 'تقارير تفصيلية للتنويم والخروج والإشغال والمختبر والأشعة والصيدلية، مع الطباعة والتصدير إلى Excel.' },
    { key: 'print', title: 'الطباعة والملصقات', body: 'طباعة الملف الطبي وتقارير التحاليل والأشعة وملخص الخروج على ورق A4 بشعار المستشفى، وملصقات باركود للسوار والعيّنات.' },
    { key: 'offline', title: 'العمل دون اتصال', body: 'انقطع الإنترنت؟ تُحفظ العلامات الحيوية والسوائل والجرعات على الجهاز وتُرسل تلقائياً عند عودة الاتصال.' },
    { key: 'trash', title: 'لا حذف نهائي', body: 'كل ما يُحذف ينتقل إلى سلة المحذوفات، ويستعيده مدير المستشفى، ويطلب الموظف استعادته من داخل النظام.' },
    { key: 'multi', title: 'عدة مستشفيات', body: 'كل مستشفى معزول تماماً ببياناته ومستخدميه وشعاره، ويمكن لأي مستشفى التسجيل وتجربة النظام مجاناً 14 يوماً.' },
  ],
  flowTitle: 'رحلة المريض في النظام',
  flow: [
    { title: 'الاستقبال', body: 'تسجيل المريض أو البحث عنه، ثم تنويمه على سرير مع الطبيب المعالج — ويُعطى ذووه رمز العائلة.' },
    { title: 'الرعاية اليومية', body: 'التمريض يسجل العلامات الحيوية والسوائل والجرعات، والطبيب يكتب الملاحظات والتشخيص ويصف الأدوية.' },
    { title: 'الفحوص', body: 'الطبيب يطلب التحاليل والأشعة، والأقسام تُدخل النتائج، فتظهر فوراً في الملف.' },
    { title: 'الخروج', body: 'الطبيب يعتمد الخروج بنوعه وملخصه، ويُطبع ملخص الخروج، ويتحرر السرير تلقائياً.' },
  ],
  rolesTitle: 'الأدوار والصلاحيات',
  roles: [
    { role: 'المدير العام', body: 'كل الصلاحيات على النظام: إدارة المستشفيات والاشتراكات ومعلومات الدفع، والعمل داخل أي مستشفى.' },
    { role: 'مدير المستشفى', body: 'كل الصلاحيات داخل مستشفاه: المستخدمون، الأقسام والأسرّة، التقارير، سجل التدقيق، المحذوفات، والعمل السريري.' },
    { role: 'الطبيب', body: 'الملف الطبي كاملاً: ملاحظات، تشخيص، أدوية، طلب فحوص، اعتماد الخروج، وتحديد ما يراه ذوو المريض.' },
    { role: 'التمريض', body: 'العلامات الحيوية، ميزان السوائل، إعطاء الجرعات، ملاحظات التمريض، والتنويم والنقل.' },
    { role: 'الصيدلي', body: 'صرف الأدوية الموصوفة من صفحة الصيدلية.' },
    { role: 'فني المختبر / الأشعة', body: 'إدخال نتائج التحاليل وتقارير الأشعة وطباعة ملصقات العيّنات.' },
    { role: 'الاستقبال', body: 'تسجيل المرضى وتعديل بياناتهم والتنويم.' },
    { role: 'مشاهد', body: 'اطلاع فقط على المرضى وملفاتهم دون أي تعديل.' },
  ],
  securityTitle: 'الأمان والخصوصية',
  security: [
    'كل مستشفى معزول: لا يرى مستخدموه بيانات أي مستشفى آخر.',
    'كل عملية تُسجَّل في سجل التدقيق: من فعل ماذا ومتى ومن أي جهاز.',
    'كلمات المرور مشفّرة بخوارزمية Argon2، والجلسات محمية من هجمات CSRF، ومحاولات الدخول الخاطئة محدودة.',
    'المرفقات يُتحقق من نوعها الحقيقي قبل حفظها، ولا تُفتح إلا لمستخدم مسجّل في نفس المستشفى.',
    'صفحة ذوي المريض لا تعرض أي معلومة طبية دون رمز العائلة، ولا تعرض إلا ما سمح به الطاقم.',
  ],
  techTitle: 'التقنية',
  tech: [
    'تطبيق ويب يعمل على أي متصفح، ويُثبَّت على الهاتف والحاسوب كتطبيق (PWA).',
    'العربية والإنجليزية مع اتجاه الكتابة الصحيح، ووضع ليلي.',
    'قاعدة بيانات سحابية (Turso) مع نشر على Netlify.',
  ],
};

export const SYSTEM_EN: SystemContent = {
  title: 'HMSI Hospital Management System',
  summary:
    'A complete electronic medical record for hospitals: from registering and admitting a patient, through daily care, labs, imaging and medications, to discharge — with QR-based family updates. Works on desktop and phone, in Arabic and English.',
  modulesTitle: 'What does it do?',
  modules: [
    { key: 'patients', title: 'Patients & admissions', body: 'Register patients with sequential file numbers, search by name, file number, national ID or phone, admit to a bed, transfer between beds, and keep every past admission.' },
    { key: 'chart', title: 'Medical chart', body: 'Overview, vitals, diagnoses (ICD-10), doctor and nursing notes, medications, labs, radiology, consultations, procedures, attachments and a timeline of everything that happened.' },
    { key: 'nursing', title: 'Nursing', body: 'Vitals with pain score and consciousness level, fluid intake/output balance, and a medication administration record (MAR) that warns about duplicate doses.' },
    { key: 'mews', title: 'Early warning (MEWS)', body: 'Automatic risk score from vitals and a dashboard alert for patients whose condition is deteriorating.' },
    { key: 'services', title: 'Lab, radiology & pharmacy', body: 'The doctor orders, the technician enters the result or report, and the pharmacist dispenses — each department sees only its pending work.' },
    { key: 'wards', title: 'Departments, wards & beds', body: 'The full hospital structure, live bed occupancy, and a QR code for every bed.' },
    { key: 'family', title: 'Family updates', body: 'Families scan the bed QR code and, after entering the family PIN, see only what the care team chooses to share: vitals, labs, diagnosis and a message from the team.' },
    { key: 'reports', title: 'Reports', body: 'Detailed reports for admissions, discharges, occupancy, lab, radiology and pharmacy, with printing and Excel export.' },
    { key: 'print', title: 'Printing & labels', body: 'Print the chart, lab and radiology reports and the discharge summary on A4 with the hospital logo, plus barcode labels for wristbands and specimens.' },
    { key: 'offline', title: 'Works offline', body: 'Internet down? Vitals, fluids and doses are saved on the device and sent automatically when the connection returns.' },
    { key: 'trash', title: 'Nothing is lost', body: 'Everything deleted goes to the trash; the hospital admin restores it and staff can request a restore from inside the system.' },
    { key: 'multi', title: 'Multiple hospitals', body: 'Each hospital is fully isolated with its own data, users and logo, and any hospital can sign up and try the system free for 14 days.' },
  ],
  flowTitle: "The patient's journey",
  flow: [
    { title: 'Reception', body: 'Register or find the patient, then admit to a bed with an attending doctor — the family receives the family PIN.' },
    { title: 'Daily care', body: 'Nurses record vitals, fluids and doses; doctors write notes and diagnoses and prescribe medications.' },
    { title: 'Investigations', body: 'The doctor orders labs and imaging; departments enter results, which appear instantly in the chart.' },
    { title: 'Discharge', body: 'The doctor approves the discharge with its type and summary, the summary is printed, and the bed is freed automatically.' },
  ],
  rolesTitle: 'Roles & permissions',
  roles: [
    { role: 'Super admin', body: 'Everything system-wide: hospitals, subscriptions and payment details, and working inside any hospital.' },
    { role: 'Hospital admin', body: 'Everything within their hospital: users, departments and beds, reports, audit log, trash, and clinical work.' },
    { role: 'Doctor', body: 'The full chart: notes, diagnoses, medications, ordering tests, approving discharge, and choosing what the family sees.' },
    { role: 'Nurse', body: 'Vitals, fluid balance, giving doses, nursing notes, admissions and transfers.' },
    { role: 'Pharmacist', body: 'Dispensing prescribed medications from the Pharmacy page.' },
    { role: 'Lab / radiology technician', body: 'Entering lab results and radiology reports and printing specimen labels.' },
    { role: 'Reception', body: 'Registering patients, editing their details and admitting them.' },
    { role: 'Viewer', body: 'Read-only access to patients and charts.' },
  ],
  securityTitle: 'Security & privacy',
  security: [
    "Hospitals are isolated: users never see another hospital's data.",
    'Every action is recorded in the audit log: who did what, when and from where.',
    'Passwords are hashed with Argon2, sessions are CSRF-protected and failed sign-ins are rate-limited.',
    'Attachments are checked for their real file type and only open for signed-in users of the same hospital.',
    'The family page shows no medical information without the family PIN, and only what the team allowed.',
  ],
  techTitle: 'Technology',
  tech: [
    'A web app that runs in any browser and installs on phones and computers as an app (PWA).',
    'Arabic and English with correct text direction, plus dark mode.',
    'Cloud database (Turso) deployed on Netlify.',
  ],
};
