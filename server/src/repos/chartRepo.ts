import type {
  ChartData,
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
  TimelineEvent,
  AdmissionSummary,
} from '@hmsi/shared';
import { db } from '../../db/index.js';
import { getPatientById, mapAdmission } from './patientRepo.js';

export type { ChartData };

export async function getAdmissionScope(admissionId: string, hospitalId: string): Promise<{ admission: AdmissionSummary; patientId: string } | null> {
  const rows = await db.execute({
    sql: `SELECT a.patient_id, a.id AS admission_id, a.department_id, a.ward_id, a.room,
                 a.bed_no, a.status, a.admitted_at,
                 d.name_ar AS department_name_ar, d.name_en AS department_name_en,
                 w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 CASE WHEN a.attending_doctor_id IS NOT NULL THEN
                   (SELECT full_name_ar FROM users u WHERE u.id = a.attending_doctor_id) END AS attending_doctor
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN departments d ON d.id = a.department_id
          LEFT JOIN wards w ON w.id = a.ward_id
          WHERE a.id = ? AND p.hospital_id = ?
          LIMIT 1`,
    args: [admissionId, hospitalId],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return { admission: mapAdmission(r)!, patientId: String(r.patient_id) };
}

export async function getChart(patientId: string, hospitalId: string): Promise<ChartData | null> {
  const patient = await getPatientById(patientId, hospitalId);
  if (!patient) return null;

  return getChartForPatient(patient);
}

async function getChartForPatient(patient: Patient): Promise<ChartData> {
  const admissions = await db.execute({
    sql: `SELECT a.id AS admission_id, a.patient_id, a.department_id, a.ward_id, a.room,
                 a.bed_no, a.status, a.admitted_at,
                 d.name_ar AS department_name_ar, d.name_en AS department_name_en,
                 w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 CASE WHEN a.attending_doctor_id IS NOT NULL THEN
                   (SELECT full_name_ar FROM users u WHERE u.id = a.attending_doctor_id) END AS attending_doctor
          FROM admissions a
          LEFT JOIN departments d ON d.id = a.department_id
          LEFT JOIN wards w ON w.id = a.ward_id
          WHERE a.patient_id = ?
          ORDER BY a.admitted_at DESC`,
    args: [patient.id],
  });

  const active = admissions.rows.find((r) => String((r as Record<string, unknown>).status) === 'active');
  const chosen = admissions.rows[0] as Record<string, unknown> | undefined;
  if (!chosen) {
    return {
      patient: { ...patient, admission: null },
      admissionId: null,
      vitals: [],
      notes: [],
      diagnoses: [],
      medications: [],
      labs: [],
      radiology: [],
      consultations: [],
      procedures: [],
      attachments: [],
      timeline: [],
    };
  }

  const admissionId = String(active ? (active as Record<string, unknown>).admission_id : chosen.admission_id);

  const q = async <T,>(sql: string): Promise<T[]> =>
    (await db.execute({ sql, args: [admissionId] })).rows as unknown as T[];

  const [vitals, notes, diagnoses, medications, labs, radiology, consultations, procedures, attachments, timeline] = await Promise.all([
    q<Vitals>(`SELECT * FROM vitals WHERE admission_id = ? ORDER BY recorded_at DESC LIMIT 100`),
    q<MedicalNote>(`SELECT n.*, u.full_name_ar AS author FROM medical_notes n JOIN users u ON u.id = n.author_id WHERE n.admission_id = ? ORDER BY n.recorded_at DESC LIMIT 200`),
    q<Diagnosis>(`SELECT * FROM diagnoses WHERE admission_id = ? ORDER BY created_at DESC LIMIT 50`),
    q<Medication>(`SELECT * FROM medications WHERE admission_id = ? ORDER BY created_at DESC LIMIT 100`),
    q<LabResult>(`SELECT * FROM lab_results WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 100`),
    q<RadiologyReport>(`SELECT * FROM radiology_reports WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 50`),
    q<Consultation>(`SELECT * FROM consultations WHERE admission_id = ? ORDER BY requested_at DESC LIMIT 50`),
    q<Procedure>(`SELECT * FROM procedures WHERE admission_id = ? ORDER BY performed_at DESC LIMIT 50`),
    q<Attachment>(`SELECT id, admission_id, uploaded_by, file_name, mime, size, created_at FROM attachments WHERE admission_id = ? ORDER BY created_at DESC LIMIT 50`),
    q<TimelineEvent>(`SELECT * FROM timeline_events WHERE admission_id = ? ORDER BY created_at DESC LIMIT 100`),
  ]);

  const admission = mapAdmission(chosen);
  return {
    patient: { ...patient, admission },
    admissionId,
    vitals: [...vitals],
    notes: [...notes],
    diagnoses: [...diagnoses],
    medications: [...medications],
    labs: [...labs],
    radiology: [...radiology],
    consultations: [...consultations],
    procedures: [...procedures],
    attachments: [...attachments],
    timeline: [...timeline],
  };
}