import type { MedicationForm } from '@hmsi/shared';

/**
 * كتالوج أدوية جاهز يستورده المستشفى ثم يعدّله (يضيف أو يحذف أو يبدّل الأسماء التجارية المتوفرة عنده).
 * ⚠ قائمة شائعة الاستخدام لبدء العمل، وليست النسخة الرسمية الكاملة لقائمة الأدوية المسجَّلة في وزارة الصحة العراقية —
 * يستوردها المستشفى كنقطة بداية، ويحمّل القائمة الرسمية الكاملة لاحقاً من «استيراد من ملف CSV» عند توفرها.
 */
export interface DefaultMedication {
  generic_ar: string;
  generic_en: string;
  brand_ar?: string;
  brand_en?: string;
  form: MedicationForm;
  strength?: string;
  route?: string;
  controlled?: boolean;
}

export const DEFAULT_MEDICATIONS: DefaultMedication[] = [
  // ——— مسكنات وخوافض حرارة ———
  { generic_ar: 'باراسيتامول', generic_en: 'Paracetamol', brand_ar: 'بنادول', brand_en: 'Panadol', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'باراسيتامول وريدي', generic_en: 'Paracetamol IV', brand_ar: 'بيرفالجان', brand_en: 'Perfalgan', form: 'injection', strength: '1 g/100 mL', route: 'IV' },
  { generic_ar: 'ايبوبروفين', generic_en: 'Ibuprofen', brand_ar: 'بروفين', brand_en: 'Brufen', form: 'tablet', strength: '400 mg', route: 'PO' },
  { generic_ar: 'ديكلوفيناك', generic_en: 'Diclofenac', brand_ar: 'فولتارين', brand_en: 'Voltaren', form: 'injection', strength: '75 mg/3 mL', route: 'IM' },
  { generic_ar: 'كيتورولاك', generic_en: 'Ketorolac', brand_ar: 'تورادول', brand_en: 'Toradol', form: 'injection', strength: '30 mg/mL', route: 'IM' },
  { generic_ar: 'ترامادول', generic_en: 'Tramadol', form: 'injection', strength: '100 mg/2 mL', route: 'IV', controlled: true },
  { generic_ar: 'مورفين', generic_en: 'Morphine', form: 'injection', strength: '10 mg/mL', route: 'IV', controlled: true },
  { generic_ar: 'بيثيدين', generic_en: 'Pethidine', form: 'injection', strength: '50 mg/mL', route: 'IM', controlled: true },

  // ——— مضادات حيوية: بنسلينات وسيفالوسبورينات ———
  { generic_ar: 'اموكسيسيلين مع كلافولانيك', generic_en: 'Amoxicillin/Clavulanate', brand_ar: 'اوجمنتين', brand_en: 'Augmentin', form: 'tablet', strength: '1 g', route: 'PO' },
  { generic_ar: 'امبيسيلين', generic_en: 'Ampicillin', form: 'injection', strength: '1 g', route: 'IV' },
  { generic_ar: 'سيفترياكسون', generic_en: 'Ceftriaxone', brand_ar: 'روسيفين', brand_en: 'Rocephin', form: 'injection', strength: '1 g', route: 'IV' },
  { generic_ar: 'سيفوتاكسيم', generic_en: 'Cefotaxime', brand_ar: 'كلافوران', brand_en: 'Claforan', form: 'injection', strength: '1 g', route: 'IV' },
  { generic_ar: 'سيفوروكسيم', generic_en: 'Cefuroxime', brand_ar: 'زينات', brand_en: 'Zinnat', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'سيفازولين', generic_en: 'Cefazolin', form: 'injection', strength: '1 g', route: 'IV' },
  { generic_ar: 'بيبراسيلين مع تازوباكتام', generic_en: 'Piperacillin/Tazobactam', brand_ar: 'تازوسين', brand_en: 'Tazocin', form: 'injection', strength: '4.5 g', route: 'IV' },
  { generic_ar: 'ميروبينيم', generic_en: 'Meropenem', brand_ar: 'ميرونيم', brand_en: 'Meronem', form: 'injection', strength: '1 g', route: 'IV' },

  // ——— مضادات حيوية أخرى ———
  { generic_ar: 'ازيثرومايسين', generic_en: 'Azithromycin', brand_ar: 'زيثروماكس', brand_en: 'Zithromax', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'كلاريثرومايسين', generic_en: 'Clarithromycin', brand_ar: 'كلاسيد', brand_en: 'Klacid', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'سيبروفلوكساسين', generic_en: 'Ciprofloxacin', brand_ar: 'سيبروباي', brand_en: 'Ciprobay', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'ليفوفلوكساسين', generic_en: 'Levofloxacin', brand_ar: 'تافانيك', brand_en: 'Tavanic', form: 'injection', strength: '500 mg/100 mL', route: 'IV' },
  { generic_ar: 'مترونيدازول', generic_en: 'Metronidazole', brand_ar: 'فلاجيل', brand_en: 'Flagyl', form: 'injection', strength: '500 mg/100 mL', route: 'IV' },
  { generic_ar: 'جنتامايسين', generic_en: 'Gentamicin', form: 'injection', strength: '80 mg/2 mL', route: 'IV' },
  { generic_ar: 'فانكومايسين', generic_en: 'Vancomycin', form: 'injection', strength: '500 mg', route: 'IV' },
  { generic_ar: 'كوتريموكسازول', generic_en: 'Co-trimoxazole', brand_ar: 'سبترين', brand_en: 'Septrin', form: 'tablet', strength: '960 mg', route: 'PO' },

  // ——— جهاز هضمي ———
  { generic_ar: 'اوميبرازول', generic_en: 'Omeprazole', brand_ar: 'لوسيك', brand_en: 'Losec', form: 'injection', strength: '40 mg', route: 'IV' },
  { generic_ar: 'بانتوبرازول', generic_en: 'Pantoprazole', brand_ar: 'كنترولوك', brand_en: 'Controloc', form: 'injection', strength: '40 mg', route: 'IV' },
  { generic_ar: 'رانيتيدين', generic_en: 'Ranitidine', form: 'injection', strength: '50 mg/2 mL', route: 'IV' },
  { generic_ar: 'اوندانسيترون', generic_en: 'Ondansetron', brand_ar: 'زوفران', brand_en: 'Zofran', form: 'injection', strength: '4 mg/2 mL', route: 'IV' },
  { generic_ar: 'ميتوكلوبراميد', generic_en: 'Metoclopramide', brand_ar: 'بريمبران', brand_en: 'Primperan', form: 'injection', strength: '10 mg/2 mL', route: 'IV' },
  { generic_ar: 'هيوسين', generic_en: 'Hyoscine', brand_ar: 'بسكوبان', brand_en: 'Buscopan', form: 'injection', strength: '20 mg/mL', route: 'IM' },

  // ——— قلب وضغط ———
  { generic_ar: 'املوديبين', generic_en: 'Amlodipine', brand_ar: 'نورفاسك', brand_en: 'Norvasc', form: 'tablet', strength: '5 mg', route: 'PO' },
  { generic_ar: 'ليزينوبريل', generic_en: 'Lisinopril', form: 'tablet', strength: '10 mg', route: 'PO' },
  { generic_ar: 'ميتوبرولول', generic_en: 'Metoprolol', brand_ar: 'لوبريسور', brand_en: 'Lopressor', form: 'tablet', strength: '50 mg', route: 'PO' },
  { generic_ar: 'بيسوبرولول', generic_en: 'Bisoprolol', brand_ar: 'كونكور', brand_en: 'Concor', form: 'tablet', strength: '5 mg', route: 'PO' },
  { generic_ar: 'فوروسيمايد', generic_en: 'Furosemide', brand_ar: 'لازيكس', brand_en: 'Lasix', form: 'injection', strength: '20 mg/2 mL', route: 'IV' },
  { generic_ar: 'سبيرونولاكتون', generic_en: 'Spironolactone', brand_ar: 'الداكتون', brand_en: 'Aldactone', form: 'tablet', strength: '25 mg', route: 'PO' },
  { generic_ar: 'اتورفاستاتين', generic_en: 'Atorvastatin', brand_ar: 'ليبيتور', brand_en: 'Lipitor', form: 'tablet', strength: '20 mg', route: 'PO' },
  { generic_ar: 'اسبرين', generic_en: 'Aspirin', form: 'tablet', strength: '100 mg', route: 'PO' },
  { generic_ar: 'كلوبيدوجريل', generic_en: 'Clopidogrel', brand_ar: 'بلافيكس', brand_en: 'Plavix', form: 'tablet', strength: '75 mg', route: 'PO' },
  { generic_ar: 'وارفارين', generic_en: 'Warfarin', form: 'tablet', strength: '5 mg', route: 'PO' },
  { generic_ar: 'هيبارين', generic_en: 'Heparin', form: 'injection', strength: '5000 IU/mL', route: 'IV' },
  { generic_ar: 'انوكسابارين', generic_en: 'Enoxaparin', brand_ar: 'كليكسان', brand_en: 'Clexane', form: 'injection', strength: '40 mg/0.4 mL', route: 'SC' },
  { generic_ar: 'ديجوكسين', generic_en: 'Digoxin', form: 'tablet', strength: '0.25 mg', route: 'PO' },
  { generic_ar: 'اميودارون', generic_en: 'Amiodarone', brand_ar: 'كوردارون', brand_en: 'Cordarone', form: 'injection', strength: '150 mg/3 mL', route: 'IV' },
  { generic_ar: 'نيتروجليسرين', generic_en: 'Nitroglycerin', form: 'patch', strength: '5 mg', route: 'Topical' },

  // ——— سكري وغدد ———
  { generic_ar: 'ميتفورمين', generic_en: 'Metformin', brand_ar: 'كلوكوفاج', brand_en: 'Glucophage', form: 'tablet', strength: '500 mg', route: 'PO' },
  { generic_ar: 'غليكلازيد', generic_en: 'Gliclazide', brand_ar: 'ديامكرون', brand_en: 'Diamicron', form: 'tablet', strength: '80 mg', route: 'PO' },
  { generic_ar: 'انسولين قصير المفعول', generic_en: 'Insulin regular', brand_ar: 'اكترابيد', brand_en: 'Actrapid', form: 'injection', strength: '100 IU/mL', route: 'SC' },
  { generic_ar: 'انسولين طويل المفعول', generic_en: 'Insulin glargine', brand_ar: 'لانتوس', brand_en: 'Lantus', form: 'injection', strength: '100 IU/mL', route: 'SC' },
  { generic_ar: 'ليفوثيروكسين', generic_en: 'Levothyroxine', brand_ar: 'يوثيروكس', brand_en: 'Euthyrox', form: 'tablet', strength: '100 mcg', route: 'PO' },
  { generic_ar: 'هيدروكورتيزون', generic_en: 'Hydrocortisone', form: 'injection', strength: '100 mg', route: 'IV' },
  { generic_ar: 'ديكساميثازون', generic_en: 'Dexamethasone', form: 'injection', strength: '8 mg/2 mL', route: 'IV' },
  { generic_ar: 'بريدنيزولون', generic_en: 'Prednisolone', form: 'tablet', strength: '5 mg', route: 'PO' },

  // ——— جهاز تنفسي وحساسية ———
  { generic_ar: 'سالبوتامول', generic_en: 'Salbutamol', brand_ar: 'فنتولين', brand_en: 'Ventolin', form: 'inhaler', strength: '100 mcg', route: 'Inhalation' },
  { generic_ar: 'ايبراتروبيوم', generic_en: 'Ipratropium', brand_ar: 'اتروفنت', brand_en: 'Atrovent', form: 'inhaler', strength: '20 mcg', route: 'Inhalation' },
  { generic_ar: 'امينوفيلين', generic_en: 'Aminophylline', form: 'injection', strength: '250 mg/10 mL', route: 'IV' },
  { generic_ar: 'كلورفينيرامين', generic_en: 'Chlorpheniramine', form: 'injection', strength: '10 mg/mL', route: 'IM' },
  { generic_ar: 'لوراتادين', generic_en: 'Loratadine', brand_ar: 'كلاريتين', brand_en: 'Claritine', form: 'tablet', strength: '10 mg', route: 'PO' },

  // ——— أعصاب ومهدئات ———
  { generic_ar: 'ديازيبام', generic_en: 'Diazepam', brand_ar: 'فاليوم', brand_en: 'Valium', form: 'injection', strength: '10 mg/2 mL', route: 'IV', controlled: true },
  { generic_ar: 'ميدازولام', generic_en: 'Midazolam', form: 'injection', strength: '5 mg/mL', route: 'IV', controlled: true },
  { generic_ar: 'فينيتوين', generic_en: 'Phenytoin', form: 'injection', strength: '250 mg/5 mL', route: 'IV' },
  { generic_ar: 'حامض الفالبرويك', generic_en: 'Sodium valproate', brand_ar: 'ديباكين', brand_en: 'Depakine', form: 'tablet', strength: '500 mg', route: 'PO' },

  // ——— محاليل وريدية وكهارل ———
  { generic_ar: 'محلول ملحي طبيعي', generic_en: 'Normal saline 0.9%', form: 'iv_fluid', strength: '1000 mL', route: 'IV' },
  { generic_ar: 'محلول دكستروز 5%', generic_en: 'Dextrose 5%', form: 'iv_fluid', strength: '500 mL', route: 'IV' },
  { generic_ar: 'رينجر لاكتات', generic_en: "Ringer's lactate", form: 'iv_fluid', strength: '1000 mL', route: 'IV' },
  { generic_ar: 'كلوريد البوتاسيوم', generic_en: 'Potassium chloride', form: 'injection', strength: '20 mEq/10 mL', route: 'IV' },
  { generic_ar: 'كبريتات المغنيسيوم', generic_en: 'Magnesium sulfate', form: 'injection', strength: '2 g/10 mL', route: 'IV' },
  { generic_ar: 'كلوريد الكالسيوم', generic_en: 'Calcium chloride', form: 'injection', strength: '1 g/10 mL', route: 'IV' },

  // ——— مضادات تخثر/أخرى ———
  { generic_ar: 'حامض الترانيكساميك', generic_en: 'Tranexamic acid', form: 'injection', strength: '500 mg/5 mL', route: 'IV' },
  { generic_ar: 'فيتامين ك', generic_en: 'Vitamin K', form: 'injection', strength: '10 mg/mL', route: 'IM' },
  { generic_ar: 'اوكسيتوسين', generic_en: 'Oxytocin', form: 'injection', strength: '10 IU/mL', route: 'IV' },
  { generic_ar: 'اديرينالين', generic_en: 'Adrenaline (Epinephrine)', form: 'injection', strength: '1 mg/mL', route: 'IV' },
  { generic_ar: 'اتروبين', generic_en: 'Atropine', form: 'injection', strength: '1 mg/mL', route: 'IV' },
];
