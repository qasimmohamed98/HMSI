export const ROLES = [
  'super_admin',
  'admin',
  'doctor',
  'nurse',
  'pharmacist',
  'lab',
  'radiology',
  'reception',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'hospitals.manage',
  'users.manage',
  'patients.create',
  'patients.update',
  'patients.archive',
  'patients.view',
  'departments.manage',
  'wards.manage',
  'chart.view',
  'vitals.write',
  'notes.write.doctor',
  'notes.write.nursing',
  'medications.manage',
  'medications.dispense',
  'medications.administer',
  'family.share',
  'lab.order',
  'lab.add_result',
  'radiology.order',
  'radiology.add_report',
  'admissions.manage',
  'discharge.approve',
  'settings.manage',
  'audit.view',
  'trash.manage',
  'reports.view',
  'files.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * قرار صاحب المشروع (2026-09-25، يحل محل D4):
 * - مدير المستشفى (admin): كل الصلاحيات داخل مستشفاه، بما فيها السريرية (الملاحظات، الأدوية، النتائج، الصرف، مشاركة العائلة).
 * - مدير النظام (super_admin): كل الصلاحيات + إدارة المستشفيات، ويعمل داخل أي مستشفى يبدّل إليه.
 * عزل المستشفيات يبقى كما هو: كل عملية مقيّدة بالمستشفى النشط في الجلسة.
 */
const ADMIN_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter((p) => p !== 'hospitals.manage');

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  doctor: [
    'patients.create',
    'patients.update',
    'patients.view',
    'chart.view',
    'notes.write.doctor',
    'medications.manage',
    'medications.administer',
    'family.share',
    'lab.order',
    'radiology.order',
    'admissions.manage',
    'discharge.approve',
    'reports.view',
    'files.manage',
  ],
  nurse: [
    'patients.view',
    'chart.view',
    'notes.write.nursing',
    'vitals.write',
    'medications.administer',
    'family.share',
    'admissions.manage',
    'files.manage',
  ],
  // الصيدلي يصرف الأدوية ولا يصفها
  pharmacist: ['patients.view', 'chart.view', 'medications.dispense'],
  lab: ['patients.view', 'chart.view', 'lab.order', 'lab.add_result'],
  radiology: ['patients.view', 'chart.view', 'radiology.order', 'radiology.add_report'],
  reception: ['patients.create', 'patients.update', 'patients.archive', 'patients.view', 'admissions.manage'],
  viewer: ['patients.view', 'chart.view'],
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const PATIENT_STATUSES = ['active', 'discharged', 'transferred'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const ADMISSION_STATUSES = ['active', 'discharged'] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export const WARD_TYPES = ['male', 'female', 'mixed'] as const;
export type WardType = (typeof WARD_TYPES)[number];

export const NOTE_KINDS = ['doctor', 'nursing'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const DIAGNOSIS_STATUSES = ['suspected', 'confirmed', 'resolved'] as const;
export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];

export const MEDICATION_STATUSES = ['active', 'discontinued', 'completed'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

export const RESULT_STATUSES = ['ordered', 'in_progress', 'resulted', 'abnormal'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const AREA_NAMES = [
  'overview',
  'vitals',
  'diagnosis',
  'doctorNotes',
  'nursing',
  'medications',
  'laboratory',
  'radiology',
  'consultations',
  'procedures',
  'attachments',
  'timeline',
  'discharge',
] as const;
export type ChartSection = (typeof AREA_NAMES)[number];

export interface User {
  id: string;
  hospital_id: string;
  hospital_name_ar: string;
  hospital_name_en: string;
  username: string;
  full_name_ar: string;
  full_name_en: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  /** المستشفى الأصلي للمستخدم (يختلف عن hospital_id عندما يتصفح المدير العام مستشفى آخر) */
  home_hospital_id?: string;
  /** رابط شعار المستشفى النشط (null = لا شعار) */
  hospital_logo_url?: string | null;
  /** حالة اشتراك المستشفى النشط */
  subscription?: Subscription;
}

/**
 * اشتراك المستشفى: unlimited = مستشفى أنشأه المدير العام بلا حد زمني؛ trial = فترة تجريبية؛
 * active = اشتراك مدفوع؛ expired = انتهى — لا يُسمح إلا بصفحة الدفع.
 */
export type SubscriptionStatus = 'unlimited' | 'trial' | 'active' | 'expired';
export interface Subscription {
  status: SubscriptionStatus;
  ends_at: string | null;
  days_left: number | null;
}

/** معلومات الدفع التي يضبطها المدير العام وتظهر للمستشفيات */
export interface PaymentInfo {
  price: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  phone: string;
  notes: string;
}

export const PAYMENT_NOTICE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PaymentNoticeStatus = (typeof PAYMENT_NOTICE_STATUSES)[number];
export interface PaymentNotice {
  id: string;
  hospital_id: string;
  hospital_name_ar?: string;
  hospital_name_en?: string;
  amount: string;
  method: string;
  reference: string | null;
  note: string | null;
  submitted_by: string;
  submitted_at: string;
  status: PaymentNoticeStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface PublicUser {
  id: string;
  full_name_ar: string;
  full_name_en: string;
  role: Role;
}

export interface Patient {
  id: string;
  hospital_id: string;
  file_number: string;
  full_name_ar: string;
  full_name_en: string;
  gender: Gender;
  birth_date: string;
  phone: string | null;
  national_id: string | null;
  blood_type: BloodType;
  allergies_json: string;
  critical_alerts_json: string;
  status: PatientStatus;
  created_at: string;
  activeAdmission?: AdmissionSummary | null;
}

export interface AdmissionSummary {
  id: string;
  department_id: string;
  department_name_ar: string;
  department_name_en: string;
  ward_id: string;
  ward_name_ar: string;
  ward_name_en: string;
  room: string;
  bed_no: string;
  attending_doctor: string | null;
  admitted_at: string;
  discharged_at?: string | null;
  status: AdmissionStatus;
  reason?: string | null;
  discharge_type?: DischargeType | null;
  discharge_summary?: string | null;
  /** رمز متابعة ذوي المريض عبر صفحة QR (يظهر للطاقم فقط) */
  family_pin?: string | null;
  /** ما يسمح الطاقم بعرضه لذوي المريض (بعد إدخال رمز العائلة) */
  family_share?: FamilyShare;
  family_message?: string | null;
  family_message_by?: string | null;
  family_message_at?: string | null;
}

/**
 * فئات المعلومات التي يمكن مشاركتها مع ذوي المريض. لا شيء يُعرض إلا بتفعيل صريح من الطاقم،
 * ولا تُعرض إلا السجلات المكتملة (نتائج صادرة، تشخيص مؤكد) — لا طلبات معلّقة ولا تشخيص «مشتبه».
 */
export const FAMILY_SHARE_CATEGORIES = ['vitals', 'diagnosis', 'medications', 'labs', 'radiology', 'procedures'] as const;
export type FamilyShareCategory = (typeof FAMILY_SHARE_CATEGORIES)[number];
export type FamilyShare = Partial<Record<FamilyShareCategory, boolean>>;
/** الفئات التي يقرر مشاركتها الطبيب فقط؛ التمريض يشارك العلامات الحيوية والرسالة */
export const FAMILY_SHARE_DOCTOR_ONLY: readonly FamilyShareCategory[] = ['diagnosis', 'medications', 'labs', 'radiology', 'procedures'];

export const DISCHARGE_TYPES = ['home', 'transfer', 'death', 'ama'] as const;
export type DischargeType = (typeof DISCHARGE_TYPES)[number];

export interface Vitals {
  id: string;
  admission_id: string;
  recorded_at: string;
  temperature: number | null;
  pulse: number | null;
  respiratory_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  spo2: number | null;
  weight: number | null;
  glucose: number | null;
  /** مقياس الألم 0–10 */
  pain_score?: number | null;
  /** مستوى الوعي AVPU */
  consciousness?: Consciousness | null;
  recorded_by: string;
}

export const CONSCIOUSNESS_LEVELS = ['alert', 'voice', 'pain', 'unresponsive'] as const;
export type Consciousness = (typeof CONSCIOUSNESS_LEVELS)[number];

export const FLUID_DIRECTIONS = ['in', 'out'] as const;
export type FluidDirection = (typeof FLUID_DIRECTIONS)[number];
export const FLUID_KINDS = {
  in: ['oral', 'iv', 'ng', 'blood', 'other_in'],
  out: ['urine', 'drain', 'vomit', 'stool', 'ng_out', 'other_out'],
} as const;
export type FluidKind = (typeof FLUID_KINDS)[FluidDirection][number];

/** ميزان السوائل (Intake / Output) */
export interface FluidEntry {
  id: string;
  admission_id: string;
  direction: FluidDirection;
  kind: FluidKind;
  volume_ml: number;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

export const ADMINISTRATION_STATUSES = ['given', 'held', 'refused'] as const;
export type AdministrationStatus = (typeof ADMINISTRATION_STATUSES)[number];

/** سجل إعطاء جرعة دواء (MAR) */
export interface MedicationAdministration {
  id: string;
  medication_id: string;
  admission_id: string;
  status: AdministrationStatus;
  note: string | null;
  administered_by: string;
  /** لتحديد من يحق له تصحيح الإدخال */
  administered_by_id?: string | null;
  administered_at: string;
}

export interface MedicalNote {
  id: string;
  admission_id: string;
  kind: NoteKind;
  author: string;
  author_id?: string | null;
  recorded_at: string;
  content: string;
  corrected_by: string | null;
}

export interface Diagnosis {
  id: string;
  admission_id: string;
  icd10: string | null;
  title_ar: string;
  title_en: string | null;
  status: DiagnosisStatus;
  added_by: string;
}

export interface Medication {
  id: string;
  admission_id: string;
  name_ar: string;
  name_en: string | null;
  dose: string;
  route: string;
  frequency: string;
  start_at: string;
  end_at: string | null;
  status: MedicationStatus;
  prescribed_by: string;
  dispensed_by?: string | null;
  dispensed_at?: string | null;
}

export interface LabResult {
  id: string;
  admission_id: string;
  test_name_ar: string;
  test_name_en: string | null;
  category: string;
  ordered_by: string;
  ordered_at: string;
  result: string | null;
  unit: string | null;
  reference_range: string | null;
  status: ResultStatus;
  resulted_by: string | null;
  resulted_at: string | null;
}

export interface RadiologyReport {
  id: string;
  admission_id: string;
  study_type_ar: string;
  study_type_en: string | null;
  ordered_by: string;
  ordered_at: string;
  report: string | null;
  status: ResultStatus;
  performed_by: string | null;
}

export interface Consultation {
  id: string;
  admission_id: string;
  specialty: string;
  reason: string;
  response: string | null;
  requested_by: string;
  requested_at: string;
  responded_by: string | null;
  responded_at: string | null;
}

export interface Procedure {
  id: string;
  admission_id: string;
  name_ar: string;
  name_en: string | null;
  notes: string | null;
  performed_by: string;
  performed_at: string;
}

export interface Attachment {
  id: string;
  admission_id: string;
  file_name: string;
  mime: string;
  size: number;
  uploaded_by: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  admission_id: string;
  actor: string;
  type: string;
  title_ar: string;
  title_en: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  meta_json: string;
  ip: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  meta_json: string;
  ip: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalPatients: number;
  activeAdmissions: number;
  dischargedToday: number;
  criticalAlerts: number;
  pendingLabs: number;
  occupancy: { ward_name_ar: string; ward_name_en: string; used: number; total: number }[];
  admissionsTrend: { label: string; count: number }[];
  recentActivity: TimelineEvent[];
  /** مرضى بدرجة إنذار مبكر (MEWS) مرتفعة حسب آخر علامات حيوية */
  mewsAlerts?: MewsAlert[];
}

export interface MewsAlert {
  patient_id: string;
  patient_name_ar: string;
  patient_name_en: string;
  ward_name_ar: string;
  ward_name_en: string;
  bed_no: string;
  score: number;
  level: 'medium' | 'high';
  recorded_at: string;
}

export interface Bed {
  id: string;
  ward_id: string;
  room: string;
  bed_no: string;
  status: 'free' | 'occupied';
  code: string;
}

export interface Ward {
  id: string;
  department_id: string;
  department_name_ar: string;
  department_name_en: string;
  name_ar: string;
  name_en: string;
  type: WardType;
  beds: Bed[];
}

export interface ChartData {
  patient: Patient & { admission: AdmissionSummary | null };
  admissionId: string | null;
  /** كل تنويمات المريض (الأحدث أولاً) للتنقل بين السجلات السابقة */
  admissions: AdmissionSummary[];
  vitals: Vitals[];
  notes: MedicalNote[];
  diagnoses: Diagnosis[];
  medications: Medication[];
  /** سجل إعطاء الأدوية (الأحدث أولاً) */
  administrations: MedicationAdministration[];
  fluids: FluidEntry[];
  labs: LabResult[];
  radiology: RadiologyReport[];
  consultations: Consultation[];
  procedures: Procedure[];
  attachments: Attachment[];
  timeline: TimelineEvent[];
}

export interface Hospital {
  id: string;
  name_ar: string;
  name_en: string;
  code: string;
  is_active: boolean;
  created_at: string;
  logo_url?: string | null;
  subscription?: Subscription;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  signup_source?: 'admin' | 'self';
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  city?: string | null;
}

export interface Department {
  id: string;
  hospital_id: string;
  name_ar: string;
  name_en: string;
  ward_count?: number;
}

export interface UnassignedPatient {
  admission_id: string;
  patient_id: string;
  patient_name_ar: string;
  admitted_at: string;
}

/** ما يراه أي شخص يمسح QR السرير — بدون أي بيانات طبية أو اسم كامل */
export interface PublicTrackInfo {
  hospital: { name_ar: string; name_en: string; logo_url?: string | null };
  department: { name_ar: string; name_en: string } | null;
  ward: { name_ar: string; name_en: string } | null;
  room: string;
  bed_no: string;
  occupied: boolean;
  admission: {
    admitted_at: string;
    days: number;
    /** الأحرف الأولى فقط، مثل «م. ع.» */
    patient_initials: string;
    last_update: string | null;
  } | null;
}

/** ما يراه ذوو المريض بعد إدخال رمز العائلة الصحيح */
export interface PublicTrackFamily extends PublicTrackInfo {
  patient: {
    full_name_ar: string;
    full_name_en: string;
    gender: Gender;
  };
  attending_doctor: string | null;
  latest_vitals: {
    recorded_at: string;
    temperature: number | null;
    pulse: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    spo2: number | null;
  } | null;
  /** الفئات المفعّلة من الطاقم — الحقول أدناه تُرسل فقط إن كانت فئتها مفعّلة */
  shared: FamilyShareCategory[];
  message?: { text: string; by: string | null; at: string | null } | null;
  diagnoses?: { title_ar: string; title_en: string | null; status: 'confirmed' | 'resolved' }[];
  medications?: { name_ar: string; name_en: string | null; dose: string; route: string; frequency: string }[];
  labs?: { test_name_ar: string; test_name_en: string | null; result: string; unit: string | null; reference_range: string | null; abnormal: boolean; resulted_at: string | null }[];
  radiology?: { study_type_ar: string; study_type_en: string | null; report: string; ordered_at: string }[];
  procedures?: { name_ar: string; name_en: string | null; performed_at: string }[];
}

export interface HospitalAdminInfo {
  id: string;
  username: string;
  full_name_ar: string;
  is_active: boolean;
}

export interface HospitalListItem extends Hospital {
  users_count: number;
  beds_count: number;
  active_admissions: number;
  admins: HospitalAdminInfo[];
  pending_payments: number;
}

export interface ReportOverview {
  from: string;
  to: string;
  totalAdmissions: number;
  totalDischarges: number;
  activeAdmissions: number;
  criticalAlerts: number;
  pendingLabs: number;
  admissionsTrend: { label: string; count: number }[];
  dischargesTrend: { label: string; count: number }[];
  occupancy: { ward_name_ar: string; ward_name_en: string; used: number; total: number }[];
  recentActivity: { id: string; admission_id: string; actor: string; type: string; title_ar: string; created_at: string }[];
}