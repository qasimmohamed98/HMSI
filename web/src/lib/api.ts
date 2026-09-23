import type {
  User,
  Patient,
  AdmissionSummary,
  Vitals,
  MedicalNote,
  Diagnosis,
  Medication,
  LabResult,
  RadiologyReport,
  Consultation,
  Procedure,
  Attachment,
  TimelineEvent,
  DashboardStats,
  Ward,
  PublicUser,
} from '@hmsi/shared';
import { demoApi } from './api-demo';
import { liveApi } from './api-live';

export interface ChartData {
  patient: Patient & { admission: AdmissionSummary | null };
  admissionId: string | null;
  vitals: Vitals[];
  notes: MedicalNote[];
  diagnoses: Diagnosis[];
  medications: Medication[];
  labs: LabResult[];
  radiology: RadiologyReport[];
  consultations: Consultation[];
  procedures: Procedure[];
  attachments: Attachment[];
  timeline: TimelineEvent[];
}

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
  category?: string;
  result: string;
  unit?: string | null;
  referenceRange?: string | null;
}

export interface RadiologyInput {
  admissionId: string;
  studyTypeAr: string;
  studyTypeEn?: string | null;
  report: string;
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
}

export interface RadiologyUpdateInput {
  report: string;
}

export interface MedicationStatusInput {
  status: 'active' | 'discontinued' | 'completed';
  endAt?: string | null;
}

export interface NoteUpdateInput {
  content: string;
}

export interface ConsultationResponseInput {
  response: string;
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

export interface Api {
  mode: 'demo' | 'live';
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  dashboard(): Promise<DashboardStats>;
  listPatients(params?: PatientListParams): Promise<Patient[]>;
  createPatient(input: NewPatientInput): Promise<Patient>;
  admitPatient(input: AdmitInput): Promise<void>;
  transferPatient(input: TransferInput): Promise<void>;
  getChart(patientId: string): Promise<ChartData>;
  addVitals(input: NewVitalsInput): Promise<Vitals>;
  addNote(input: NoteInput): Promise<MedicalNote>;
  updateNote(admissionId: string, noteId: string, input: NoteUpdateInput): Promise<MedicalNote>;
  deleteNote(admissionId: string, noteId: string): Promise<void>;
  addDiagnosis(input: DiagnosisInput): Promise<Diagnosis>;
  deleteDiagnosis(admissionId: string, diagnosisId: string): Promise<void>;
  addMedication(input: MedicationInput): Promise<Medication>;
  updateMedicationStatus(admissionId: string, medicationId: string, input: MedicationStatusInput): Promise<Medication>;
  deleteMedication(admissionId: string, medicationId: string): Promise<void>;
  addLabResult(input: LabInput): Promise<LabResult>;
  updateLabResult(admissionId: string, labId: string, input: LabResultInput): Promise<LabResult>;
  deleteLabResult(admissionId: string, labId: string): Promise<void>;
  addRadiology(input: RadiologyInput): Promise<RadiologyReport>;
  updateRadiology(admissionId: string, radiologyId: string, input: RadiologyUpdateInput): Promise<RadiologyReport>;
  deleteRadiology(admissionId: string, radiologyId: string): Promise<void>;
  addConsultation(input: ConsultationInput): Promise<Consultation>;
  respondConsultation(admissionId: string, consultationId: string, input: ConsultationResponseInput): Promise<Consultation>;
  deleteConsultation(admissionId: string, consultationId: string): Promise<void>;
  addProcedure(input: ProcedureInput): Promise<Procedure>;
  deleteProcedure(admissionId: string, procedureId: string): Promise<void>;
  discharge(input: DischargeInput): Promise<void>;
  wards(): Promise<Ward[]>;
  listUsers(): Promise<User[]>;
  createUser(input: NewUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  listDoctors(): Promise<PublicUser[]>;
  uploadAttachment(admissionId: string, file: File): Promise<Attachment>;
  deleteAttachment(admissionId: string, attachmentId: string): Promise<void>;
  attachmentUrl(admissionId: string, attachmentId: string): string;
  reportsOverview(from: string, to: string): Promise<ReportOverview>;
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

export interface Api {
  mode: 'demo' | 'live';
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  dashboard(): Promise<DashboardStats>;
  listPatients(params?: PatientListParams): Promise<Patient[]>;
  createPatient(input: NewPatientInput): Promise<Patient>;
  getChart(patientId: string): Promise<ChartData>;
  addVitals(input: NewVitalsInput): Promise<Vitals>;
  addNote(input: NoteInput): Promise<MedicalNote>;
  addDiagnosis(input: DiagnosisInput): Promise<Diagnosis>;
  addMedication(input: MedicationInput): Promise<Medication>;
  addLabResult(input: LabInput): Promise<LabResult>;
  addRadiology(input: RadiologyInput): Promise<RadiologyReport>;
  addConsultation(input: ConsultationInput): Promise<Consultation>;
  addProcedure(input: ProcedureInput): Promise<Procedure>;
  discharge(input: DischargeInput): Promise<void>;
  wards(): Promise<Ward[]>;
  listUsers(): Promise<User[]>;
}

export const API: Api = import.meta.env.VITE_API_MODE === 'live' ? liveApi : demoApi;