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
} from '@hmsi/shared';
import { demoApi } from './api-demo';
import { liveApi } from './api-live';

export type { ChartData, ReportOverview };

export interface PatientListParams {
  search?: string;
  admitted?: boolean;
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

export interface Api {
  mode: 'demo' | 'live';
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  dashboard(): Promise<DashboardStats>;
  listPatients(params?: PatientListParams): Promise<Patient[]>;
  createPatient(input: NewPatientInput): Promise<Patient>;
  updatePatient(id: string, input: PatientUpdateInput): Promise<Patient>;
  deletePatient(id: string): Promise<void>;
  admitPatient(input: AdmitInput): Promise<{ admission_id: string; family_pin: string }>;
  regenerateFamilyPin(admissionId: string): Promise<{ family_pin: string }>;
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
  // المدير العام
  listHospitals(): Promise<HospitalListItem[]>;
  createHospital(input: CreateHospitalInput): Promise<Hospital>;
  updateHospitalById(id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }): Promise<Hospital>;
  addHospitalAdmin(hospitalId: string, input: HospitalAdminInput): Promise<HospitalAdminInfo>;
  switchHospital(hospitalId: string): Promise<Hospital>;
  // صفحة ذوي المريض (عامة)
  publicTrack(code: string): Promise<PublicTrackInfo>;
  familyTrack(code: string, pin: string): Promise<PublicTrackFamily>;
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