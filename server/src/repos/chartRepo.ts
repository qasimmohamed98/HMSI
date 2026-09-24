import type {
  ChartData,
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
  MedicationAdministration,
  FluidEntry,
} from '@hmsi/shared';
import { db } from '../../db/index.js';
import { getPatientById, mapAdmission, ADMISSION_COLUMNS } from './patientRepo.js';

export type { ChartData };

/** التنويم ضمن مستشفى المستخدم — الحارس الأساسي لعزل المستشفيات في كل السجلات الطبية */
export async function getAdmissionScope(admissionId: string, hospitalId: string): Promise<{ admission: AdmissionSummary; patientId: string } | null> {
  const rows = await db.execute({
    sql: `SELECT ${ADMISSION_COLUMNS}
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

/**
 * الملف الطبي للمريض. افتراضياً يُعرض التنويم النشط (أو الأحدث)،
 * ويمكن طلب تنويم سابق عبر admissionId.
 */
export async function getChart(patientId: string, hospitalId: string, admissionId?: string): Promise<ChartData | null> {
  const patient = await getPatientById(patientId, hospitalId);
  if (!patient) return null;

  const admissionRows = await db.execute({
    sql: `SELECT ${ADMISSION_COLUMNS}
          FROM admissions a
          LEFT JOIN departments d ON d.id = a.department_id
          LEFT JOIN wards w ON w.id = a.ward_id
          WHERE a.patient_id = ?
          ORDER BY a.admitted_at DESC`,
    args: [patient.id],
  });
  const admissions = admissionRows.rows.map((r) => mapAdmission(r as Record<string, unknown>)!).filter(Boolean);

  const chosen = admissionId
    ? admissions.find((a) => a.id === admissionId)
    : (admissions.find((a) => a.status === 'active') ?? admissions[0]);
  if (admissionId && !chosen) return null;

  if (!chosen) {
    return {
      patient: { ...patient, admission: null },
      admissionId: null,
      admissions,
      vitals: [],
      notes: [],
      diagnoses: [],
      medications: [],
      administrations: [],
      fluids: [],
      labs: [],
      radiology: [],
      consultations: [],
      procedures: [],
      attachments: [],
      timeline: [],
    };
  }

  const q = async <T,>(sql: string): Promise<T[]> =>
    (await db.execute({ sql, args: [chosen.id] })).rows.map((r) => ({ ...r }) as unknown as T);

  const [vitals, notes, diagnoses, medications, administrations, fluids, labs, radiology, consultations, procedures, attachments, timeline] = await Promise.all([
    q<Vitals>(`SELECT * FROM vitals WHERE admission_id = ? ORDER BY recorded_at DESC LIMIT 200`),
    q<MedicalNote>(`SELECT n.*, u.full_name_ar AS author, cu.full_name_ar AS corrected_by
                    FROM medical_notes n JOIN users u ON u.id = n.author_id LEFT JOIN users cu ON cu.id = n.corrected_by
                    WHERE n.admission_id = ? ORDER BY n.recorded_at DESC LIMIT 200`),
    q<Diagnosis>(`SELECT * FROM diagnoses WHERE admission_id = ? ORDER BY created_at DESC LIMIT 100`),
    q<Medication>(`SELECT * FROM medications WHERE admission_id = ? ORDER BY created_at DESC LIMIT 200`),
    q<MedicationAdministration>(`SELECT id, medication_id, admission_id, status, note, administered_by, administered_by_id, administered_at
                                 FROM medication_administrations WHERE admission_id = ? ORDER BY administered_at DESC LIMIT 500`),
    q<FluidEntry>(`SELECT id, admission_id, direction, kind, volume_ml, note, recorded_by, recorded_at
                   FROM fluid_entries WHERE admission_id = ? ORDER BY recorded_at DESC LIMIT 500`),
    q<LabResult>(`SELECT * FROM lab_results WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 200`),
    q<RadiologyReport>(`SELECT * FROM radiology_reports WHERE admission_id = ? ORDER BY ordered_at DESC LIMIT 100`),
    q<Consultation>(`SELECT * FROM consultations WHERE admission_id = ? ORDER BY requested_at DESC LIMIT 100`),
    q<Procedure>(`SELECT * FROM procedures WHERE admission_id = ? ORDER BY performed_at DESC LIMIT 100`),
    q<Attachment>(`SELECT id, admission_id, uploaded_by, file_name, mime, size, created_at FROM attachments WHERE admission_id = ? ORDER BY created_at DESC LIMIT 100`),
    q<TimelineEvent>(`SELECT * FROM timeline_events WHERE admission_id = ? ORDER BY created_at DESC LIMIT 200`),
  ]);

  return {
    patient: { ...patient, admission: chosen },
    admissionId: chosen.id,
    admissions,
    vitals,
    notes,
    diagnoses,
    medications,
    administrations,
    fluids,
    labs,
    radiology,
    consultations,
    procedures,
    attachments,
    timeline,
  };
}
