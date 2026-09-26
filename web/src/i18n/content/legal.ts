/**
 * سياسة الخصوصية وشروط الاستخدام لنظام Q VIREXA — باللغتين.
 * مبنية على ما يفعله النظام فعلاً (الاستضافة، النسخ، الإشعارات، السجلات). أي تغيير جوهري:
 * حدّث النص وارفع TERMS_VERSION في packages/shared/src/types.ts فيُطلب من كل الموظفين الموافقة من جديد.
 */

export interface LegalSection {
  h: string;
  p?: string[];
  list?: string[];
}
export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}
export interface LegalContent {
  updated: string;
  privacy: LegalDoc;
  terms: LegalDoc;
  /** ما يوافق عليه الموظف عند أول دخول (ملخص) */
  pledge: string[];
}

const EMAIL = 'qasimmohamed14@gmail.com';

export const LEGAL_AR: LegalContent = {
  updated: 'آخر تحديث: 26 سبتمبر 2026',
  privacy: {
    title: 'سياسة الخصوصية',
    intro:
      'توضّح هذه السياسة كيف يتعامل نظام Q VIREXA لإدارة المستشفيات (من منتجات Q Products) مع البيانات. المستشفى المشترك هو صاحب بيانات مرضاه والمسؤول عنها، ونحن نشغّل النظام ونحفظ البيانات نيابةً عنه ووفق تعليماته فقط.',
    sections: [
      {
        h: 'البيانات التي يحفظها النظام',
        list: [
          'بيانات المرضى التي يُدخلها طاقم المستشفى: الهوية ورقم الملف والتنويم والسجل الطبي (العلامات الحيوية، الأدوية، التشخيصات، الملاحظات، نتائج المختبر والأشعة، المرفقات).',
          'حسابات الموظفين: الاسم واسم المستخدم والدور والبريد (اختياري)، وكلمة المرور مخزّنة بتجزئة Argon2id لا يمكن استرجاعها.',
          'سجل التدقيق: من فعل ماذا ومتى (فتح ملف، تعديل، وصول طارئ، موافقة على الشروط)، مع عنوان IP.',
          'بيانات تشغيلية: الجلسات، وإعدادات الأجهزة للإشعارات، وأخطاء النظام بعد حذف ما قد يكون سرياً منها.',
          'عند تسجيل مستشفى جديد: اسم المستشفى واسم المسؤول ورقم هاتفه ومدينته.',
        ],
      },
      {
        h: 'لماذا نستخدمها',
        list: [
          'لتشغيل النظام للمستشفى فقط: رعاية المرضى، والتمريض، والمختبر والأشعة والصيدلية، والتقارير.',
          'لحماية الحسابات والبيانات: التحقق من الدخول، ومنع محاولات الاختراق، والتدقيق.',
          'للتواصل مع المستشفى بشأن اشتراكه ودعمه الفني.',
          'لا نبيع البيانات، ولا نعرض إعلانات، ولا نستخدم بيانات المرضى لأي غرض خارج خدمة المستشفى.',
        ],
      },
      {
        h: 'أين تُحفظ ومن يصل إليها',
        list: [
          'على خادم مخصّص لدى شركة Hostinger في مركز بيانات داخل الاتحاد الأوروبي (ألمانيا)، باتصال مشفّر (HTTPS) فقط.',
          'بيانات كل مستشفى معزولة عن غيره داخل النظام؛ ولا يرى الموظف إلا ما يسمح به دوره، والطبيب يرى مرضاه فقط.',
          'يصل إلى الخادم مشغّل النظام لأغراض الصيانة والدعم عند الحاجة فقط.',
          'إشعارات الأجهزة تمر عبر خدمات Google وApple وMicrosoft لإيصالها، وهي مشفّرة ولا تحمل اسم المريض.',
          'صفحة متابعة ذوي المريض لا تُظهر شيئاً دون الرمز الذي يعطيه المستشفى، ثم تُظهر فقط ما سمح الطاقم بمشاركته.',
        ],
      },
      {
        h: 'الحماية',
        list: [
          'تشفير الاتصال، وجدار ناري، وحماية من محاولات الدخول المتكررة، وتحديثات أمان تلقائية للخادم.',
          'خروج تلقائي بعد 30 دقيقة دون نشاط، وتحقق بخطوتين اختياري، وكلمات مرور قوية إجبارية.',
          'نسخة احتياطية يومية مشفّرة، تُحفظ آخر 30 نسخة ثم تُحذف الأقدم تلقائياً.',
        ],
      },
      {
        h: 'مدة الحفظ والحذف',
        p: [
          'تُحفظ البيانات ما دام اشتراك المستشفى قائماً. يستطيع مدير المستشفى تصدير بياناته كاملة في أي وقت، وعند إنهاء الاشتراك تُحذف بياناته من النظام بطلبه، وتخرج من النسخ الاحتياطية خلال 30 يوماً. السجلات الطبية تخضع أيضاً لما تفرضه القوانين والتعليمات الصحية على المستشفى.',
        ],
      },
      {
        h: 'حقوق المرضى والموظفين',
        p: [
          'طلبات الاطلاع على البيانات أو تصحيحها أو حذفها تُقدَّم إلى المستشفى بوصفه صاحب البيانات، ونحن ننفّذ ما يطلبه المستشفى. يستطيع الموظف طلب تصحيح بيانات حسابه من مدير المستشفى.',
        ],
      },
      {
        h: 'ملفات الارتباط (Cookies)',
        p: ['يستخدم النظام ملفات ارتباط ضرورية فقط لإبقائك مسجّلاً ولحماية الطلبات (CSRF). لا توجد ملفات تتبع أو إعلانات.'],
      },
      {
        h: 'التغييرات والتواصل',
        p: [
          'عند أي تغيير جوهري في هذه السياسة نحدّث تاريخها ونطلب من الموظفين الموافقة من جديد عند دخولهم.',
          `للاستفسار: ${EMAIL}`,
        ],
      },
    ],
  },
  terms: {
    title: 'شروط الاستخدام',
    intro: 'باستخدامك نظام Q VIREXA — مستشفى مشتركاً أو موظفاً فيه — فأنت توافق على هذه الشروط.',
    sections: [
      {
        h: 'الحساب',
        list: [
          'حسابك شخصي: لا تشاركه ولا تعطِ كلمة مرورك لأحد، وسجّل الخروج من الأجهزة المشتركة.',
          'كل ما يُسجَّل بحسابك منسوب إليك في سجل التدقيق.',
          'أبلغ مدير المستشفى فوراً إن شككت أن أحداً استخدم حسابك.',
        ],
      },
      {
        h: 'سرية بيانات المرضى',
        list: [
          'تطّلع فقط على بيانات المرضى الذين تحتاجها لعملك، ولا تنسخها أو تنشرها أو تصوّرها خارج النظام إلا لغرض علاجي مشروع.',
          'الوصول الطارئ إلى ملف مريض ليس من مرضاك يُسجَّل ويُبلَّغ به المدير، ويُستخدم في الحالات الطارئة فقط.',
          'يبقى التزام السرية قائماً بعد انتهاء عملك في المستشفى.',
        ],
      },
      {
        h: 'دقة التسجيل والقرار الطبي',
        list: [
          'أنت مسؤول عن صحة ما تُدخله في السجل الطبي.',
          'تنبيهات النظام (الحساسية، الإنذار المبكر، مواعيد الجرعات) أدوات مساعدة لا تغني عن الحكم السريري والمراجع الدوائية، والقرار الطبي مسؤولية الطاقم.',
        ],
      },
      {
        h: 'الاشتراك والخدمة',
        list: [
          'للمستشفى الجديد فترة تجريبية مجانية، ثم يستمر الاستخدام باشتراك مدفوع حسب الأسعار المعلنة في صفحة الدفع.',
          'نعمل على أن يكون النظام متاحاً دائماً، وقد يتوقف لفترات قصيرة للصيانة أو لظروف خارجة عن إرادتنا.',
          'يحق لنا إيقاف أي حساب يُستخدم بما يخالف هذه الشروط أو القانون.',
        ],
      },
      {
        h: 'المسؤولية',
        p: [
          'نبذل العناية المعقولة في تشغيل النظام وحماية بياناته. لا نتحمّل مسؤولية الأضرار الناتجة عن سوء استخدام الحسابات أو عن معلومات أدخلها المستخدمون، وفي كل الأحوال لا تتجاوز مسؤوليتنا قيمة ما دفعه المستشفى عن آخر 12 شهراً.',
        ],
      },
      {
        h: 'القانون والتواصل',
        p: ['تخضع هذه الشروط لقوانين جمهورية العراق.', `للاستفسار: ${EMAIL}`],
      },
    ],
  },
  pledge: [
    'حسابي شخصي، لن أشاركه، وأتحمّل ما يُسجَّل به.',
    'سأطّلع فقط على بيانات المرضى التي يتطلبها عملي، وأحافظ على سريتها داخل المستشفى وخارجه.',
    'أعلم أن كل وصول وتعديل يُسجَّل في سجل التدقيق.',
    'اطّلعت على سياسة الخصوصية وشروط الاستخدام وأوافق عليهما.',
  ],
};

export const LEGAL_EN: LegalContent = {
  updated: 'Last updated: 26 September 2026',
  privacy: {
    title: 'Privacy policy',
    intro:
      'This policy explains how the Q VIREXA hospital management system (a Q Products product) handles data. The subscribing hospital owns and is responsible for its patients’ data; we operate the system and store the data on the hospital’s behalf and on its instructions only.',
    sections: [
      {
        h: 'Data the system holds',
        list: [
          'Patient data entered by hospital staff: identity, file number, admissions and the medical record (vital signs, medications, diagnoses, notes, lab and imaging results, attachments).',
          'Staff accounts: name, username, role and optional email; passwords are stored as Argon2id hashes that cannot be recovered.',
          'The audit log: who did what and when (opening a chart, edits, emergency access, accepting these terms), with the IP address.',
          'Operational data: sessions, device notification settings, and system errors with anything potentially secret removed.',
          'When a hospital signs up: its name, the contact person’s name, phone number and city.',
        ],
      },
      {
        h: 'Why we use it',
        list: [
          'Only to run the system for the hospital: patient care, nursing, lab, imaging, pharmacy and reports.',
          'To protect accounts and data: sign-in checks, blocking intrusion attempts, and auditing.',
          'To contact the hospital about its subscription and support.',
          'We do not sell data, show ads, or use patient data for anything outside the hospital’s service.',
        ],
      },
      {
        h: 'Where it is kept and who can access it',
        list: [
          'On a dedicated server at Hostinger in a data centre in the European Union (Germany), over encrypted connections (HTTPS) only.',
          'Each hospital’s data is isolated from others; staff see only what their role allows, and doctors see only their own patients.',
          'The system operator accesses the server only when needed for maintenance and support.',
          'Device notifications are delivered through Google, Apple and Microsoft push services; they are encrypted and never carry the patient name.',
          'The family tracking page shows nothing without the code the hospital gives, and then only what staff chose to share.',
        ],
      },
      {
        h: 'Security',
        list: [
          'Encrypted connections, a firewall, protection against repeated sign-in attempts, and automatic security updates on the server.',
          'Automatic sign-out after 30 minutes of inactivity, optional two-step verification, and mandatory strong passwords.',
          'A daily encrypted backup; the last 30 are kept and older ones are deleted automatically.',
        ],
      },
      {
        h: 'Retention and deletion',
        p: [
          'Data is kept while the hospital’s subscription is active. The hospital administrator can export all of the hospital’s data at any time; when the subscription ends, the data is deleted from the system on the hospital’s request and leaves the backups within 30 days. Medical records are also subject to the health laws and regulations that apply to the hospital.',
        ],
      },
      {
        h: 'Rights of patients and staff',
        p: [
          'Requests to access, correct or delete data go to the hospital as the data owner, and we carry out what the hospital requests. Staff can ask their hospital administrator to correct their account details.',
        ],
      },
      {
        h: 'Cookies',
        p: ['The system uses only essential cookies to keep you signed in and to protect requests (CSRF). There are no tracking or advertising cookies.'],
      },
      {
        h: 'Changes and contact',
        p: ['If this policy changes materially we update its date and ask staff to accept it again when they sign in.', `Questions: ${EMAIL}`],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'By using Q VIREXA — as a subscribing hospital or as a member of its staff — you agree to these terms.',
    sections: [
      {
        h: 'Your account',
        list: [
          'Your account is personal: do not share it or give your password to anyone, and sign out of shared devices.',
          'Everything recorded under your account is attributed to you in the audit log.',
          'Tell your hospital administrator at once if you suspect someone used your account.',
        ],
      },
      {
        h: 'Patient confidentiality',
        list: [
          'Access only the patient data your work requires, and do not copy, publish or photograph it outside the system except for a legitimate care purpose.',
          'Emergency access to a chart that is not one of your patients is logged and reported to the administrator, and is for emergencies only.',
          'Your duty of confidentiality continues after you leave the hospital.',
        ],
      },
      {
        h: 'Accurate records and clinical decisions',
        list: [
          'You are responsible for the accuracy of what you enter in the medical record.',
          'The system’s alerts (allergies, early warning, dose times) are aids and do not replace clinical judgement or drug references; clinical decisions are the staff’s responsibility.',
        ],
      },
      {
        h: 'Subscription and service',
        list: [
          'A new hospital gets a free trial, after which use continues on a paid subscription at the prices shown on the payment page.',
          'We work to keep the system available at all times; it may stop briefly for maintenance or for reasons beyond our control.',
          'We may suspend any account used in breach of these terms or the law.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'We take reasonable care in running the system and protecting its data. We are not liable for damage caused by misuse of accounts or by information entered by users, and in any case our liability does not exceed what the hospital paid in the last 12 months.',
        ],
      },
      {
        h: 'Law and contact',
        p: ['These terms are governed by the laws of the Republic of Iraq.', `Questions: ${EMAIL}`],
      },
    ],
  },
  pledge: [
    'My account is personal; I will not share it, and I am responsible for what is recorded under it.',
    'I will access only the patient data my work requires, and keep it confidential inside and outside the hospital.',
    'I understand that every access and change is recorded in the audit log.',
    'I have read the privacy policy and the terms of use and I agree to them.',
  ],
};
