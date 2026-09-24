import { z } from 'zod';
import {
  GENDERS,
  BLOOD_TYPES,
  NOTE_KINDS,
  DIAGNOSIS_STATUSES,
  MEDICATION_STATUSES,
  WARD_TYPES,
  DISCHARGE_TYPES,
} from './types.js';

const id = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD');
const optionalString = z.string().max(500).nullable().optional();

export const LoginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
  full_name_ar: z.string().min(2).max(100),
  full_name_en: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['admin', 'doctor', 'nurse', 'pharmacist', 'lab', 'radiology', 'reception', 'viewer']),
});

export const CreatePatientSchema = z.object({
  full_name_ar: z.string().min(2).max(120),
  full_name_en: z.string().min(2).max(120).optional(),
  gender: z.enum(GENDERS),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: optionalString,
  national_id: optionalString,
  blood_type: z.enum(BLOOD_TYPES).default('Unknown'),
  allergies: z.array(z.string().max(100)).default([]),
  critical_alerts: z.array(z.string().max(120)).default([]),
});

export const AdmitPatientSchema = z.object({
  patient_id: id,
  bed_id: id,
  department_id: id,
  attending_doctor_id: id.nullable().optional(),
  reason: z.string().max(500).optional(),
});

export const DischargeSchema = z.object({
  admission_id: id,
  discharge_type: z.enum(DISCHARGE_TYPES),
  summary: z.string().max(2000).optional(),
});

export const CreateVitalsSchema = z.object({
  admission_id: id,
  temperature: z.coerce.number().min(30).max(45).nullable().optional(),
  pulse: z.coerce.number().min(20).max(260).nullable().optional(),
  respiratory_rate: z.coerce.number().min(4).max(120).nullable().optional(),
  bp_systolic: z.coerce.number().min(40).max(280).nullable().optional(),
  bp_diastolic: z.coerce.number().min(20).max(200).nullable().optional(),
  spo2: z.coerce.number().min(30).max(100).nullable().optional(),
  weight: z.coerce.number().min(1).max(400).nullable().optional(),
  glucose: z.coerce.number().min(10).max(800).nullable().optional(),
});

export const UpdateVitalsSchema = CreateVitalsSchema.omit({ admission_id: true }).partial();

export const CreateNoteSchema = z.object({
  admission_id: id,
  kind: z.enum(NOTE_KINDS),
  content: z.string().min(2).max(4000),
});

export const CreateDiagnosisSchema = z.object({
  admission_id: id,
  icd10: z.string().max(20).optional().nullable(),
  title_ar: z.string().min(2).max(200),
  title_en: z.string().max(200).optional().nullable(),
  status: z.enum(DIAGNOSIS_STATUSES).default('suspected'),
});

export const CreateMedicationSchema = z.object({
  admission_id: id,
  name_ar: z.string().min(2).max(120),
  name_en: z.string().max(120).optional().nullable(),
  dose: z.string().max(60),
  route: z.string().max(60),
  frequency: z.string().max(60),
  start_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** طلب فحص (طبيب) أو إدخال مباشر مع النتيجة (فني المختبر) */
export const AddLabResultSchema = z.object({
  admission_id: id,
  test_name_ar: z.string().min(2).max(120),
  test_name_en: z.string().max(120).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  result: z.string().max(500).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  reference_range: z.string().max(120).optional().nullable(),
});

export const UpdateLabResultSchema = z.object({
  result: z.string().min(1).max(500),
  unit: z.string().max(40).optional().nullable(),
  reference_range: z.string().max(120).optional().nullable(),
  abnormal: z.boolean().optional(),
});

export const RadiologyReportSchema = z.object({
  admission_id: id,
  study_type_ar: z.string().min(2).max(120),
  study_type_en: z.string().max(120).optional().nullable(),
  report: z.string().max(4000).optional().nullable(),
});

export const ConsultationSchema = z.object({
  admission_id: id,
  specialty: z.string().min(2).max(80),
  reason: z.string().min(2).max(1000),
});

export const RespondConsultationSchema = z.object({
  response: z.string().min(2).max(2000),
});

export const CreateProcedureSchema = z.object({
  admission_id: id,
  name_ar: z.string().min(2).max(120),
  name_en: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const TransferPatientSchema = z.object({
  admission_id: id,
  bed_id: id,
});

export const UpdateRadiologySchema = z.object({
  report: z.string().min(2).max(4000),
});

export const UpdateMedicationSchema = z.object({
  status: z.enum(MEDICATION_STATUSES).optional(),
  end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  name_ar: z.string().min(2).max(120).optional(),
  name_en: z.string().max(120).optional().nullable(),
  dose: z.string().max(60).optional(),
  route: z.string().max(60).optional(),
  frequency: z.string().max(60).optional(),
  start_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined && x !== null), { message: 'لا توجد بيانات للتحديث' });

export const UpdateNoteSchema = z.object({
  content: z.string().min(2).max(4000),
});

export const UpdateUserSchema = z.object({
  full_name_ar: z.string().min(2).max(100).optional(),
  full_name_en: z.string().min(2).max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['admin', 'doctor', 'nurse', 'pharmacist', 'lab', 'radiology', 'reception', 'viewer']).optional(),
  is_active: z.boolean().optional(),
});

export const CreateDepartmentSchema = z.object({
  name_ar: z.string().min(2).max(120),
  name_en: z.string().min(2).max(120).nullable().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export const CreateWardSchema = z.object({
  department_id: id,
  name_ar: z.string().min(2).max(120),
  name_en: z.string().min(2).max(120).nullable().optional(),
  ward_type: z.enum(WARD_TYPES),
});

export const UpdateWardSchema = CreateWardSchema.partial();

export const CreateBedSchema = z.object({
  ward_id: id,
  room: z.string().min(1).max(40),
  bed_no: z.string().min(1).max(40),
});

export const UpdateBedSchema = z.object({
  room: z.string().min(1).max(40).optional(),
  bed_no: z.string().min(1).max(40).optional(),
});

export const UpdateHospitalSchema = z.object({
  name_ar: z.string().min(2).max(160),
  name_en: z.string().min(2).max(160),
});

const hospitalCode = z.string().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, 'رمز المستشفى: أحرف إنجليزية وأرقام وشرطة فقط');

export const CreateHospitalSchema = z.object({
  name_ar: z.string().min(2).max(160),
  name_en: z.string().min(2).max(160),
  code: hospitalCode.optional(),
});

/** تعديل مستشفى من قبل المدير العام */
export const AdminUpdateHospitalSchema = z.object({
  name_ar: z.string().min(2).max(160).optional(),
  name_en: z.string().min(2).max(160).optional(),
  is_active: z.boolean().optional(),
});

export const CreateHospitalAdminSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
  full_name_ar: z.string().min(2).max(100),
  full_name_en: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
});

export const UpdatePatientSchema = z.object({
  full_name_ar: z.string().min(2).max(120).optional(),
  full_name_en: z.string().max(120).optional().nullable(),
  gender: z.enum(GENDERS).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().max(500).nullable().optional(),
  national_id: z.string().max(500).nullable().optional(),
  blood_type: z.enum(BLOOD_TYPES).optional(),
  allergies: z.array(z.string().max(100)).optional(),
  critical_alerts: z.array(z.string().max(120)).optional(),
});

export const UpdateDiagnosisSchema = z.object({
  icd10: z.string().max(20).optional().nullable(),
  title_ar: z.string().min(2).max(200).optional(),
  title_en: z.string().max(200).optional().nullable(),
  status: z.enum(DIAGNOSIS_STATUSES).optional(),
});

export const UpdateProcedureSchema = z.object({
  name_ar: z.string().min(2).max(120).optional(),
  name_en: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateConsultationSchema = z.object({
  specialty: z.string().min(2).max(80).optional(),
  reason: z.string().min(2).max(1000).optional(),
  response: z.string().min(2).max(2000).optional(),
});

const newPassword = z
  .string()
  .min(8, 'كلمة المرور 8 أحرف على الأقل')
  .max(128)
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /\d/.test(v), { message: 'كلمة المرور يجب أن تحتوي حروفاً وأرقاماً' });

export const ChangePasswordSchema = z
  .object({ current_password: z.string().min(1).max(128), new_password: newPassword })
  .refine((v) => v.current_password !== v.new_password, { message: 'كلمة المرور الجديدة مطابقة للحالية' });

export const ResetPasswordSchema = z.object({ password: newPassword });

export const ReportRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: 'تاريخ البداية بعد تاريخ النهاية' })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 366, { message: 'المدى الأقصى للتقرير سنة واحدة' });

export const FamilyPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'الرمز يتكون من 6 أرقام'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;
export type CreateHospitalInput = z.infer<typeof CreateHospitalSchema>;
export type CreateHospitalAdminInput = z.infer<typeof CreateHospitalAdminSchema>;
export type AdmitPatientInput = z.infer<typeof AdmitPatientSchema>;
export type CreateVitalsInput = z.infer<typeof CreateVitalsSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type CreateDiagnosisInput = z.infer<typeof CreateDiagnosisSchema>;
export type CreateMedicationInput = z.infer<typeof CreateMedicationSchema>;
export type AddLabResultInput = z.infer<typeof AddLabResultSchema>;