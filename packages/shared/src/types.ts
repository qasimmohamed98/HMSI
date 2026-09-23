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
  'users.manage',
  'patients.create',
  'patients.update',
  'patients.view',
  'chart.view',
  'vitals.write',
  'notes.write.doctor',
  'notes.write.nursing',
  'medications.manage',
  'lab.add_result',
  'radiology.add_report',
  'admissions.manage',
  'discharge.approve',
  'settings.manage',
  'audit.view',
  'reports.view',
  'files.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [
    'users.manage',
    'patients.create',
    'patients.update',
    'patients.view',
    'chart.view',
    'admissions.manage',
    'discharge.approve',
    'settings.manage',
    'audit.view',
    'reports.view',
    'files.manage',
  ],
  doctor: [
    'patients.create',
    'patients.update',
    'patients.view',
    'chart.view',
    'notes.write.doctor',
    'medications.manage',
    'admissions.manage',
    'reports.view',
    'files.manage',
  ],
  nurse: [
    'patients.view',
    'chart.view',
    'notes.write.nursing',
    'vitals.write',
    'admissions.manage',
    'files.manage',
  ],
  pharmacist: ['patients.view', 'chart.view', 'medications.manage'],
  lab: ['patients.view', 'chart.view', 'lab.add_result'],
  radiology: ['patients.view', 'chart.view', 'radiology.add_report'],
  reception: ['patients.create', 'patients.update', 'patients.view', 'admissions.manage'],
  viewer: ['patients.view', 'chart.view'],
};

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
}

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
  recorded_by: string;
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

export interface DashboardStats {
  totalPatients: number;
  activeAdmissions: number;
  dischargedToday: number;
  criticalAlerts: number;
  pendingLabs: number;
  occupancy: { ward_name_ar: string; ward_name_en: string; used: number; total: number }[];
  admissionsTrend: { label: string; count: number }[];
  recentActivity: TimelineEvent[];
}

export interface Bed {
  id: string;
  ward_id: string;
  room: string;
  bed_no: string;
  status: 'free' | 'occupied';
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