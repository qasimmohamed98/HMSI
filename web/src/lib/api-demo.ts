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
  TimelineEvent,
  DashboardStats,
  Ward,
  PublicUser,
  Attachment,
  AdmissionSummary,
  Hospital,
  Department,
  UnassignedPatient,
} from '@hmsi/shared';
import type {
  Api,
  ChartData,
  PatientListParams,
  NewVitalsInput,
  NoteInput,
  DiagnosisInput,
  MedicationInput,
  LabInput,
  RadiologyInput,
  ConsultationInput,
  ProcedureInput,
  DischargeInput,
  NewPatientInput,
  AdmitInput,
  TransferInput,
  LabResultInput,
  RadiologyUpdateInput,
  MedicationStatusInput,
  NoteUpdateInput,
  PatientUpdateInput,
  DiagnosisUpdateInput,
  ProcedureUpdateInput,
  VitalsUpdateInput,
  ConsultationUpdateInput,
  DepartmentInput,
  WardInput,
  BedInput,
  HospitalProfileInput,
  NewUserInput,
  UpdateUserInput,
  ReportOverview,
} from './api';
import { createDemoStore, jsonParse, DEMO_DEPARTMENTS, type DemoStore, type AdmissionRecord } from './demo-data';

let store: DemoStore = createDemoStore();
export const resetStore = () => {
  store = createDemoStore();
};

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

const requireUser = (): User => {
  if (!store.currentUser) throw new Error('unauthorized');
  return store.currentUser;
};

function actorName(u: User | null): string {
  return u ? u.full_name_ar || u.username : 'النظام';
}

function normalize(admissionId: string, record: AdmissionRecord) {
  fillAdmission(record.vitals, admissionId);
  fillAdmission(record.notes, admissionId);
  fillAdmission(record.diagnoses, admissionId);
  fillAdmission(record.medications, admissionId);
  fillAdmission(record.labs, admissionId);
  fillAdmission(record.radiology, admissionId);
  fillAdmission(record.consultations, admissionId);
  fillAdmission(record.procedures, admissionId);
  fillAdmission(record.attachments, admissionId);
}
function fillAdmission(arr: { admission_id: string }[], admissionId: string) {
  arr.forEach((x) => (x.admission_id = admissionId));
}

function pushTimeline(record: AdmissionRecord, actor: string, type: string, titleAr: string, titleEn: string, at: string) {
  const ev: TimelineEvent = { id: uid(), admission_id: record.admission.id, actor, type, title_ar: titleAr, title_en: titleEn, created_at: at };
  record.timeline.unshift(ev);
  store.activity.unshift(ev);
  store.sideEffects++;
}

function buildChart(patientId: string): ChartData {
  const entry = store.patients[patientId];
  if (!entry) throw new Error('not_found');
  const record = entry.record;
  if (record) normalize(record.admission.id, record);
  const patient: Patient & { admission: ChartData['patient']['admission'] } = {
    ...entry.patient,
    admission: record?.admission ?? null,
  };
  return {
    patient,
    admissionId: record?.admission.id ?? null,
    vitals: record ? [...record.vitals].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)) : [],
    notes: record ? [...record.notes].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)) : [],
    diagnoses: record ? [...record.diagnoses] : [],
    medications: record ? [...record.medications] : [],
    labs: record ? [...record.labs] : [],
    radiology: record ? [...record.radiology] : [],
    consultations: record ? [...record.consultations] : [],
    procedures: record ? [...record.procedures] : [],
    attachments: record ? [...record.attachments] : [],
    timeline: record
      ? [...record.timeline].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
      : [],
  };
}

export const demoApi: Api = {
  mode: 'demo',

  async login(username, password) {
    await delay(500);
    if (password.length < 8) throw new Error('invalid');
    const user = store.users.find((u) => u.username === username.toLowerCase());
    if (!user || user.password !== password) throw new Error('invalid');
    store.currentUser = { ...user };
    const { password: _pw, ...pub } = user;
    void _pw;
    return pub;
  },

  async logout() {
    store.currentUser = null;
  },

  async me() {
    return store.currentUser ? { ...store.currentUser } : null;
  },

  async dashboard(): Promise<DashboardStats> {
    await delay(300);
    const entries = Object.values(store.patients);
    const active = entries.filter((e) => e.record?.admission.status === 'active');
    const today = new Date().toISOString().slice(0, 10);
    const dischargedToday = entries.filter((e) => e.record?.admission.status === 'discharged' && (e.record?.admission.admitted_at ?? '').slice(0, 10) === today).length;
    const criticalAlerts = active.filter((e) => jsonParse<string[]>(e.patient.critical_alerts_json, []).length > 0).length;
    const allLabs = entries.flatMap((e) => e.record?.labs ?? []);
    const pendingLabs = allLabs.filter((l) => l.status === 'ordered' || l.status === 'in_progress').length;

    const occupancy = store.wards.map((w) => {
      const used = active.filter((e) => e.record?.admission.ward_id === w.id).length;
      return { ward_name_ar: w.name_ar, ward_name_en: w.name_en, used, total: w.beds.length };
    });

    const trend: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = entries.filter((e) => (e.record?.admission.admitted_at ?? '').slice(0, 10) === key).length;
      trend.push({ label: key, count });
    }

    return {
      totalPatients: entries.length,
      activeAdmissions: active.length,
      dischargedToday,
      criticalAlerts,
      pendingLabs,
      occupancy,
      admissionsTrend: trend,
      recentActivity: store.activity.slice(0, 8),
    };
  },

  async listPatients(params?: PatientListParams): Promise<Patient[]> {
    await delay(250);
    let list = Object.values(store.patients).map((e) => ({
      ...e.patient,
      activeAdmission: e.record && e.record.admission.status === 'active' ? e.record.admission : null,
    }));
    if (params?.admitted) list = list.filter((p) => p.activeAdmission);
    const q = (params?.search ?? '').trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.full_name_ar.toLowerCase().includes(q) || p.full_name_en.toLowerCase().includes(q) || p.file_number.toLowerCase().includes(q));
    }
    return list;
  },

  async createPatient(input: NewPatientInput): Promise<Patient> {
    const u = requireUser();
    const existing = Object.values(store.patients);
    const maxNum = existing.reduce((m, e) => Math.max(m, parseInt(e.patient.file_number.split('-')[1] || '0', 10)), 24500);
    const patient: Patient = {
      id: uid(),
      hospital_id: u.hospital_id,
      file_number: `FM-${maxNum + 1}`,
      full_name_ar: input.fullNameAr,
      full_name_en: input.fullNameEn ?? input.fullNameAr,
      gender: input.gender,
      birth_date: input.birthDate,
      phone: input.phone ?? null,
      national_id: input.nationalId ?? null,
      blood_type: (input.bloodType as Patient['blood_type']) ?? 'Unknown',
      allergies_json: JSON.stringify(input.allergies),
      critical_alerts_json: JSON.stringify(input.criticalAlerts),
      status: 'active',
      created_at: new Date().toISOString(),
    };
    store.patients[patient.id] = { patient, record: null };
    return patient;
  },

  async updatePatient(id: string, input: PatientUpdateInput): Promise<Patient> {
    const entry = store.patients[id];
    if (!entry) throw new Error('not_found');
    const p = entry.patient;
    if (input.fullNameAr !== undefined) p.full_name_ar = input.fullNameAr;
    if (input.fullNameEn !== undefined) p.full_name_en = input.fullNameEn ?? p.full_name_en;
    if (input.gender !== undefined) p.gender = input.gender;
    if (input.birthDate !== undefined) p.birth_date = input.birthDate;
    if (input.phone !== undefined) p.phone = input.phone ?? null;
    if (input.nationalId !== undefined) p.national_id = input.nationalId ?? null;
    if (input.bloodType !== undefined) p.blood_type = (input.bloodType as Patient['blood_type']) ?? 'Unknown';
    if (input.allergies !== undefined) p.allergies_json = JSON.stringify(input.allergies);
    if (input.criticalAlerts !== undefined) p.critical_alerts_json = JSON.stringify(input.criticalAlerts);
    return { ...p };
  },

  async deletePatient(id: string): Promise<void> {
    const entry = store.patients[id];
    if (!entry) throw new Error('not_found');
    if (entry.record?.admission.status === 'active') entry.record.admission.status = 'discharged';
    delete store.patients[id];
  },

  async getChart(patientId: string): Promise<ChartData> {
    await delay(320);
    return buildChart(patientId);
  },

  async addVitals(input: NewVitalsInput): Promise<Vitals> {
    const u = requireUser();
    const entry = store.patients[Object.values(store.patients).find((x) => x.record?.admission.id === input.admissionId)?.patient.id ?? ''];
    const record = entry?.record;
    if (!record) throw new Error('not_found');
    const vit: Vitals = {
      id: uid(),
      admission_id: input.admissionId,
      recorded_at: new Date().toISOString(),
      temperature: input.temperature,
      pulse: input.pulse,
      respiratory_rate: input.respiratoryRate,
      bp_systolic: input.bpSystolic,
      bp_diastolic: input.bpDiastolic,
      spo2: input.spo2,
      weight: input.weight,
      glucose: input.glucose,
      recorded_by: actorName(u),
    };
    record.vitals.unshift(vit);
    pushTimeline(record, actorName(u), 'vitals', 'تسجيل علامات حيوية', 'Vitals recorded', vit.recorded_at);
    return vit;
  },

  async updateVitals(vitalsId: string, input: VitalsUpdateInput): Promise<Vitals> {
    const found = Object.values(store.patients).map((e) => e.record?.vitals.find((v) => v.id === vitalsId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (input.temperature !== undefined) found.temperature = input.temperature ?? null;
    if (input.pulse !== undefined) found.pulse = input.pulse ?? null;
    if (input.respiratoryRate !== undefined) found.respiratory_rate = input.respiratoryRate ?? null;
    if (input.bpSystolic !== undefined) found.bp_systolic = input.bpSystolic ?? null;
    if (input.bpDiastolic !== undefined) found.bp_diastolic = input.bpDiastolic ?? null;
    if (input.spo2 !== undefined) found.spo2 = input.spo2 ?? null;
    if (input.weight !== undefined) found.weight = input.weight ?? null;
    if (input.glucose !== undefined) found.glucose = input.glucose ?? null;
    return found;
  },

  async deleteVitals(vitalsId: string): Promise<void> {
    const record = findRecordContaining('vitals', vitalsId);
    record.vitals = record.vitals.filter((x) => x.id !== vitalsId);
  },

  async addNote(input: NoteInput): Promise<MedicalNote> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const note: MedicalNote = {
      id: uid(),
      admission_id: input.admissionId,
      kind: input.kind,
      author: actorName(u),
      recorded_at: new Date().toISOString(),
      content: input.content,
      corrected_by: null,
    };
    record.notes.unshift(note);
    pushTimeline(record, actorName(u), 'note', input.kind === 'doctor' ? 'ملاحظة طبية' : 'ملاحظة تمريض', input.kind === 'doctor' ? 'Doctor note' : 'Nursing note', note.recorded_at);
    return note;
  },

  async addDiagnosis(input: DiagnosisInput): Promise<Diagnosis> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const dg: Diagnosis = {
      id: uid(),
      admission_id: input.admissionId,
      icd10: input.icd10 ?? null,
      title_ar: input.titleAr,
      title_en: input.titleEn ?? null,
      status: input.status ?? 'suspected',
      added_by: actorName(u),
    };
    record.diagnoses.unshift(dg);
    pushTimeline(record, actorName(u), 'diagnosis', `إضافة تشخيص: ${dg.title_ar}`, `Diagnosis added: ${dg.title_ar}`, new Date().toISOString());
    return dg;
  },

  async updateDiagnosis(_admissionId: string, diagnosisId: string, input: DiagnosisUpdateInput): Promise<Diagnosis> {
    const found = Object.values(store.patients).map((e) => e.record?.diagnoses.find((d) => d.id === diagnosisId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (input.icd10 !== undefined) found.icd10 = input.icd10 ?? null;
    if (input.titleAr !== undefined) found.title_ar = input.titleAr;
    if (input.titleEn !== undefined) found.title_en = input.titleEn ?? null;
    if (input.status !== undefined) found.status = input.status;
    return found;
  },

  async addMedication(input: MedicationInput): Promise<Medication> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const med: Medication = {
      id: uid(),
      admission_id: input.admissionId,
      name_ar: input.nameAr,
      name_en: input.nameEn ?? null,
      dose: input.dose,
      route: input.route,
      frequency: input.frequency,
      start_at: input.startAt,
      end_at: input.endAt ?? null,
      status: 'active',
      prescribed_by: actorName(u),
    };
    record.medications.unshift(med);
    pushTimeline(record, actorName(u), 'medication', `وصف دواء: ${med.name_ar}`, `Medication: ${med.name_ar}`, new Date().toISOString());
    return med;
  },

  async updateMedication(_admissionId: string, medicationId: string, input: MedicationStatusInput): Promise<Medication> {
    const found = Object.values(store.patients).map((e) => e.record?.medications.find((m) => m.id === medicationId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (input.nameAr !== undefined) found.name_ar = input.nameAr;
    if (input.nameEn !== undefined) found.name_en = input.nameEn ?? null;
    if (input.dose !== undefined) found.dose = input.dose;
    if (input.route !== undefined) found.route = input.route;
    if (input.frequency !== undefined) found.frequency = input.frequency;
    if (input.startAt !== undefined) found.start_at = input.startAt;
    if (input.status !== undefined) found.status = input.status;
    if (input.endAt !== undefined) found.end_at = input.endAt ?? null;
    return found;
  },

  async addLabResult(input: LabInput): Promise<LabResult> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const lab: LabResult = {
      id: uid(),
      admission_id: input.admissionId,
      test_name_ar: input.testNameAr,
      test_name_en: input.testNameEn ?? null,
      category: input.category ?? '',
      ordered_by: actorName(u),
      ordered_at: new Date().toISOString(),
      result: input.result,
      unit: input.unit ?? null,
      reference_range: input.referenceRange ?? null,
      status: 'resulted',
      resulted_by: actorName(u),
      resulted_at: new Date().toISOString(),
    };
    record.labs.unshift(lab);
    pushTimeline(record, actorName(u), 'lab', `إضافة نتيجة مختبر: ${lab.test_name_ar}`, `Lab result: ${lab.test_name_ar}`, lab.ordered_at);
    return lab;
  },

  async addRadiology(input: RadiologyInput): Promise<RadiologyReport> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const rad: RadiologyReport = {
      id: uid(),
      admission_id: input.admissionId,
      study_type_ar: input.studyTypeAr,
      study_type_en: input.studyTypeEn ?? null,
      ordered_by: actorName(u),
      ordered_at: new Date().toISOString(),
      report: input.report,
      status: 'resulted',
      performed_by: actorName(u),
    };
    record.radiology.unshift(rad);
    pushTimeline(record, actorName(u), 'radiology', `تقرير أشعة: ${rad.study_type_ar}`, `Radiology: ${rad.study_type_ar}`, rad.ordered_at);
    return rad;
  },

  async addConsultation(input: ConsultationInput): Promise<Consultation> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const cons: Consultation = {
      id: uid(),
      admission_id: input.admissionId,
      specialty: input.specialty,
      reason: input.reason,
      response: null,
      requested_by: actorName(u),
      requested_at: new Date().toISOString(),
      responded_by: null,
      responded_at: null,
    };
    record.consultations.unshift(cons);
    pushTimeline(record, actorName(u), 'consultation', `طلب استشارة: ${cons.specialty}`, `Consultation: ${cons.specialty}`, cons.requested_at);
    return cons;
  },

  async addProcedure(input: ProcedureInput): Promise<Procedure> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const proc: Procedure = {
      id: uid(),
      admission_id: input.admissionId,
      name_ar: input.nameAr,
      name_en: input.nameEn ?? null,
      notes: input.notes ?? null,
      performed_by: actorName(u),
      performed_at: new Date().toISOString(),
    };
    record.procedures.unshift(proc);
    pushTimeline(record, actorName(u), 'procedure', `إجراء: ${proc.name_ar}`, `Procedure: ${proc.name_ar}`, proc.performed_at);
    return proc;
  },

  async discharge(input: DischargeInput) {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    record.admission.status = 'discharged';
    record.admission.discharged_at = new Date().toISOString();
    const patient = Object.values(store.patients).find((x) => x.record === record);
    if (patient) patient.patient.status = 'discharged';
    pushTimeline(record, actorName(u), 'discharge', `تسجيل خروج: ${input.summary.slice(0, 60)}`, 'Discharge recorded', new Date().toISOString());
  },

  async wards(): Promise<Ward[]> {
    await delay(200);
    const active = Object.values(store.patients).filter((e) => e.record?.admission.status === 'active');
    return store.wards.map((w) => ({
      ...w,
      beds: w.beds.map((b) => ({
        ...b,
        status: active.some((e) => e.record?.admission.ward_id === w.id && e.record.admission.bed_no === b.bed_no) ? 'occupied' : 'free',
      })),
    }));
  },

  async listDepartments(): Promise<Department[]> {
    await delay(200);
    return store.departments.map((d) => ({ ...d, ward_count: store.wards.filter((w) => w.department_id === d.id).length }));
  },

  async createDepartment(input: DepartmentInput): Promise<Department> {
    await delay(200);
    const created: Department = { id: uid(), hospital_id: store.hospital.id, name_ar: input.nameAr, name_en: input.nameEn ?? input.nameAr, ward_count: 0 };
    store.departments.push(created);
    return created;
  },

  async updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
    await delay(200);
    const target = store.departments.find((d) => d.id === id);
    if (!target) throw new Error('not_found');
    if (input.nameAr !== undefined) target.name_ar = input.nameAr;
    if (input.nameEn !== undefined) target.name_en = input.nameEn ?? target.name_en;
    return { ...target };
  },

  async deleteDepartment(id: string): Promise<void> {
    await delay(200);
    if (store.wards.some((w) => w.department_id === id)) throw new Error('لا يمكن حذف قسم يحتوي على ردهات');
    const idx = store.departments.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error('not_found');
    store.departments.splice(idx, 1);
  },

  async createWard(input: WardInput): Promise<Ward> {
    await delay(200);
    if (!store.departments.some((d) => d.id === input.departmentId)) throw new Error('القسم غير موجود');
    const dept = store.departments.find((d) => d.id === input.departmentId)!;
    const ward: Ward = {
      id: uid(),
      department_id: input.departmentId,
      department_name_ar: dept.name_ar,
      department_name_en: dept.name_en,
      name_ar: input.nameAr,
      name_en: input.nameEn ?? input.nameAr,
      type: input.wardType,
      beds: [],
    };
    store.wards.push(ward);
    return ward;
  },

  async updateWard(id: string, input: Partial<Omit<WardInput, 'departmentId'>>): Promise<Ward> {
    await delay(200);
    const target = store.wards.find((w) => w.id === id);
    if (!target) throw new Error('not_found');
    if (input.nameAr !== undefined) target.name_ar = input.nameAr;
    if (input.nameEn !== undefined) target.name_en = input.nameEn ?? target.name_en;
    if (input.wardType !== undefined) target.type = input.wardType;
    return { ...target, beds: [...target.beds] };
  },

  async deleteWard(id: string): Promise<void> {
    await delay(200);
    const ward = store.wards.find((w) => w.id === id);
    if (!ward) throw new Error('not_found');
    if (ward.beds.length > 0) throw new Error('لا يمكن حذف ردهة بها أسرّة');
    store.wards = store.wards.filter((w) => w.id !== id);
  },

  async createBed(input: BedInput): Promise<{ id: string; ward_id: string; room: string; bed_no: string; status: 'free' | 'occupied' }> {
    await delay(200);
    const ward = store.wards.find((w) => w.id === input.wardId);
    if (!ward) throw new Error('not_found');
    const bed = { id: uid(), ward_id: input.wardId, room: input.room, bed_no: input.bedNo, status: 'free' as const };
    ward.beds.push(bed);
    return bed;
  },

  async updateBed(id: string, input: { room?: string; bedNo?: string }): Promise<{ id: string; ward_id: string; room: string; bed_no: string; status: 'free' | 'occupied' }> {
    await delay(200);
    const bed = store.wards.flatMap((w) => w.beds).find((b) => b.id === id);
    if (!bed) throw new Error('not_found');
    if (input.room !== undefined) bed.room = input.room;
    if (input.bedNo !== undefined) bed.bed_no = input.bedNo;
    return { ...bed };
  },

  async deleteBed(id: string): Promise<void> {
    await delay(200);
    for (const w of store.wards) {
      const bed = w.beds.find((b) => b.id === id);
      if (bed) {
        if (bed.status === 'occupied') throw new Error('لا يمكن حذف سرير مشغول');
        w.beds = w.beds.filter((b) => b.id !== id);
        return;
      }
    }
    throw new Error('not_found');
  },

  async listUnassigned(): Promise<UnassignedPatient[]> {
    await delay(200);
    return Object.values(store.patients)
      .filter((e) => e.record?.admission.status === 'active' && !e.record.admission.bed_no)
      .map((e) => ({
        admission_id: e.record!.admission.id,
        patient_id: e.patient.id,
        patient_name_ar: e.patient.full_name_ar,
        admitted_at: e.record!.admission.admitted_at,
      }));
  },

  async assignBed(bedId: string, admissionId: string): Promise<void> {
    await delay(200);
    const ward = store.wards.find((w) => w.beds.some((b) => b.id === bedId));
    if (!ward) throw new Error('not_found');
    const bed = ward.beds.find((b) => b.id === bedId)!;
    if (bed.status === 'occupied') throw new Error('السرير مشغول');
    const record = findRecord(admissionId);
    if (record.admission.status !== 'active') throw new Error('التنويم غير نشط');
    record.admission.ward_id = ward.id;
    record.admission.ward_name_ar = ward.name_ar;
    record.admission.ward_name_en = ward.name_en;
    record.admission.room = bed.room;
    record.admission.bed_no = bed.bed_no;
    bed.status = 'occupied';
    pushTimeline(record, actorName(store.currentUser), 'transfer', 'تخصيص سرير', 'Bed assigned', new Date().toISOString());
  },

  async freeBed(bedId: string): Promise<void> {
    await delay(200);
    for (const w of store.wards) {
      const bed = w.beds.find((b) => b.id === bedId);
      if (bed) {
        const record = Object.values(store.patients)
          .map((e) => e.record)
          .find((r) => r?.admission.status === 'active' && r.admission.ward_id === w.id && r.admission.bed_no === bed.bed_no);
        if (record) {
          record.admission.bed_no = '';
          record.admission.room = '';
          record.admission.ward_id = '';
        }
        bed.status = 'free';
        return;
      }
    }
    throw new Error('not_found');
  },

  async bedOccupant(bedId: string): Promise<{ admission_id: string; patient_id: string; patient_name_ar: string } | null> {
    await delay(150);
    const ward = store.wards.find((w) => w.beds.some((b) => b.id === bedId));
    if (!ward) return null;
    const bed = ward.beds.find((b) => b.id === bedId);
    if (!bed || bed.status !== 'occupied') return null;
    const entry = Object.values(store.patients).find(
      (e) => e.record?.admission.status === 'active' && e.record.admission.ward_id === ward.id && e.record.admission.bed_no === bed.bed_no,
    );
    if (!entry?.record) return null;
    return { admission_id: entry.record.admission.id, patient_id: entry.patient.id, patient_name_ar: entry.patient.full_name_ar };
  },

  async hospitalProfile(): Promise<Hospital> {
    await delay(150);
    return { ...store.hospital, id: store.hospital.id };
  },

  async updateHospital(input: HospitalProfileInput): Promise<Hospital> {
    await delay(200);
    store.hospital.name_ar = input.nameAr;
    store.hospital.name_en = input.nameEn;
    store.users.forEach((u) => {
      if (u.hospital_id === store.hospital.id) {
        u.hospital_name_ar = input.nameAr;
        u.hospital_name_en = input.nameEn;
      }
    });
    return { ...store.hospital };
  },

  async listUsers(): Promise<User[]> {
    await delay(250);
    return store.users.map(({ password: _pw, ...pub }) => {
      void _pw;
      return pub;
    });
  },

  async listHospitals(): Promise<Hospital[]> {
    await delay(150);
    return [{ id: store.hospital.id, name_ar: store.hospital.name_ar, name_en: store.hospital.name_en, code: store.hospital.code }];
  },

  async createHospital(input: { nameAr: string; nameEn?: string; code?: string }): Promise<Hospital> {
    await delay(200);
    throw new Error('إنشاء مستشفى جديد غير مدعوم في وضع العرض التوضيحي');
  },

  async addHospitalAdmin(input: { username: string; password: string; fullNameAr: string; fullNameEn?: string; email?: string }): Promise<{ id: string; username: string; fullNameAr: string }> {
    await delay(200);
    const existing = store.users.some((u) => u.username === input.username);
    if (existing) throw new Error('اسم المستخدم مستخدم من قبل');
    const newAdmin = {
      id: 'adm-' + Math.random().toString(36).slice(2, 9),
      hospital_id: store.hospital.id,
      hospital_name_ar: store.hospital.name_ar,
      hospital_name_en: store.hospital.name_en,
      username: input.username,
      full_name_ar: input.fullNameAr,
      full_name_en: input.fullNameEn ?? input.fullNameAr,
      email: input.email ?? null,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      password: input.password,
    };
    store.users.push(newAdmin);
    const { password: _pw, ...pub } = newAdmin;
    void _pw;
    return { id: newAdmin.id, username: newAdmin.username, fullNameAr: newAdmin.full_name_ar };
  },

  async publicTrack(code: string): Promise<{ bed: { id: string; code: string; room: string; bed_no: string; ward_id: string }; hospital: { id: string; name_ar: string; name_en: string }; ward: { id: string; name_ar: string; name_en: string } | null; department: { id: string; name_ar: string; name_en: string } | null; patient: { id: string; file_number: string; full_name_ar: string; full_name_en: string; gender: string; birth_date: string; blood_type: string; allergies: string[]; critical_alerts: string[] } | null; admission: { id: string; status: string; admitted_at: string; discharged_at: string | null; reason: string | null; attending_doctor: string | null } | null; vitals: any[]; notes: any[]; diagnoses: any[]; medications: any[]; labs: any[]; radiology: any[]; consultations: any[]; procedures: any[] } | null> {
    await delay(300);
    // Find bed by code in wards
    let bed = null;
    let ward = null;
    let department = null;
    for (const w of store.wards) {
      const foundBed = w.beds.find((b) => b.code === code);
      if (foundBed) {
        bed = foundBed;
        ward = { id: w.id, name_ar: w.name_ar, name_en: w.name_en };
        // Find department
        const dept = store.departments.find((d) => d.id === w.department_id);
        department = dept ? { id: dept.id, name_ar: dept.name_ar, name_en: dept.name_en } : null;
        break;
      }
    }
    if (!bed) return null;

    // Find active admission for this bed
    let patient = null;
    let admission = null;
    let vitals: any[] = [];
    let notes: any[] = [];
    let diagnoses: any[] = [];
    let medications: any[] = [];
    let labs: any[] = [];
    let radiology: any[] = [];
    let consultations: any[] = [];
    let procedures: any[] = [];

    const admissionEntry = Object.values(store.patients).find((e) => e.record?.admission.ward_id === bed.ward_id && e.record?.admission.bed_no === bed.bed_no && e.record?.admission.status === 'active');
    if (admissionEntry?.record) {
      const rec = admissionEntry.record;
      // Patient
      patient = {
        id: rec.patient.id,
        file_number: rec.patient.file_number,
        full_name_ar: rec.patient.full_name_ar,
        full_name_en: rec.patient.full_name_en,
        gender: rec.patient.gender,
        birth_date: rec.patient.birth_date,
        blood_type: rec.patient.blood_type,
        allergies: rec.patient.allergies_json ? JSON.parse(rec.patient.allergies_json) : [],
        critical_alerts: rec.patient.critical_alerts_json ? JSON.parse(rec.patient.critical_alerts_json) : [],
      };
      // Admission
      admission = {
        id: rec.admission.id,
        status: rec.admission.status,
        admitted_at: rec.admission.admitted_at,
        discharged_at: null,
        reason: rec.admission.reason ?? '',
        attending_doctor: rec.admission.attending_doctor ?? null,
      };
      // Vitals
      vitals = rec.vitals.map((v: any) => ({ recorded_at: v.recorded_at, temperature: v.temperature, pulse: v.pulse, spo2: v.spo2 }));
      // Notes
      notes = rec.notes.map((n: any) => ({ id: n.id, content: n.content, recorded_at: n.recorded_at, author: n.author }));
      // Diagnoses
      diagnoses = rec.diagnoses.map((d: any) => ({ icd10: d.icd10, title_ar: d.title_ar, title_en: d.title_en ?? '', status: d.status }));
      // Medications
      medications = rec.medications.map((m: any) => ({ id: m.id, name_ar: m.name_ar, name_en: m.name_en ?? '', dose: m.dose, route: m.route, frequency: m.frequency, status: m.status }));
      // Labs
      labs = rec.labs.map((l: any) => ({ id: l.id, test_name_ar: l.test_name_ar, test_name_en: l.test_name_en ?? '', category: l.category ?? '', ordered_by: l.ordered_by ?? '', result: l.result, unit: l.unit ?? '', reference_range: l.reference_range ?? '', status: l.status }));
      // Radiology
      radiology = rec.radiology.map((r: any) => ({ id: r.id, study_type_ar: r.study_type_ar, study_type_en: r.study_type_en ?? '', ordered_by: r.ordered_by ?? '', status: r.status }));
      // Consultations
      consultations = rec.consultations.map((c: any) => ({ id: c.id, requested_by: c.requested_by, specialty: c.specialty, reason: c.reason, response: c.response ?? '' }));
      // Procedures
      procedures = rec.procedures.map((p: any) => ({ id: p.id, name_ar: p.name_ar, name_en: p.name_en ?? '', performed_by: p.performed_by ?? '', performed_at: p.performed_at ?? '', notes: p.notes ?? '' }));
    }

    return {
      bed: { id: bed.id, code: bed.code, room: bed.room, bed_no: bed.bed_no, ward_id: bed.ward_id },
      hospital: { id: store.hospital.id, name_ar: store.hospital.name_ar, name_en: store.hospital.name_en },
      ward,
      department,
      patient,
      admission,
      vitals,
      notes,
      diagnoses,
      medications,
      labs,
      radiology,
      consultations,
      procedures,
    };
  },

  async admitPatient(input: AdmitInput): Promise<void> {
    const u = requireUser();
    const entry = store.patients[input.patientId];
    if (!entry) throw new Error('not_found');
    if (entry.record && entry.record.admission.status === 'active') throw new Error('المريض منوّم بالفعل');
    const ward = store.wards.find((w) => w.beds.some((b) => b.id === input.bedId));
    if (!ward) throw new Error('not_found');
    const bed = ward.beds.find((b) => b.id === input.bedId);
    if (bed?.status === 'occupied') throw new Error('السرير مشغول');
    const doc = store.users.find((x) => x.id === input.attendingDoctorId);
    const dept = DEMO_DEPARTMENTS.find((d) => d.id === input.departmentId);
    const admission: AdmissionSummary = {
      id: uid(),
      department_id: input.departmentId,
      department_name_ar: dept?.name_ar ?? '',
      department_name_en: dept?.name_en ?? '',
      ward_id: ward.id,
      ward_name_ar: ward.name_ar,
      ward_name_en: ward.name_en,
      room: bed?.room ?? '',
      bed_no: bed?.bed_no ?? '',
      attending_doctor: doc?.full_name_ar ?? null,
      admitted_at: new Date().toISOString(),
      status: 'active',
    };
    entry.record = {
      admission,
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
    entry.patient.status = 'active';
    pushTimeline(entry.record, actorName(u), 'admission', 'إدخال المريض إلى المستشفى', 'Patient admitted', admission.admitted_at);
  },

  async transferPatient(input: TransferInput): Promise<void> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    const ward = store.wards.find((w) => w.beds.some((b) => b.id === input.bedId));
    const bed = ward?.beds.find((b) => b.id === input.bedId);
    if (!bed) throw new Error('not_found');
    record.admission.ward_id = ward!.id;
    record.admission.ward_name_ar = ward!.name_ar;
    record.admission.ward_name_en = ward!.name_en;
    record.admission.room = bed.room;
    record.admission.bed_no = bed.bed_no;
    pushTimeline(record, actorName(u), 'transfer', 'نقل المريض إلى سرير آخر', 'Patient transferred', new Date().toISOString());
  },

  async updateLabResult(_admissionId: string, labId: string, input: LabResultInput): Promise<LabResult> {
    const u = requireUser();
    const found = Object.values(store.patients).map((e) => e.record?.labs.find((l) => l.id === labId)).find(Boolean);
    if (!found) throw new Error('not_found');
    found.result = input.result;
    found.unit = input.unit ?? null;
    found.reference_range = input.referenceRange ?? null;
    found.status = 'resulted';
    found.resulted_by = actorName(u);
    found.resulted_at = new Date().toISOString();
    return found;
  },

  async updateRadiology(_admissionId: string, radiologyId: string, input: RadiologyUpdateInput): Promise<RadiologyReport> {
    const u = requireUser();
    const found = Object.values(store.patients).map((e) => e.record?.radiology.find((r) => r.id === radiologyId)).find(Boolean);
    if (!found) throw new Error('not_found');
    found.report = input.report;
    found.status = 'resulted';
    found.performed_by = actorName(u);
    return found;
  },

  async updateNote(_admissionId: string, noteId: string, input: NoteUpdateInput): Promise<MedicalNote> {
    const u = requireUser();
    const found = Object.values(store.patients).map((e) => e.record?.notes.find((n) => n.id === noteId)).find(Boolean);
    if (!found) throw new Error('not_found');
    found.content = input.content;
    found.recorded_at = new Date().toISOString();
    found.corrected_by = u.username;
    return found;
  },

  async updateConsultation(_admissionId: string, consultationId: string, input: ConsultationUpdateInput): Promise<Consultation> {
    const u = requireUser();
    const found = Object.values(store.patients).map((e) => e.record?.consultations.find((c) => c.id === consultationId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (input.response !== undefined) {
      if (found.response) throw new Error('تم الرد على الاستشارة مسبقاً');
      found.response = input.response;
      found.responded_by = actorName(u);
      found.responded_at = new Date().toISOString();
      return found;
    }
    if (found.response) throw new Error('لا يمكن تعديل استشارة تم الرد عليها');
    if (input.specialty !== undefined) found.specialty = input.specialty;
    if (input.reason !== undefined) found.reason = input.reason;
    return found;
  },

  async updateProcedure(_admissionId: string, procedureId: string, input: ProcedureUpdateInput): Promise<Procedure> {
    const found = Object.values(store.patients).map((e) => e.record?.procedures.find((p) => p.id === procedureId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (input.nameAr !== undefined) found.name_ar = input.nameAr;
    if (input.nameEn !== undefined) found.name_en = input.nameEn ?? null;
    if (input.notes !== undefined) found.notes = input.notes ?? null;
    return found;
  },

  async deleteNote(_admissionId: string, noteId: string): Promise<void> {
    const record = findRecordContaining('notes', noteId);
    record.notes = record.notes.filter((x) => x.id !== noteId);
  },

  async deleteDiagnosis(_admissionId: string, diagnosisId: string): Promise<void> {
    const record = findRecordContaining('diagnoses', diagnosisId);
    record.diagnoses = record.diagnoses.filter((x) => x.id !== diagnosisId);
  },

  async deleteMedication(_admissionId: string, medicationId: string): Promise<void> {
    const record = findRecordContaining('medications', medicationId);
    record.medications = record.medications.filter((x) => x.id !== medicationId);
  },

  async deleteLabResult(_admissionId: string, labId: string): Promise<void> {
    const record = findRecordContaining('labs', labId);
    record.labs = record.labs.filter((x) => x.id !== labId);
  },

  async deleteRadiology(_admissionId: string, radiologyId: string): Promise<void> {
    const record = findRecordContaining('radiology', radiologyId);
    record.radiology = record.radiology.filter((x) => x.id !== radiologyId);
  },

  async deleteConsultation(_admissionId: string, consultationId: string): Promise<void> {
    const record = findRecordContaining('consultations', consultationId);
    record.consultations = record.consultations.filter((x) => x.id !== consultationId);
  },

  async deleteProcedure(_admissionId: string, procedureId: string): Promise<void> {
    const record = findRecordContaining('procedures', procedureId);
    record.procedures = record.procedures.filter((x) => x.id !== procedureId);
  },

  async createUser(input: NewUserInput): Promise<User> {
    const u = requireUser();
    if (store.users.some((x) => x.username === input.username)) throw new Error('اسم المستخدم مستخدم من قبل');
    const created: User & { password: string } = {
      id: uid(),
      hospital_id: u.hospital_id,
      hospital_name_ar: u.hospital_name_ar,
      hospital_name_en: u.hospital_name_en,
      username: input.username,
      full_name_ar: input.fullNameAr,
      full_name_en: input.fullNameEn ?? '',
      email: input.email ?? null,
      role: input.role,
      is_active: true,
      created_at: new Date().toISOString(),
      password: input.password,
    };
    store.users.push(created);
    const { password: _pw, ...pub } = created;
    void _pw;
    return pub;
  },

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const target = store.users.find((x) => x.id === id);
    if (!target) throw new Error('not_found');
    if (input.fullNameAr !== undefined) target.full_name_ar = input.fullNameAr;
    if (input.fullNameEn !== undefined) target.full_name_en = input.fullNameEn ?? '';
    if (input.email !== undefined) target.email = input.email ?? null;
    if (input.role !== undefined) target.role = input.role;
    if (input.isActive !== undefined) target.is_active = input.isActive;
    const { password: _pw, ...pub } = target;
    void _pw;
    return pub;
  },

  async listDoctors(): Promise<PublicUser[]> {
    return store.users
      .filter((u) => (u.role === 'doctor' || u.role === 'admin') && u.is_active)
      .map((u) => ({ id: u.id, full_name_ar: u.full_name_ar, full_name_en: u.full_name_en, role: u.role }));
  },

  async uploadAttachment(admissionId: string, file: File): Promise<Attachment> {
    const u = requireUser();
    const record = findRecord(admissionId);
    const att: Attachment = {
      id: uid(),
      admission_id: admissionId,
      file_name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      uploaded_by: actorName(u),
      created_at: new Date().toISOString(),
    };
    record.attachments.unshift(att);
    return att;
  },

  async deleteAttachment(_admissionId: string, attachmentId: string): Promise<void> {
    const record = findRecordContaining('attachments', attachmentId);
    record.attachments = record.attachments.filter((x) => x.id !== attachmentId);
  },

  attachmentUrl() {
    return '#';
  },

  async reportsOverview(from: string, to: string): Promise<ReportOverview> {
    await delay(200);
    const entries = Object.values(store.patients);
    const active = entries.filter((e) => e.record?.admission.status === 'active');
    const inRange = (d?: string) => d !== undefined && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
    const admissions = entries.filter((e) => inRange(e.record?.admission.admitted_at));
    const discharges = entries.filter((e) => inRange(e.record?.admission.discharged_at ?? undefined));
    const trend = (key: 'admitted_at' | 'discharged_at') => {
      const days: { label: string; count: number }[] = [];
      let cur = new Date(from);
      const end = new Date(to);
      while (cur <= end) {
        const d = cur.toISOString().slice(0, 10);
        const count = entries.filter((e) => (e.record?.admission[key] ?? '').slice(0, 10) === d).length;
        days.push({ label: d, count });
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    };
    return {
      from,
      to,
      totalAdmissions: admissions.length,
      totalDischarges: discharges.length,
      activeAdmissions: active.length,
      criticalAlerts: active.filter((e) => jsonParse<string[]>(e.patient.critical_alerts_json, []).length > 0).length,
      pendingLabs: entries.flatMap((e) => e.record?.labs ?? []).filter((l) => l.status === 'ordered' || l.status === 'in_progress').length,
      admissionsTrend: trend('admitted_at'),
      dischargesTrend: trend('discharged_at'),
      occupancy: store.wards.map((w) => ({
        ward_name_ar: w.name_ar,
        ward_name_en: w.name_en,
        used: active.filter((e) => e.record?.admission.ward_id === w.id).length,
        total: w.beds.length,
      })),
      recentActivity: store.activity.filter((a) => inRange(a.created_at)).slice(0, 20),
    };
  },
};

function findRecordContaining(key: 'vitals' | 'notes' | 'diagnoses' | 'medications' | 'labs' | 'radiology' | 'consultations' | 'procedures' | 'attachments', id: string): AdmissionRecord {
  const entry = Object.values(store.patients).find((x) => x.record?.[key].some((r) => r.id === id));
  if (!entry?.record) throw new Error('not_found');
  return entry.record;
}

function findRecord(admissionId: string): AdmissionRecord {
  const entry = Object.values(store.patients).find((x) => x.record?.admission.id === admissionId);
  if (!entry?.record) throw new Error('not_found');
  return entry.record;
}