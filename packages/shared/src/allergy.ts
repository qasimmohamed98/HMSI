/**
 * فحص الحساسية الدوائية عند الوصف.
 * قاموس مبسّط لأشهر الفئات الدوائية (أسماء علمية وتجارية شائعة بالعربية والإنجليزية)
 * مع التفاعلات المتصالبة المعروفة (بنسلين ↔ سيفالوسبورين ↔ كاربابينيم ...).
 * الغرض تنبيه الطبيب لا منعه: التجاوز ممكن بسبب مكتوب يُحفظ في السجل.
 * ليس بديلاً عن مرجع دوائي معتمد.
 */

export interface DrugClass {
  id: string;
  ar: string;
  en: string;
  /** كلمات تدل على الفئة في نص الحساسية (لا تُطابق على اسم الدواء: sulfa ≠ sulfate) */
  terms: string[];
  /** أدوية الفئة (علمية وتجارية) */
  drugs: string[];
  /** فئات بينها تفاعل متصالب محتمل */
  cross?: string[];
}

export const DRUG_CLASSES: DrugClass[] = [
  {
    id: 'penicillins',
    ar: 'البنسلينات',
    en: 'Penicillins',
    terms: ['penicillin', 'بنسلين', 'بنسيلين', 'بنيسيلين', 'beta-lactam', 'بيتا لاكتام'],
    drugs: [
      'penicillin', 'amoxicillin', 'amoxycillin', 'amoxil', 'augmentin', 'co-amoxiclav', 'amoxiclav', 'ampicillin', 'ampiclox',
      'cloxacillin', 'flucloxacillin', 'dicloxacillin', 'oxacillin', 'nafcillin', 'piperacillin', 'tazocin', 'benzathine', 'benzylpenicillin', 'unasyn', 'sulbactam',
      'بنسلين', 'بنسيلين', 'اموكسيسيلين', 'اموكسيلين', 'اموكسل', 'اوجمنتين', 'اوغمنتين', 'اجمنتين', 'امبيسيلين', 'امبيكلوكس',
      'كلوكساسيلين', 'فلوكلوكساسيلين', 'بيبراسيلين', 'تازوسين',
    ],
    cross: ['cephalosporins', 'carbapenems'],
  },
  {
    id: 'cephalosporins',
    ar: 'السيفالوسبورينات',
    en: 'Cephalosporins',
    terms: ['cephalosporin', 'سيفالوسبورين', 'سيفالوسبورينات'],
    drugs: [
      'ceftriaxone', 'rocephin', 'cefotaxime', 'claforan', 'cefuroxime', 'zinnat', 'cefazolin', 'cefalexin', 'cephalexin', 'keflex', 'cefixime', 'suprax',
      'ceftazidime', 'fortum', 'cefepime', 'cefoperazone', 'cefaclor', 'cefdinir', 'cefpodoxime', 'cefadroxil', 'cephradine', 'ceftaroline',
      'سيفترياكسون', 'سيفتراياكسون', 'روسيفين', 'سيفوتاكسيم', 'كلافوران', 'سيفوروكسيم', 'زينات', 'سيفازولين', 'سيفالكسين', 'كيفلكس',
      'سيفيكسيم', 'سوبراكس', 'سيفتازيديم', 'فورتم', 'سيفيبيم', 'سيفوبيرازون', 'سيفاكلور', 'سيفادروكسيل', 'سيفرادين',
    ],
    cross: ['penicillins', 'carbapenems'],
  },
  {
    id: 'carbapenems',
    ar: 'الكاربابينيمات',
    en: 'Carbapenems',
    terms: ['carbapenem', 'كاربابينيم'],
    drugs: ['meropenem', 'meronem', 'imipenem', 'tienam', 'ertapenem', 'invanz', 'doripenem', 'ميروبينيم', 'ميرونيم', 'ايميبينيم', 'تينام', 'ارتابينيم', 'انفانز'],
    cross: ['penicillins', 'cephalosporins'],
  },
  {
    id: 'sulfonamides',
    ar: 'السلفوناميدات (سلفا)',
    en: 'Sulfonamides (sulfa)',
    terms: ['sulfa', 'sulpha', 'sulfonamide', 'سلفا', 'سلفوناميد', 'سلفا دوائية'],
    drugs: [
      'sulfamethoxazole', 'co-trimoxazole', 'cotrimoxazole', 'bactrim', 'septrin', 'sulfasalazine', 'sulfadiazine', 'dapsone',
      'سلفاميثوكسازول', 'كوتريموكسازول', 'باكتريم', 'سبترين', 'سلفاسالازين', 'سلفاديازين', 'دابسون',
    ],
  },
  {
    id: 'nsaids',
    ar: 'مضادات الالتهاب غير الستيرويدية والأسبرين',
    en: 'NSAIDs & aspirin',
    terms: ['nsaid', 'aspirin', 'salicylate', 'مضادات الالتهاب', 'مسكنات الالتهاب', 'اسبرين', 'اسبيرين', 'ساليسيلات'],
    drugs: [
      'ibuprofen', 'brufen', 'advil', 'diclofenac', 'voltaren', 'cataflam', 'naproxen', 'ketorolac', 'toradol', 'ketoprofen', 'indomethacin',
      'meloxicam', 'mobic', 'piroxicam', 'celecoxib', 'celebrex', 'etoricoxib', 'arcoxia', 'mefenamic', 'ponstan', 'aspirin', 'acetylsalicylic', 'aspocid',
      'ايبوبروفين', 'بروفين', 'ادفيل', 'ديكلوفيناك', 'فولتارين', 'كتافلام', 'نابروكسين', 'كيتورولاك', 'كيتوبروفين', 'اندوميثاسين',
      'ميلوكسيكام', 'موبيك', 'بيروكسيكام', 'سيليكوكسيب', 'سيليبركس', 'اركوكسيا', 'بونستان', 'حمض الميفيناميك', 'اسبرين', 'اسبيرين', 'اسبوسيد',
    ],
  },
  {
    id: 'macrolides',
    ar: 'الماكرولايدات',
    en: 'Macrolides',
    terms: ['macrolide', 'ماكرولايد', 'ماكروليد'],
    drugs: ['erythromycin', 'azithromycin', 'zithromax', 'clarithromycin', 'klacid', 'اريثرومايسين', 'ازيثرومايسين', 'ازيثروميسين', 'زيثروماكس', 'كلاريثرومايسين', 'كلاسيد'],
  },
  {
    id: 'quinolones',
    ar: 'الكينولونات',
    en: 'Fluoroquinolones',
    terms: ['quinolone', 'fluoroquinolone', 'كينولون', 'فلوروكينولون'],
    drugs: [
      'ciprofloxacin', 'cipro', 'ciprobay', 'levofloxacin', 'tavanic', 'moxifloxacin', 'avelox', 'ofloxacin', 'norfloxacin',
      'سيبروفلوكساسين', 'سيبرو', 'سيبروباي', 'ليفوفلوكساسين', 'تافانيك', 'موكسيفلوكساسين', 'افيلوكس', 'اوفلوكساسين', 'نورفلوكساسين',
    ],
  },
  {
    id: 'aminoglycosides',
    ar: 'الأمينوغليكوزيدات',
    en: 'Aminoglycosides',
    terms: ['aminoglycoside', 'امينوغليكوزيد', 'امينوجليكوسيد'],
    drugs: ['gentamicin', 'amikacin', 'tobramycin', 'streptomycin', 'neomycin', 'جنتامايسين', 'جنتاميسين', 'اميكاسين', 'توبرامايسين', 'ستربتومايسين', 'نيومايسين'],
  },
  {
    id: 'tetracyclines',
    ar: 'التتراسيكلينات',
    en: 'Tetracyclines',
    terms: ['tetracycline', 'تتراسيكلين'],
    drugs: ['doxycycline', 'tetracycline', 'minocycline', 'tigecycline', 'دوكسيسيكلين', 'تتراسيكلين', 'مينوسيكلين', 'تيجيسيكلين'],
  },
  {
    id: 'glycopeptides',
    ar: 'الغليكوببتيدات',
    en: 'Glycopeptides',
    terms: ['glycopeptide', 'vancomycin', 'فانكومايسين'],
    drugs: ['vancomycin', 'teicoplanin', 'targocid', 'فانكومايسين', 'فانكوميسين', 'تيكوبلانين', 'تارجوسيد'],
  },
  {
    id: 'nitroimidazoles',
    ar: 'ميترونيدازول ومشتقاته',
    en: 'Nitroimidazoles',
    terms: ['metronidazole', 'flagyl', 'ميترونيدازول', 'فلاجيل'],
    drugs: ['metronidazole', 'flagyl', 'tinidazole', 'ميترونيدازول', 'فلاجيل', 'فلاجل', 'تينيدازول'],
  },
  {
    id: 'opioids',
    ar: 'الأفيونات',
    en: 'Opioids',
    terms: ['opioid', 'opiate', 'افيون', 'افيونات', 'مورفين', 'morphine', 'codeine', 'كودايين'],
    drugs: [
      'morphine', 'codeine', 'tramadol', 'tramal', 'pethidine', 'meperidine', 'fentanyl', 'oxycodone', 'hydromorphone', 'methadone', 'nalbuphine', 'buprenorphine',
      'مورفين', 'كودايين', 'كوديين', 'ترامادول', 'ترامال', 'بيثيدين', 'فنتانيل', 'اوكسيكودون', 'ميثادون', 'نالبوفين', 'بوبرينورفين',
    ],
  },
  {
    id: 'paracetamol',
    ar: 'الباراسيتامول',
    en: 'Paracetamol',
    terms: ['paracetamol', 'acetaminophen', 'باراسيتامول', 'بارسيتامول'],
    drugs: ['paracetamol', 'acetaminophen', 'panadol', 'perfalgan', 'tylenol', 'adol', 'باراسيتامول', 'بارسيتامول', 'بنادول', 'بانادول', 'بيرفالجان', 'تايلينول', 'ادول'],
  },
  {
    id: 'anticonvulsants',
    ar: 'مضادات الصرع العطرية',
    en: 'Aromatic anticonvulsants',
    terms: ['anticonvulsant', 'antiepileptic', 'مضادات الصرع'],
    drugs: [
      'carbamazepine', 'tegretol', 'phenytoin', 'epanutin', 'phenobarbital', 'lamotrigine', 'lamictal', 'oxcarbazepine', 'trileptal',
      'كاربامازيبين', 'تجريتول', 'فينيتوين', 'ابانوتين', 'فينوباربيتال', 'لاموتريجين', 'لاميكتال', 'اوكسكاربازيبين', 'تريليبتال',
    ],
    cross: ['anticonvulsants'],
  },
  {
    id: 'heparins',
    ar: 'الهيبارينات',
    en: 'Heparins',
    terms: ['heparin', 'هيبارين'],
    drugs: ['heparin', 'enoxaparin', 'clexane', 'lovenox', 'dalteparin', 'tinzaparin', 'هيبارين', 'اينوكسابارين', 'كليكسان', 'كلكسان', 'دالتيبارين'],
  },
  {
    id: 'ace_inhibitors',
    ar: 'مثبطات الإنزيم المحوّل للأنجيوتنسين',
    en: 'ACE inhibitors',
    terms: ['ace inhibitor', 'مثبطات الانزيم المحول'],
    drugs: [
      'captopril', 'enalapril', 'lisinopril', 'ramipril', 'perindopril', 'fosinopril', 'zestril', 'tritace', 'coversyl',
      'كابتوبريل', 'اينالابريل', 'ليسينوبريل', 'راميبريل', 'بيريندوبريل', 'زيستريل', 'ترايتيس', 'كوفرسيل',
    ],
  },
  {
    id: 'iodine',
    ar: 'اليود والصبغات اليودية',
    en: 'Iodine & iodinated contrast',
    terms: ['iodine', 'contrast', 'يود', 'اليود', 'صبغه يود', 'صبغة يود', 'الصبغة اليودية', 'صبغة الأشعة'],
    drugs: ['iohexol', 'omnipaque', 'iopamidol', 'iodixanol', 'visipaque', 'povidone', 'betadine', 'امنيباك', 'اومنيباك', 'فيزيباك', 'بيتادين', 'بوفيدون'],
  },
];

export type AllergyConflictKind = 'direct' | 'class' | 'cross';

export interface AllergyConflict {
  /** نص الحساسية كما في ملف المريض */
  allergy: string;
  kind: AllergyConflictKind;
  class_ar: string | null;
  class_en: string | null;
}

/** توحيد النص: حروف صغيرة، حذف التشكيل والتطويل، توحيد الألف والياء والتاء المربوطة */
export function normalizeDrugText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

const N = DRUG_CLASSES.map((c) => ({
  cls: c,
  terms: [...c.terms, ...c.drugs].map(normalizeDrugText),
  drugs: c.drugs.map(normalizeDrugText),
}));

/** هل الكلمة موجودة في النص كبداية كلمة (يمنع مطابقة "adol" داخل "paracetamol" مثلاً) */
function hasWord(text: string, word: string): boolean {
  let i = text.indexOf(word);
  while (i !== -1) {
    if (i === 0 || /[\s(/,\-+.،:]/.test(text[i - 1]!)) return true;
    i = text.indexOf(word, i + 1);
  }
  return false;
}

function allergyClasses(allergy: string): Set<string> {
  const a = normalizeDrugText(allergy);
  return new Set(N.filter((n) => n.terms.some((w) => hasWord(a, w))).map((n) => n.cls.id));
}

function drugClasses(drugName: string): Set<string> {
  const d = normalizeDrugText(drugName);
  return new Set(N.filter((n) => n.drugs.some((w) => hasWord(d, w))).map((n) => n.cls.id));
}

/**
 * يقارن الدواء الموصوف (بكل أسمائه) بحساسيات المريض.
 * - class: الدواء من نفس فئة الحساسية
 * - cross: تفاعل متصالب محتمل مع فئة الحساسية
 * - direct: حساسية غير معروفة في القاموس لكن نصّها ورد في اسم الدواء
 */
export function findAllergyConflicts(drugNames: (string | null | undefined)[], allergies: string[]): AllergyConflict[] {
  const names = drugNames.filter((n): n is string => Boolean(n && n.trim()));
  if (names.length === 0) return [];
  const dClasses = new Set(names.flatMap((n) => [...drugClasses(n)]));
  const byId = new Map(DRUG_CLASSES.map((c) => [c.id, c]));
  const out: AllergyConflict[] = [];

  for (const allergy of allergies) {
    if (!allergy || !allergy.trim()) continue;
    const aClasses = allergyClasses(allergy);
    const same = [...aClasses].find((id) => dClasses.has(id));
    if (same) {
      const c = byId.get(same)!;
      out.push({ allergy, kind: 'class', class_ar: c.ar, class_en: c.en });
      continue;
    }
    const cross = [...aClasses].flatMap((id) => byId.get(id)!.cross ?? []).find((id) => dClasses.has(id));
    if (cross) {
      const c = byId.get(cross)!;
      out.push({ allergy, kind: 'cross', class_ar: c.ar, class_en: c.en });
      continue;
    }
    if (aClasses.size === 0) {
      // حساسية لمادة غير موجودة في القاموس: مطابقة نصية مباشرة لأجزائها
      const parts = normalizeDrugText(allergy)
        .split(/[()[\]/,،;:+]|\s-\s/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 4);
      const hit = names.some((n) => {
        const d = normalizeDrugText(n);
        return parts.some((p) => hasWord(d, p) || (d.length >= 4 && hasWord(p, d)));
      });
      if (hit) out.push({ allergy, kind: 'direct', class_ar: null, class_en: null });
    }
  }
  return out;
}
