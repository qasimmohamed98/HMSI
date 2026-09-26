import type {
  User,
  Patient,
  Vitals,
  MedicalNote,
  Diagnosis,
  Medication,
  LabResult,
  RadiologyReport,
  Consultation,
  Procedure,
  Attachment,
  DashboardStats,
  Ward,
  PublicUser,
  Hospital,
  HospitalListItem,
  HospitalAdminInfo,
  Department,
  UnassignedPatient,
  Bed,
  ChartData,
  ReportOverview,
  PublicTrackInfo,
  PublicTrackFamily,
  AuditEntry,
  Consciousness,
  FluidDirection,
  FluidKind,
  FluidEntry,
  AdministrationStatus,
  MedicationAdministration,
  FamilyShare,
  PaymentInfo,
  PaymentNotice,
  Subscription,
} from '@hmsi/shared';
import { demoApi } from './api-demo';
import { liveApi } from './api-live';

export type { ChartData, ReportOverview };

export interface PatientListParams {
  search?: string;
  admitted?: boolean;
  /** للممرض: مرضاه المعيَّنون فقط */
  mine?: boolean;
}

export interface NewVitalsInput {
  admissionId: string;
  temperature: number | null;
  pulse: number | null;
  respiratoryRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  weight: number | null;
  glucose: number | null;
  painScore?: number | null;
  consciousness?: Consciousness | null;
  /** معرّف يولّده المتصفح — يمنع التكرار عند إعادة الإرسال من طابور العمل دون اتصال */
  clientId?: string;
  /** وقت القياس الفعلي (للإدخالات المؤجلة) */
  recordedAt?: string;
}

export interface FluidInput {
  admissionId: string;
  direction: FluidDirection;
  kind: FluidKind;
  volumeMl: number;
  note?: string | null;
  clientId?: string;
  recordedAt?: string;
}

export interface AdministrationInput {
  status: AdministrationStatus;
  note?: string | null;
  clientId?: string;
  administeredAt?: string;
}

export interface NoteInput {
  admissionId: string;
  kind: 'doctor' | 'nursing';
  content: string;
}

export interface DiagnosisInput {
  admissionId: string;
  icd10?: string | null;
  titleAr: string;
  titleEn?: string | null;
  status?: 'suspected' | 'confirmed' | 'resolved';
}

export interface MedicationInput {
  admissionId: string;
  nameAr: string;
  nameEn?: string | null;
  dose: string;
  route: string;
  frequency: string;
  startAt: string;
  endAt?: string | null;
  /** سبب تجاوز تحذير الحساسية */
  allergyOverrideReason?: string | null;
}

export interface LabInput {
  admissionId: string;
  testNameAr: string;
  testNameEn?: string | null;
  category?: string | null;
  /** اختياري: بدون نتيجة = طلب فحص */
  result?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
}

export interface RadiologyInput {
  admissionId: string;
  studyTypeAr: string;
  studyTypeEn?: string | null;
  /** اختياري: بدون تقرير = طلب أشعة */
  report?: string | null;
}

export interface ConsultationInput {
  admissionId: string;
  specialty: string;
  reason: string;
}

export interface ProcedureInput {
  admissionId: string;
  nameAr: string;
  nameEn?: string | null;
  notes?: string | null;
}

export interface DischargeInput {
  admissionId: string;
  type: 'home' | 'transfer' | 'death' | 'ama';
  summary: string;
}

export interface AdmitInput {
  patientId: string;
  bedId: string;
  departmentId: string;
  attendingDoctorId?: string | null;
  reason?: string;
}

export interface TransferInput {
  admissionId: string;
  bedId: string;
}

export interface LabResultInput {
  result: string;
  unit?: string | null;
  referenceRange?: string | null;
  abnormal?: boolean;
}

export interface RadiologyUpdateInput {
  report: string;
}

export interface MedicationStatusInput {
  status?: 'active' | 'discontinued' | 'completed';
  endAt?: string | null;
  nameAr?: string;
  nameEn?: string | null;
  dose?: string;
  route?: string;
  frequency?: string;
  startAt?: string;
  allergyOverrideReason?: string | null;
}

export interface NoteUpdateInput {
  content: string;
}

export interface ConsultationResponseInput {
  response: string;
}

export interface ConsultationUpdateInput {
  specialty?: string;
  reason?: string;
  response?: string;
}

export interface DiagnosisUpdateInput {
  icd10?: string | null;
  titleAr?: string;
  titleEn?: string | null;
  status?: 'suspected' | 'confirmed' | 'resolved';
}

export interface ProcedureUpdateInput {
  nameAr?: string;
  nameEn?: string | null;
  notes?: string | null;
}

export interface VitalsUpdateInput {
  temperature?: number | null;
  pulse?: number | null;
  respiratoryRate?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  spo2?: number | null;
  weight?: number | null;
  glucose?: number | null;
  painScore?: number | null;
  consciousness?: Consciousness | null;
}

export interface PatientUpdateInput {
  fullNameAr?: string;
  fullNameEn?: string | null;
  gender?: 'male' | 'female';
  birthDate?: string;
  phone?: string | null;
  nationalId?: string | null;
  bloodType?: string;
  allergies?: string[];
  criticalAlerts?: string[];
}

export interface DepartmentInput {
  nameAr: string;
  nameEn?: string | null;
}

export interface WardInput {
  departmentId: string;
  nameAr: string;
  nameEn?: string | null;
  wardType: 'male' | 'female' | 'mixed';
}

export interface BedInput {
  wardId: string;
  room: string;
  bedNo: string;
}

export interface HospitalProfileInput {
  nameAr: string;
  nameEn: string;
}

export interface NewUserInput {
  username: string;
  password: string;
  fullNameAr: string;
  fullNameEn?: string;
  email?: string | null;
  role: 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'radiology' | 'reception' | 'viewer';
}

export interface UpdateUserInput {
  fullNameAr?: string;
  fullNameEn?: string | null;
  email?: string | null;
  role?: 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'radiology' | 'reception' | 'viewer';
  isActive?: boolean;
}

export interface CreateHospitalInput {
  nameAr: string;
  nameEn: string;
  code?: string;
}

export interface HospitalAdminInput {
  username: string;
  password: string;
  fullNameAr: string;
  fullNameEn?: string;
  email?: string | null;
}

/** عنصر في سلة المحذوفات */
export interface TrashItem {
  id: string;
  table_name: string;
  record_id: string;
  mode: 'delete' | 'archive';
  kind: string;
  label: string;
  patient_id: string | null;
  admission_id: string | null;
  patient_name_ar: string | null;
  patient_name_en: string | null;
  deleted_by: string;
  deleted_by_id: string | null;
  deleted_at: string;
  restore_requested_by: string | null;
  restore_requested_at: string | null;
  restore_request_note: string | null;
  restored_by: string | null;
  restored_at: string | null;
}

export interface SignupInput {
  hospitalNameAr: string;
  hospitalNameEn?: string | null;
  city?: string | null;
  contactPhone: string;
  fullNameAr: string;
  email?: string | null;
  username: string;
  password: string;
  formToken?: string;
  website?: string;
  /** موافقة صريحة على شروط الاستخدام وسياسة الخصوصية */
  acceptTerms: boolean;
}

export interface BillingOverview {
  subscription: Subscription | undefined;
  payment_info: PaymentInfo;
  notices: PaymentNotice[];
  can_submit: boolean;
}

/** محتوى صفحة «من نحن» */
export interface AboutContent {
  name: string;
  tagline: string;
  intro: string;
  mission: string;
  vision: string;
  values: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  name_en?: string;
  tagline_en?: string;
  intro_en?: string;
  mission_en?: string;
  vision_en?: string;
  values_en?: string;
  address_en?: string;
}

export type ReportType = 'admissions' | 'discharges' | 'census' | 'occupancy' | 'lab' | 'radiology' | 'pharmacy' | 'mar' | 'diagnoses' | 'doctors';
export interface ReportColumn {
  key: string;
  kind: 'text' | 'number' | 'date' | 'datetime' | 'percent' | 'enum';
  enumPrefix?: string;
}
/** تقرير تفصيلي: صفوف فعلية + ملخص */
export interface DetailedReport {
  type: ReportType;
  from: string;
  to: string;
  snapshot: boolean;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary: { key: string; value: number | string }[];
}

export interface StoredBackup {
  key: string;
  size: number;
  created_at: string;
}

export interface SystemHealth {
  db: { ok: boolean; ms: number; migrations_applied: number; migrations_known: number };
  counts: { hospitals: number; users: number; patients: number; active_admissions: number; online_sessions: number };
  errors: { last_24h: number; groups: number };
  backup: { latest: StoredBackup | null; count: number; retention: number; encrypted: boolean; error: string | null };
  runtime: { node: string; netlify: boolean; time: string };
}

export interface ErrorEvent {
  id: string;
  source: 'server' | 'client' | 'job';
  message: string;
  detail: string | null;
  path: string | null;
  hospital_name_ar: string | null;
  hospital_name_en: string | null;
  user_agent: string | null;
  count: number;
  created_at: string;
  last_seen_at: string;
}

export interface CareMember {
  id: string;
  admission_id: string;
  user_id: string;
  role: 'doctor' | 'nurse';
  specialty: string | null;
  is_primary: boolean;
  assigned_at: string;
  full_name_ar: string;
  full_name_en: string | null;
}

export interface CareTeamInfo {
  members: CareMember[];
  pending_handover: { id: string; to_user_id: string; to_name_ar: string; to_name_en: string | null } | null;
}

export interface StaffMember {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  patients: number;
}

export interface NurseHandoverItem {
  admission_id: string;
  patient_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  room: string;
  bed_no: string;
  ward_name_ar: string | null;
  ward_name_en: string | null;
}

export interface NurseHandover {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  note: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  from_name_ar: string;
  from_name_en: string | null;
  to_name_ar: string;
  to_name_en: string | null;
  items: NurseHandoverItem[];
}

export interface CarePlan {
  admission_id: string;
  goals: string | null;
  diet: string | null;
  activity: string | null;
  monitoring: string | null;
  nursing_instructions: string | null;
  vitals_interval_hours: number | null;
  review_at: string | null;
  updated_by: string;
  updated_at: string;
}

export type CarePlanInput = Partial<Omit<CarePlan, 'admission_id' | 'updated_by' | 'updated_at'>>;

export interface VitalsRoundRow {
  admission_id: string;
  admitted_at: string;
  room: string;
  bed_no: string;
  ward_id: string;
  ward_name_ar: string | null;
  ward_name_en: string | null;
  patient_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  file_number: string;
  interval_hours: number | null;
  last_at: string | null;
  mews: { score: number; level: 'low' | 'medium' | 'high' } | null;
  nurse_id: string | null;
  nurse_name_ar: string | null;
  nurse_name_en: string | null;
}

export interface HandoverNote {
  id: string;
  situation: string;
  background: string | null;
  assessment: string | null;
  recommendation: string | null;
  author: string;
  created_at: string;
}

export interface HandoverPatient {
  admission_id: string;
  admitted_at: string;
  reason: string | null;
  room: string;
  bed_no: string;
  ward_id: string;
  ward_name_ar: string | null;
  ward_name_en: string | null;
  patient_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  file_number: string;
  birth_date: string | null;
  gender: 'male' | 'female';
  allergies: string[];
  alerts: string[];
  doctor_ar: string | null;
  doctor_en: string | null;
  nurse_ar: string | null;
  nurse_en: string | null;
  nurse_id: string | null;
  nursing_instructions: string | null;
  vitals_interval_hours: number | null;
  diagnoses_ar: string | null;
  diagnoses_en: string | null;
  vitals: {
    recorded_at: string;
    temperature: number | null;
    pulse: number | null;
    respiratory_rate: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    spo2: number | null;
    pain_score: number | null;
    consciousness: string | null;
  } | null;
  mews: { score: number; level: 'low' | 'medium' | 'high' } | null;
  pending_labs: number;
  abnormal_labs_24h: number;
  pending_radiology: number;
  active_meds: number;
  last_nursing_note: string | null;
  handover: HandoverNote | null;
}

export interface RoundMedication {
  id: string;
  admission_id: string;
  name_ar: string;
  name_en: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string | null;
  dispensed_at: string | null;
  allergy_override: boolean;
  patient_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  file_number: string;
  ward_id: string;
  ward_name_ar: string | null;
  ward_name_en: string | null;
  room: string;
  bed_no: string;
  last_at: string | null;
  last_status: 'given' | 'held' | 'refused' | null;
  last_by: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title_ar: string;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  link: string | null;
  created_at: string;
  is_read: boolean;
}

export interface Api {
  mode: 'demo' | 'live';
  /** يعيد المستخدم، أو تذكرة خطوة ثانية إن كان التحقق بخطوتين مفعّلاً */
  login(username: string, password: string): Promise<User | { mfa_required: true; mfa_token: string }>;
  loginMfa(mfaToken: string, code: string): Promise<User>;
  twofaStatus(): Promise<{ enabled: boolean; recovery_codes_left: number }>;
  twofaSetup(): Promise<{ secret: string; otpauth_url: string }>;
  twofaEnable(code: string): Promise<{ recovery_codes: string[] }>;
  twofaDisable(password: string): Promise<void>;
  twofaRecoveryCodes(password: string): Promise<{ recovery_codes: string[] }>;
  resetUserTwofa(userId: string): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  dashboard(): Promise<DashboardStats>;
  listPatients(params?: PatientListParams): Promise<Patient[]>;
  createPatient(input: NewPatientInput): Promise<Patient>;
  updatePatient(id: string, input: PatientUpdateInput): Promise<Patient>;
  deletePatient(id: string): Promise<void>;
  admitPatient(input: AdmitInput): Promise<{ admission_id: string; family_pin: string }>;
  regenerateFamilyPin(admissionId: string): Promise<{ family_pin: string }>;
  /** ما يراه ذوو المريض: الفئات المفعّلة ورسالة الطاقم (null تمسح الرسالة) */
  updateFamilyShare(admissionId: string, input: { share?: FamilyShare; message?: string | null }): Promise<{ family_share: FamilyShare; family_message: string | null }>;
  transferPatient(input: TransferInput): Promise<void>;
  getChart(patientId: string, admissionId?: string): Promise<ChartData>;
  addVitals(input: NewVitalsInput): Promise<Vitals>;
  updateVitals(vitalsId: string, input: VitalsUpdateInput): Promise<Vitals>;
  deleteVitals(vitalsId: string): Promise<void>;
  addNote(input: NoteInput): Promise<MedicalNote>;
  updateNote(admissionId: string, noteId: string, input: NoteUpdateInput): Promise<MedicalNote>;
  deleteNote(admissionId: string, noteId: string): Promise<void>;
  addDiagnosis(input: DiagnosisInput): Promise<Diagnosis>;
  updateDiagnosis(admissionId: string, diagnosisId: string, input: DiagnosisUpdateInput): Promise<Diagnosis>;
  deleteDiagnosis(admissionId: string, diagnosisId: string): Promise<void>;
  addMedication(input: MedicationInput): Promise<Medication>;
  updateMedication(admissionId: string, medicationId: string, input: MedicationStatusInput): Promise<Medication>;
  deleteMedication(admissionId: string, medicationId: string): Promise<void>;
  dispenseMedication(admissionId: string, medicationId: string): Promise<Medication>;
  administerMedication(admissionId: string, medicationId: string, input: AdministrationInput): Promise<MedicationAdministration>;
  deleteAdministration(admissionId: string, administrationId: string): Promise<void>;
  addFluid(input: FluidInput): Promise<FluidEntry>;
  deleteFluid(admissionId: string, fluidId: string): Promise<void>;
  /** رابط ملصق ZPL للطابعات الحرارية (null في وضع العرض) */
  labelZplUrl(admissionId: string, kind: 'wristband' | { labId: string }): string | null;
  listAudit(params?: { before?: string; action?: string }): Promise<AuditEntry[]>;
  /** سلة المحذوفات: المدير يرى الكل ويستعيد، البقية يرون ما حذفوه ويطلبون الاستعادة */
  listTrash(restored?: boolean): Promise<{ items: TrashItem[]; canRestore: boolean }>;
  requestRestore(trashId: string, note: string | null): Promise<void>;
  restoreTrash(trashId: string): Promise<TrashItem>;
  addLabResult(input: LabInput): Promise<LabResult>;
  updateLabResult(admissionId: string, labId: string, input: LabResultInput): Promise<LabResult>;
  deleteLabResult(admissionId: string, labId: string): Promise<void>;
  addRadiology(input: RadiologyInput): Promise<RadiologyReport>;
  updateRadiology(admissionId: string, radiologyId: string, input: RadiologyUpdateInput): Promise<RadiologyReport>;
  deleteRadiology(admissionId: string, radiologyId: string): Promise<void>;
  addConsultation(input: ConsultationInput): Promise<Consultation>;
  updateConsultation(admissionId: string, consultationId: string, input: ConsultationUpdateInput): Promise<Consultation>;
  deleteConsultation(admissionId: string, consultationId: string): Promise<void>;
  addProcedure(input: ProcedureInput): Promise<Procedure>;
  updateProcedure(admissionId: string, procedureId: string, input: ProcedureUpdateInput): Promise<Procedure>;
  deleteProcedure(admissionId: string, procedureId: string): Promise<void>;
  discharge(input: DischargeInput): Promise<void>;
  wards(): Promise<Ward[]>;
  listDepartments(): Promise<Department[]>;
  createDepartment(input: DepartmentInput): Promise<Department>;
  updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;
  createWard(input: WardInput): Promise<Ward>;
  updateWard(id: string, input: Partial<Omit<WardInput, 'departmentId'>>): Promise<Ward>;
  deleteWard(id: string): Promise<void>;
  createBed(input: BedInput): Promise<Bed>;
  updateBed(id: string, input: { room?: string; bedNo?: string }): Promise<Bed>;
  deleteBed(id: string): Promise<void>;
  listUnassigned(): Promise<UnassignedPatient[]>;
  assignBed(bedId: string, admissionId: string): Promise<void>;
  freeBed(bedId: string): Promise<void>;
  bedOccupant(bedId: string): Promise<{ admission_id: string; patient_id: string; patient_name_ar: string } | null>;
  hospitalProfile(): Promise<Hospital>;
  updateHospital(input: HospitalProfileInput): Promise<Hospital>;
  /** شعار المستشفى: PNG/JPEG/WEBP حتى 300KB */
  uploadHospitalLogo(file: File): Promise<Hospital>;
  removeHospitalLogo(): Promise<Hospital>;
  listUsers(): Promise<User[]>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  resetUserPassword(userId: string, password: string): Promise<void>;
  createUser(input: NewUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  listDoctors(): Promise<PublicUser[]>;
  uploadAttachment(admissionId: string, file: File): Promise<Attachment>;
  deleteAttachment(admissionId: string, attachmentId: string): Promise<void>;
  attachmentUrl(admissionId: string, attachmentId: string): string;
  reportsOverview(from: string, to: string): Promise<ReportOverview>;
  detailedReport(type: ReportType, params: { from: string; to: string; department?: string; doctor?: string }): Promise<DetailedReport>;
  // المدير العام
  listHospitals(): Promise<HospitalListItem[]>;
  createHospital(input: CreateHospitalInput): Promise<Hospital>;
  updateHospitalById(id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }): Promise<Hospital>;
  addHospitalAdmin(hospitalId: string, input: HospitalAdminInput): Promise<HospitalAdminInfo>;
  switchHospital(hospitalId: string): Promise<Hospital>;
  // التسجيل الذاتي والاشتراك
  signup(input: SignupInput): Promise<User>;
  signupToken(): Promise<{ token: string }>;
  publicPaymentInfo(): Promise<PaymentInfo & { trial_days: number }>;
  billing(): Promise<BillingOverview>;
  submitPaymentNotice(input: { amount: string; method: string; reference?: string | null; note?: string | null }): Promise<PaymentNotice>;
  listPaymentNotices(status?: 'pending'): Promise<PaymentNotice[]>;
  rejectPaymentNotice(id: string, note: string | null): Promise<void>;
  updateSubscription(hospitalId: string, input: { months?: number; until?: string; noticeId?: string }): Promise<Hospital>;
  updatePaymentInfo(info: PaymentInfo): Promise<PaymentInfo>;
  getAbout(): Promise<AboutContent>;
  updateAbout(content: AboutContent): Promise<AboutContent>;
  // صفحة ذوي المريض (عامة)
  publicTrack(code: string): Promise<PublicTrackInfo>;
  // صحة النظام والنسخ الاحتياطي (المدير العام) وتصدير بيانات المستشفى
  systemHealth(): Promise<SystemHealth>;
  listErrors(): Promise<ErrorEvent[]>;
  clearErrors(): Promise<void>;
  listBackups(): Promise<{ backups: StoredBackup[]; retention: number; encrypted: boolean }>;
  createBackup(): Promise<StoredBackup & { encrypted: boolean; ms: number }>;
  backupUrl(key: string): string;
  hospitalExportUrl(): string;
  reportClientError(e: { message: string; detail?: string | null; path?: string | null }): Promise<void>;
  medicationRounds(ward?: string, mine?: boolean): Promise<RoundMedication[]>;
  vitalsRounds(ward?: string, mine?: boolean): Promise<VitalsRoundRow[]>;
  handover(ward?: string, mine?: boolean): Promise<HandoverPatient[]>;
  // فريق الرعاية والتسليم والاستلام والخطة العلاجية
  careTeam(admissionId: string): Promise<CareTeamInfo>;
  careStaff(role: 'doctor' | 'nurse'): Promise<StaffMember[]>;
  addCareMember(admissionId: string, input: { userId: string; role: 'doctor' | 'nurse'; specialty?: string | null; primary?: boolean }): Promise<{ members: CareMember[] }>;
  endCareMember(admissionId: string, memberId: string): Promise<{ members: CareMember[] }>;
  nurseHandovers(): Promise<{ incoming: NurseHandover[]; outgoing: NurseHandover[]; recent: NurseHandover[] }>;
  sendNurseHandover(input: { toUserId: string; admissionIds: string[]; note?: string | null }): Promise<{ id: string }>;
  acceptNurseHandover(id: string): Promise<{ moved: number }>;
  rejectNurseHandover(id: string, reason: string): Promise<void>;
  cancelNurseHandover(id: string): Promise<void>;
  carePlan(admissionId: string): Promise<CarePlan | null>;
  saveCarePlan(admissionId: string, input: CarePlanInput): Promise<CarePlan>;
  emergencyAccess(patientId: string, reason: string): Promise<{ expires_at: string }>;
  // حذف بيانات التجربة والمستشفيات (المدير العام)
  demoStatus(): Promise<{ present: boolean; hospitals: { id: string; name_ar: string; name_en: string; patients: number; users: number }[] }>;
  purgeDemo(confirm: string): Promise<{ backup: string; hospitals: string[] }>;
  purgeHospital(id: string, confirmCode: string): Promise<{ backup: string }>;
  writeHandover(admissionId: string, input: { situation: string; background?: string; assessment?: string; recommendation?: string }): Promise<HandoverNote>;
  // الإشعارات
  listNotifications(): Promise<AppNotification[]>;
  notificationCount(): Promise<{ unread: number; top: 'info' | 'warning' | 'critical' }>;
  readNotification(id: string): Promise<void>;
  readAllNotifications(): Promise<void>;
  /** موافقة الموظف على شروط الاستخدام وسياسة الخصوصية (الإصدار المعروض) */
  acceptTerms(version: number): Promise<User>;
  // إشعارات الدفع لهذا الجهاز (تصل والنظام مغلق)
  pushKey(): Promise<{ public_key: string }>;
  pushSubscribe(input: PushSubscribeInput): Promise<{ subscribed: true; level: PushLevel }>;
  pushStatus(endpoint: string): Promise<{ subscribed: boolean; level: PushLevel | null; devices: number }>;
  pushUnsubscribe(endpoint: string): Promise<void>;
  pushTest(): Promise<{ sent: number }>;
  familyTrack(code: string, pin: string): Promise<PublicTrackFamily>;
}

export type PushLevel = 'all' | 'important' | 'critical';
export interface PushSubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  lang: 'ar' | 'en';
  level: PushLevel;
  device?: string | null;
}

export interface NewPatientInput {
  fullNameAr: string;
  fullNameEn?: string;
  gender: 'male' | 'female';
  birthDate: string;
  phone?: string | null;
  nationalId?: string | null;
  bloodType: string;
  allergies: string[];
  criticalAlerts: string[];
}

export const API: Api = import.meta.env.VITE_API_MODE === 'live' ? liveApi : demoApi;