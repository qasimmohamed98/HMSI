/**
 * منتجات Q Products المعروضة داخل النظام (صفحات عن النظام ومن نحن وتذييل الصفحات العامة)
 * لجذب زوار النظام إلى الموقع العام. عدّل هذه القائمة عند إضافة منتج أو تغيير حالته.
 */

export const PUBLIC_SITE = 'https://qproductshub.tech';

/** رابط الموقع العام مع مصدر الزيارة (لمعرفة من أين جاء الزوار لاحقاً) */
export function siteLink(source: string, path = '/'): string {
  return `${PUBLIC_SITE}${path}?utm_source=virexa&utm_medium=${encodeURIComponent(source)}`;
}

export interface QProduct {
  id: string;
  /** الكلمة بعد Q في الشعار */
  word: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  status: 'current' | 'available' | 'soon';
  platforms: string[];
}

export const PRODUCTS: QProduct[] = [
  {
    id: 'virexa',
    word: 'VIREXA',
    ar: 'نظام إدارة المستشفيات',
    en: 'Hospital management system',
    descAr: 'ملف طبي إلكتروني، تمريض وأدوية، مختبر وأشعة، ومتابعة ذوي المريض — على كل الأجهزة.',
    descEn: 'Electronic medical records, nursing and medications, lab and imaging, and family updates — on every device.',
    status: 'current',
    platforms: ['Web', 'Windows', 'Android', 'iOS'],
  },
  {
    id: 'clinic',
    word: 'CLINIC',
    ar: 'نظام إدارة العيادات',
    en: 'Clinic management system',
    descAr: 'المواعيد والملفات والوصفات والفواتير للعيادات والمجمعات الطبية.',
    descEn: 'Appointments, records, prescriptions and billing for clinics and medical centres.',
    status: 'soon',
    platforms: ['Web', 'Android'],
  },
  {
    id: 'dose',
    word: 'DOSE',
    ar: 'تذكير الجرعات',
    en: 'Dose reminders',
    descAr: 'تذكير بمواعيد الأدوية ومتابعة مخزونها، يعمل دون إنترنت وبياناتك على جهازك.',
    descEn: 'Medication reminders and stock tracking — works offline and keeps your data on your device.',
    status: 'available',
    platforms: ['Android'],
  },
  {
    id: 'notes',
    word: 'NOTES',
    ar: 'الملاحظات والمهام',
    en: 'Notes and tasks',
    descAr: 'ملاحظاتك ومهامك وخرائطك الذهنية ومالك في تطبيق واحد آمن يعمل دون إنترنت.',
    descEn: 'Notes, tasks, mind maps and finances — secure, offline, all in one app.',
    status: 'available',
    platforms: ['Android', 'Windows', 'Web'],
  },
];
