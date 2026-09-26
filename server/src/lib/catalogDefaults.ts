import type { Modality, ServiceKind } from '@hmsi/shared';

/**
 * كتالوج جاهز يستورده المستشفى ثم يعدّله (الأسعار فارغة — يضعها كل مستشفى).
 * التحضير مكتوب للمريض ويُطبع مع الموعد. راجعه مع طبيب الأشعة ومدير المختبر في كل مستشفى.
 */
export interface DefaultService {
  kind: ServiceKind;
  code: string;
  ar: string;
  en: string;
  modality?: Modality;
  body_part?: string;
  prep_ar?: string;
  prep_en?: string;
  /** فحص بصبغة */
  contrast?: boolean;
}

const CONTRAST_AR = 'فحص بصبغة: صيام 4 ساعات، وتحليل وظائف الكلى (Creatinine) خلال آخر شهر، وأخبر الطاقم عن أي حساسية أو حمل أو مرض السكري (دواء الميتفورمين).';
const CONTRAST_EN = 'Contrast study: fast for 4 hours, bring a kidney function test (creatinine) from the last month, and tell staff about any allergy, pregnancy or diabetes (metformin).';
const MR_AR = 'أخبر الطاقم قبل الفحص إن كان لديك منظّم ضربات قلب، أو صمامات، أو مسامير وشرائح معدنية، أو أي جهاز مزروع. انزع كل المعادن. الفحص يستغرق 20–45 دقيقة.';
const MR_EN = 'Tell staff before the scan if you have a pacemaker, heart valves, metal plates or screws, or any implanted device. Remove all metal. The scan takes 20–45 minutes.';
const ABD_US_AR = 'صيام 6–8 ساعات قبل الفحص (يُسمح بالماء).';
const ABD_US_EN = 'Fast for 6–8 hours before the scan (water is allowed).';
const PELVIS_US_AR = 'اشرب لتراً من الماء قبل ساعة من الفحص ولا تفرغ المثانة.';
const PELVIS_US_EN = 'Drink one litre of water an hour before the scan and do not empty your bladder.';

export const DEFAULT_SERVICES: DefaultService[] = [
  // ——— الأشعة السينية
  { kind: 'imaging', modality: 'XR', code: 'XR-CHEST-PA', ar: 'أشعة صدر (أمامية خلفية)', en: 'Chest X-ray (PA)', body_part: 'chest' },
  { kind: 'imaging', modality: 'XR', code: 'XR-CHEST-LAT', ar: 'أشعة صدر جانبية', en: 'Chest X-ray (lateral)', body_part: 'chest' },
  { kind: 'imaging', modality: 'XR', code: 'XR-ABD-ERECT', ar: 'أشعة بطن واقف', en: 'Abdominal X-ray (erect)', body_part: 'abdomen' },
  { kind: 'imaging', modality: 'XR', code: 'XR-KUB', ar: 'أشعة الكلى والحالبين والمثانة (KUB)', en: 'KUB X-ray', body_part: 'abdomen' },
  { kind: 'imaging', modality: 'XR', code: 'XR-SKULL', ar: 'أشعة جمجمة', en: 'Skull X-ray', body_part: 'head' },
  { kind: 'imaging', modality: 'XR', code: 'XR-SINUS', ar: 'أشعة الجيوب الأنفية', en: 'Sinus X-ray', body_part: 'head' },
  { kind: 'imaging', modality: 'XR', code: 'XR-CSPINE', ar: 'أشعة الفقرات العنقية', en: 'Cervical spine X-ray', body_part: 'spine' },
  { kind: 'imaging', modality: 'XR', code: 'XR-LSPINE', ar: 'أشعة الفقرات القطنية', en: 'Lumbar spine X-ray', body_part: 'spine' },
  { kind: 'imaging', modality: 'XR', code: 'XR-PELVIS', ar: 'أشعة الحوض', en: 'Pelvis X-ray', body_part: 'pelvis' },
  { kind: 'imaging', modality: 'XR', code: 'XR-HIP', ar: 'أشعة مفصل الورك', en: 'Hip X-ray', body_part: 'hip' },
  { kind: 'imaging', modality: 'XR', code: 'XR-KNEE', ar: 'أشعة الركبة', en: 'Knee X-ray', body_part: 'knee' },
  { kind: 'imaging', modality: 'XR', code: 'XR-ANKLE', ar: 'أشعة الكاحل', en: 'Ankle X-ray', body_part: 'ankle' },
  { kind: 'imaging', modality: 'XR', code: 'XR-FOOT', ar: 'أشعة القدم', en: 'Foot X-ray', body_part: 'foot' },
  { kind: 'imaging', modality: 'XR', code: 'XR-SHOULDER', ar: 'أشعة الكتف', en: 'Shoulder X-ray', body_part: 'shoulder' },
  { kind: 'imaging', modality: 'XR', code: 'XR-ELBOW', ar: 'أشعة المرفق', en: 'Elbow X-ray', body_part: 'elbow' },
  { kind: 'imaging', modality: 'XR', code: 'XR-WRIST', ar: 'أشعة الرسغ', en: 'Wrist X-ray', body_part: 'wrist' },
  { kind: 'imaging', modality: 'XR', code: 'XR-HAND', ar: 'أشعة اليد', en: 'Hand X-ray', body_part: 'hand' },
  // ——— المفراس
  { kind: 'imaging', modality: 'CT', code: 'CT-HEAD', ar: 'مفراس رأس بدون صبغة', en: 'CT head without contrast', body_part: 'head' },
  { kind: 'imaging', modality: 'CT', code: 'CT-HEAD-C', ar: 'مفراس رأس مع صبغة', en: 'CT head with contrast', body_part: 'head', prep_ar: CONTRAST_AR, prep_en: CONTRAST_EN, contrast: true },
  { kind: 'imaging', modality: 'CT', code: 'CT-SINUS', ar: 'مفراس الجيوب الأنفية', en: 'CT sinuses', body_part: 'head' },
  { kind: 'imaging', modality: 'CT', code: 'CT-CHEST', ar: 'مفراس صدر', en: 'CT chest', body_part: 'chest' },
  { kind: 'imaging', modality: 'CT', code: 'CT-CHEST-HR', ar: 'مفراس صدر عالي الدقة (HRCT)', en: 'High-resolution CT chest', body_part: 'chest' },
  { kind: 'imaging', modality: 'CT', code: 'CT-ABD-PEL-C', ar: 'مفراس بطن وحوض مع صبغة', en: 'CT abdomen and pelvis with contrast', body_part: 'abdomen', prep_ar: CONTRAST_AR, prep_en: CONTRAST_EN, contrast: true },
  { kind: 'imaging', modality: 'CT', code: 'CT-KUB', ar: 'مفراس المسالك البولية بدون صبغة (حصى)', en: 'CT KUB (stone protocol)', body_part: 'abdomen' },
  { kind: 'imaging', modality: 'CT', code: 'CT-CSPINE', ar: 'مفراس الفقرات العنقية', en: 'CT cervical spine', body_part: 'spine' },
  { kind: 'imaging', modality: 'CT', code: 'CT-LSPINE', ar: 'مفراس الفقرات القطنية', en: 'CT lumbar spine', body_part: 'spine' },
  { kind: 'imaging', modality: 'CT', code: 'CTA-PULM', ar: 'مفراس الشرايين الرئوية (CTPA)', en: 'CT pulmonary angiography', body_part: 'chest', prep_ar: CONTRAST_AR, prep_en: CONTRAST_EN, contrast: true },
  { kind: 'imaging', modality: 'CT', code: 'CTA-BRAIN', ar: 'مفراس شرايين الدماغ', en: 'CT angiography of the brain', body_part: 'head', prep_ar: CONTRAST_AR, prep_en: CONTRAST_EN, contrast: true },
  // ——— الرنين
  { kind: 'imaging', modality: 'MR', code: 'MR-BRAIN', ar: 'رنين الدماغ', en: 'MRI brain', body_part: 'head', prep_ar: MR_AR, prep_en: MR_EN },
  { kind: 'imaging', modality: 'MR', code: 'MR-BRAIN-C', ar: 'رنين الدماغ مع صبغة', en: 'MRI brain with contrast', body_part: 'head', prep_ar: `${MR_AR} ${CONTRAST_AR}`, prep_en: `${MR_EN} ${CONTRAST_EN}`, contrast: true },
  { kind: 'imaging', modality: 'MR', code: 'MR-CSPINE', ar: 'رنين الفقرات العنقية', en: 'MRI cervical spine', body_part: 'spine', prep_ar: MR_AR, prep_en: MR_EN },
  { kind: 'imaging', modality: 'MR', code: 'MR-LSPINE', ar: 'رنين الفقرات القطنية', en: 'MRI lumbar spine', body_part: 'spine', prep_ar: MR_AR, prep_en: MR_EN },
  { kind: 'imaging', modality: 'MR', code: 'MR-KNEE', ar: 'رنين الركبة', en: 'MRI knee', body_part: 'knee', prep_ar: MR_AR, prep_en: MR_EN },
  { kind: 'imaging', modality: 'MR', code: 'MR-SHOULDER', ar: 'رنين الكتف', en: 'MRI shoulder', body_part: 'shoulder', prep_ar: MR_AR, prep_en: MR_EN },
  { kind: 'imaging', modality: 'MR', code: 'MR-ABD', ar: 'رنين البطن', en: 'MRI abdomen', body_part: 'abdomen', prep_ar: `${MR_AR} ${ABD_US_AR}`, prep_en: `${MR_EN} ${ABD_US_EN}` },
  { kind: 'imaging', modality: 'MR', code: 'MRCP', ar: 'رنين القنوات الصفراوية (MRCP)', en: 'MRCP', body_part: 'abdomen', prep_ar: `${MR_AR} ${ABD_US_AR}`, prep_en: `${MR_EN} ${ABD_US_EN}` },
  { kind: 'imaging', modality: 'MR', code: 'MR-PELVIS', ar: 'رنين الحوض', en: 'MRI pelvis', body_part: 'pelvis', prep_ar: MR_AR, prep_en: MR_EN },
  // ——— السونار
  { kind: 'imaging', modality: 'US', code: 'US-ABD', ar: 'سونار بطن كامل', en: 'Abdominal ultrasound', body_part: 'abdomen', prep_ar: ABD_US_AR, prep_en: ABD_US_EN },
  { kind: 'imaging', modality: 'US', code: 'US-PELVIS', ar: 'سونار حوض', en: 'Pelvic ultrasound', body_part: 'pelvis', prep_ar: PELVIS_US_AR, prep_en: PELVIS_US_EN },
  { kind: 'imaging', modality: 'US', code: 'US-KUB', ar: 'سونار المسالك البولية', en: 'Renal and bladder ultrasound', body_part: 'abdomen', prep_ar: PELVIS_US_AR, prep_en: PELVIS_US_EN },
  { kind: 'imaging', modality: 'US', code: 'US-OB', ar: 'سونار حمل', en: 'Obstetric ultrasound', body_part: 'pelvis' },
  { kind: 'imaging', modality: 'US', code: 'US-THYROID', ar: 'سونار الغدة الدرقية', en: 'Thyroid ultrasound', body_part: 'neck' },
  { kind: 'imaging', modality: 'US', code: 'US-NECK', ar: 'سونار الرقبة', en: 'Neck ultrasound', body_part: 'neck' },
  { kind: 'imaging', modality: 'US', code: 'US-BREAST', ar: 'سونار الثدي', en: 'Breast ultrasound', body_part: 'breast' },
  { kind: 'imaging', modality: 'US', code: 'US-SCROTUM', ar: 'سونار الصفن', en: 'Scrotal ultrasound', body_part: 'pelvis' },
  { kind: 'imaging', modality: 'US', code: 'US-DOP-LL-V', ar: 'دوبلر أوردة الساقين', en: 'Lower-limb venous Doppler', body_part: 'leg' },
  { kind: 'imaging', modality: 'US', code: 'US-DOP-CAROTID', ar: 'دوبلر الشرايين السباتية', en: 'Carotid Doppler', body_part: 'neck' },
  // ——— أخرى
  { kind: 'imaging', modality: 'MG', code: 'MG-BILAT', ar: 'ماموغرام للثديين', en: 'Bilateral mammography', body_part: 'breast', prep_ar: 'لا تستخدمي مزيل العرق أو البودرة يوم الفحص.', prep_en: 'Do not use deodorant or powder on the day of the exam.' },
  { kind: 'imaging', modality: 'RF', code: 'RF-BA-SWALLOW', ar: 'بلع الباريوم', en: 'Barium swallow', body_part: 'chest', prep_ar: 'صيام 6 ساعات.', prep_en: 'Fast for 6 hours.' },
  { kind: 'imaging', modality: 'RF', code: 'RF-HSG', ar: 'أشعة الرحم والأنابيب بالصبغة (HSG)', en: 'Hysterosalpingography (HSG)', body_part: 'pelvis', prep_ar: 'يُجرى بين اليوم 7 و10 من الدورة.', prep_en: 'Performed between day 7 and 10 of the cycle.' },
  { kind: 'imaging', modality: 'DXA', code: 'DXA-SPINE-HIP', ar: 'كثافة العظام (الفقرات والورك)', en: 'Bone density (spine and hip)', body_part: 'spine' },

  // ——— المختبر
  { kind: 'lab', code: 'CBC', ar: 'صورة الدم الكاملة', en: 'Complete blood count' },
  { kind: 'lab', code: 'ESR', ar: 'سرعة الترسيب', en: 'ESR' },
  { kind: 'lab', code: 'CRP', ar: 'البروتين التفاعلي (CRP)', en: 'C-reactive protein' },
  { kind: 'lab', code: 'FBS', ar: 'سكر صائم', en: 'Fasting blood sugar' },
  { kind: 'lab', code: 'RBS', ar: 'سكر عشوائي', en: 'Random blood sugar' },
  { kind: 'lab', code: 'HBA1C', ar: 'السكر التراكمي', en: 'HbA1c' },
  { kind: 'lab', code: 'UREA', ar: 'اليوريا', en: 'Blood urea' },
  { kind: 'lab', code: 'CREAT', ar: 'الكرياتينين', en: 'Serum creatinine' },
  { kind: 'lab', code: 'ELECT', ar: 'الأملاح (صوديوم، بوتاسيوم، كلور)', en: 'Electrolytes (Na, K, Cl)' },
  { kind: 'lab', code: 'CA', ar: 'الكالسيوم', en: 'Calcium' },
  { kind: 'lab', code: 'MG', ar: 'المغنيسيوم', en: 'Magnesium' },
  { kind: 'lab', code: 'PHOS', ar: 'الفسفور', en: 'Phosphate' },
  { kind: 'lab', code: 'URIC', ar: 'حامض اليوريك', en: 'Uric acid' },
  { kind: 'lab', code: 'LFT', ar: 'وظائف الكبد', en: 'Liver function tests' },
  { kind: 'lab', code: 'TSB', ar: 'البيليروبين الكلي', en: 'Total serum bilirubin' },
  { kind: 'lab', code: 'ALB', ar: 'الألبومين', en: 'Albumin' },
  { kind: 'lab', code: 'LIPID', ar: 'الدهون', en: 'Lipid profile' },
  { kind: 'lab', code: 'AMYL', ar: 'الأميليز', en: 'Amylase' },
  { kind: 'lab', code: 'LIPASE', ar: 'الليبيز', en: 'Lipase' },
  { kind: 'lab', code: 'TSH', ar: 'الهرمون المحفز للدرقية', en: 'TSH' },
  { kind: 'lab', code: 'FT4', ar: 'الثايروكسين الحر', en: 'Free T4' },
  { kind: 'lab', code: 'PT-INR', ar: 'زمن البروثرومبين (INR)', en: 'PT / INR' },
  { kind: 'lab', code: 'APTT', ar: 'زمن الثرومبوبلاستين الجزئي', en: 'aPTT' },
  { kind: 'lab', code: 'D-DIMER', ar: 'دي دايمر', en: 'D-dimer' },
  { kind: 'lab', code: 'TROP', ar: 'التروبونين', en: 'Troponin' },
  { kind: 'lab', code: 'CKMB', ar: 'إنزيم القلب CK-MB', en: 'CK-MB' },
  { kind: 'lab', code: 'ABG', ar: 'غازات الدم الشرياني', en: 'Arterial blood gases' },
  { kind: 'lab', code: 'GUE', ar: 'فحص الإدرار العام', en: 'General urine examination' },
  { kind: 'lab', code: 'GSE', ar: 'فحص الخروج العام', en: 'General stool examination' },
  { kind: 'lab', code: 'BGRP', ar: 'فصيلة الدم', en: 'Blood group' },
  { kind: 'lab', code: 'CROSSMATCH', ar: 'فحص التوافق (كروس ماتش)', en: 'Cross-match' },
  { kind: 'lab', code: 'HBSAG', ar: 'التهاب الكبد B', en: 'HBsAg' },
  { kind: 'lab', code: 'HCV', ar: 'التهاب الكبد C', en: 'Anti-HCV' },
  { kind: 'lab', code: 'HIV', ar: 'فحص الإيدز', en: 'HIV screen' },
  { kind: 'lab', code: 'CULT-BLOOD', ar: 'زرع دم', en: 'Blood culture' },
  { kind: 'lab', code: 'CULT-URINE', ar: 'زرع إدرار', en: 'Urine culture' },
  { kind: 'lab', code: 'FERRITIN', ar: 'الفيريتين', en: 'Ferritin' },
  { kind: 'lab', code: 'VITD', ar: 'فيتامين د', en: 'Vitamin D' },
  { kind: 'lab', code: 'B12', ar: 'فيتامين B12', en: 'Vitamin B12' },
  { kind: 'lab', code: 'BHCG', ar: 'فحص الحمل بالدم', en: 'Beta-hCG' },
  { kind: 'lab', code: 'PSA', ar: 'مستضد البروستات', en: 'PSA' },
  { kind: 'lab', code: 'PROCAL', ar: 'البروكالسيتونين', en: 'Procalcitonin' },
  { kind: 'lab', code: 'LACTATE', ar: 'اللاكتات', en: 'Lactate' },

  // ——— الإقامة والاستشارة
  { kind: 'bed', code: 'BED-GEN', ar: 'إقامة يومية — ردهة عامة', en: 'Daily stay — general ward' },
  { kind: 'bed', code: 'BED-PRIV', ar: 'إقامة يومية — غرفة خاصة', en: 'Daily stay — private room' },
  { kind: 'bed', code: 'BED-ICU', ar: 'إقامة يومية — العناية المركزة', en: 'Daily stay — ICU' },
  { kind: 'consultation', code: 'CONS-SPEC', ar: 'استشارة طبيب اختصاص', en: 'Specialist consultation' },
  { kind: 'consultation', code: 'CONS-ER', ar: 'كشفية الطوارئ', en: 'Emergency consultation' },
];
