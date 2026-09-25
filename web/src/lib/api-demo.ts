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
  HospitalListItem,
  HospitalAdminInfo,
  Department,
  UnassignedPatient,
  Bed,
  PublicTrackInfo,
  PublicTrackFamily,
  AuditEntry,
  MedicationAdministration,
  FluidEntry,
  MewsAlert,
  FamilyShare,
  FamilyShareCategory,
} from '@hmsi/shared';
import { calcMews, FAMILY_SHARE_CATEGORIES, FAMILY_SHARE_DOCTOR_ONLY, hasPermission } from '@hmsi/shared';
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
  CreateHospitalInput,
  HospitalAdminInput,
  FluidInput,
  AdministrationInput,
} from './api';
import { createDemoStore, jsonParse, DEMO_DEPARTMENTS, type DemoStore, type AdmissionRecord } from './demo-data';

let store: DemoStore = createDemoStore();
export const resetStore = () => {
  store = createDemoStore();
};

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const demoPin = () => String(Math.floor(100000 + Math.random() * 900000));
/** مستشفيات إضافية أنشأها المدير العام في وضع العرض (في الذاكرة فقط) */
const extraHospitals: Hospital[] = [];
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
    admissions: record ? [record.admission] : [],
    vitals: record ? [...record.vitals].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)) : [],
    notes: record ? [...record.notes].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)) : [],
    diagnoses: record ? [...record.diagnoses] : [],
    medications: record ? [...record.medications] : [],
    administrations: record ? [...(record.administrations ?? [])].sort((a, b) => (a.administered_at > b.administered_at ? -1 : 1)) : [],
    fluids: record ? [...(record.fluids ?? [])].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)) : [],
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
      mewsAlerts: active.flatMap((e): MewsAlert[] => {
        const v = e.record?.vitals.slice().sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1))[0];
        const m = v ? calcMews(v) : null;
        if (!v || !m || m.level === 'low' || !e.record) return [];
        const adm = e.record.admission;
        return [{ patient_id: e.patient.id, patient_name_ar: e.patient.full_name_ar, patient_name_en: e.patient.full_name_en, ward_name_ar: adm.ward_name_ar, ward_name_en: adm.ward_name_en, bed_no: adm.bed_no, score: m.score, level: m.level, recorded_at: v.recorded_at }];
      }),
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
      list = list.filter((p) => p.full_name_ar.toLowerCase().includes(q) || p.full_name_en.toLowerCase().includes(q) || p.file_number.toLowerCase().includes(q) || (p.national_id ?? '').includes(q) || (p.phone ?? '').includes(q));
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

  async getChart(patientId: string, _admissionId?: string): Promise<ChartData> {
    await delay(320);
    return buildChart(patientId);
  },

  async addVitals(input: NewVitalsInput): Promise<Vitals> {
    const u = requireUser();
    const entry = store.patients[Object.values(store.patients).find((x) => x.record?.admission.id === input.admissionId)?.patient.id ?? ''];
    const record = entry?.record;
    if (!record) throw new Error('not_found');
    const existing = input.clientId ? record.vitals.find((v) => v.id === input.clientId) : undefined;
    if (existing) return existing;
    const vit: Vitals = {
      id: input.clientId ?? uid(),
      admission_id: input.admissionId,
      recorded_at: input.recordedAt ?? new Date().toISOString(),
      pain_score: input.painScore ?? null,
      consciousness: input.consciousness ?? null,
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
    if (input.painScore !== undefined) found.pain_score = input.painScore ?? null;
    if (input.consciousness !== undefined) found.consciousness = input.consciousness ?? null;
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
      result: input.result || null,
      unit: input.unit ?? null,
      reference_range: input.referenceRange ?? null,
      status: input.result ? 'resulted' : 'ordered',
      resulted_by: input.result ? actorName(u) : null,
      resulted_at: input.result ? new Date().toISOString() : null,
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
      report: input.report || null,
      status: input.report ? 'resulted' : 'ordered',
      performed_by: input.report ? actorName(u) : null,
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
    record.admission.discharge_type = input.type;
    record.admission.discharge_summary = input.summary || null;
    record.admission.family_pin = null;
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

  async createBed(input: BedInput): Promise<Bed> {
    await delay(200);
    const ward = store.wards.find((w) => w.id === input.wardId);
    if (!ward) throw new Error('not_found');
    const bed: Bed = { id: uid(), ward_id: input.wardId, room: input.room, bed_no: input.bedNo, status: 'free', code: `bdemo${uid()}` };
    ward.beds.push(bed);
    return bed;
  },

  async updateBed(id: string, input: { room?: string; bedNo?: string }): Promise<Bed> {
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

  async uploadHospitalLogo(file: File): Promise<Hospital> {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
      r.readAsDataURL(file);
    });
    (store.hospital as Hospital).logo_url = url;
    store.users.forEach((u) => u.hospital_id === store.hospital.id && (u.hospital_logo_url = url));
    if (store.currentUser) store.currentUser.hospital_logo_url = url;
    return { ...store.hospital };
  },

  async removeHospitalLogo(): Promise<Hospital> {
    (store.hospital as Hospital).logo_url = null;
    store.users.forEach((u) => u.hospital_id === store.hospital.id && (u.hospital_logo_url = null));
    if (store.currentUser) store.currentUser.hospital_logo_url = null;
    return { ...store.hospital };
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

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const u = requireUser();
    const rec = store.users.find((x) => x.id === u.id);
    if (!rec || rec.password !== currentPassword) throw new Error('كلمة المرور الحالية غير صحيحة');
    rec.password = newPassword;
  },

  async resetUserPassword(userId: string, password: string): Promise<void> {
    const rec = store.users.find((x) => x.id === userId);
    if (!rec) throw new Error('not_found');
    rec.password = password;
  },

  async listUsers(): Promise<User[]> {
    await delay(250);
    return store.users.map(({ password: _pw, ...pub }) => {
      void _pw;
      return pub;
    });
  },

  async listHospitals(): Promise<HospitalListItem[]> {
    await delay(150);
    const active = Object.values(store.patients).filter((e) => e.record?.admission.status === 'active').length;
    const adminsOf = (hid: string): HospitalAdminInfo[] =>
      store.users.filter((u) => u.hospital_id === hid && u.role === 'admin').map((u) => ({ id: u.id, username: u.username, full_name_ar: u.full_name_ar, is_active: u.is_active }));
    return [
      { ...store.hospital, users_count: store.users.filter((u) => u.hospital_id === store.hospital.id).length, beds_count: store.wards.reduce((n, w) => n + w.beds.length, 0), pending_payments: 0,
      active_admissions: active, admins: adminsOf(store.hospital.id) },
      ...extraHospitals.map((h) => ({ ...h, users_count: store.users.filter((u) => u.hospital_id === h.id).length, beds_count: 0, pending_payments: 0,
      active_admissions: 0, admins: adminsOf(h.id) })),
    ];
  },

  async createHospital(input: CreateHospitalInput): Promise<Hospital> {
    await delay(200);
    const h: Hospital = { id: uid(), name_ar: input.nameAr, name_en: input.nameEn, code: (input.code || `H-${uid().slice(0, 6)}`).toUpperCase(), is_active: true, created_at: new Date().toISOString() };
    extraHospitals.push(h);
    return h;
  },

  async updateHospitalById(id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }): Promise<Hospital> {
    await delay(150);
    const h = id === store.hospital.id ? store.hospital : extraHospitals.find((x) => x.id === id);
    if (!h) throw new Error('not_found');
    if (input.nameAr !== undefined) h.name_ar = input.nameAr;
    if (input.nameEn !== undefined) h.name_en = input.nameEn;
    if (input.isActive !== undefined) h.is_active = input.isActive;
    return { ...h };
  },

  async addHospitalAdmin(hospitalId: string, input: HospitalAdminInput): Promise<HospitalAdminInfo> {
    await delay(200);
    const username = input.username.toLowerCase();
    if (store.users.some((u) => u.username === username)) throw new Error('اسم المستخدم مستخدم من قبل');
    const h = hospitalId === store.hospital.id ? store.hospital : extraHospitals.find((x) => x.id === hospitalId);
    if (!h) throw new Error('not_found');
    const created: User & { password: string } = {
      id: uid(),
      hospital_id: h.id,
      hospital_name_ar: h.name_ar,
      hospital_name_en: h.name_en,
      username,
      full_name_ar: input.fullNameAr,
      full_name_en: input.fullNameEn ?? '',
      email: input.email ?? null,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      password: input.password,
    };
    store.users.push(created);
    return { id: created.id, username, full_name_ar: created.full_name_ar, is_active: true };
  },

  async switchHospital(hospitalId: string): Promise<Hospital> {
    await delay(150);
    if (hospitalId !== store.hospital.id) throw new Error('التبديل بين المستشفيات غير متاح في وضع العرض التوضيحي');
    return { ...store.hospital };
  },

  async publicTrack(code: string): Promise<PublicTrackInfo> {
    await delay(250);
    return demoTrack(code).info;
  },

  async familyTrack(code: string, pin: string): Promise<PublicTrackFamily> {
    await delay(250);
    const { info, entry } = demoTrack(code);
    if (!entry?.record || entry.record.admission.family_pin !== pin) throw new Error('رمز العائلة غير صحيح');
    const r = entry.record;
    const adm = r.admission;
    const share = adm.family_share ?? { vitals: true };
    const shared = FAMILY_SHARE_CATEGORIES.filter((k) => share[k]) as FamilyShareCategory[];
    const on = (k: FamilyShareCategory) => shared.includes(k);
    const v = on('vitals') ? [...r.vitals].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1))[0] : undefined;
    return {
      ...info,
      patient: { full_name_ar: entry.patient.full_name_ar, full_name_en: entry.patient.full_name_en, gender: entry.patient.gender },
      attending_doctor: adm.attending_doctor,
      latest_vitals: v ? { recorded_at: v.recorded_at, temperature: v.temperature, pulse: v.pulse, bp_systolic: v.bp_systolic, bp_diastolic: v.bp_diastolic, spo2: v.spo2 } : null,
      shared,
      message: adm.family_message ? { text: adm.family_message, by: adm.family_message_by ?? null, at: adm.family_message_at ?? null } : null,
      ...(on('diagnosis') && { diagnoses: r.diagnoses.filter((d) => d.status !== 'suspected').map((d) => ({ title_ar: d.title_ar, title_en: d.title_en, status: d.status as 'confirmed' | 'resolved' })) }),
      ...(on('medications') && { medications: r.medications.filter((m) => m.status === 'active').map((m) => ({ name_ar: m.name_ar, name_en: m.name_en, dose: m.dose, route: m.route, frequency: m.frequency })) }),
      ...(on('labs') && {
        labs: r.labs.filter((l) => l.result && (l.status === 'resulted' || l.status === 'abnormal')).map((l) => ({ test_name_ar: l.test_name_ar, test_name_en: l.test_name_en, result: l.result!, unit: l.unit, reference_range: l.reference_range, abnormal: l.status === 'abnormal', resulted_at: l.resulted_at })),
      }),
      ...(on('radiology') && { radiology: r.radiology.filter((x) => x.report).map((x) => ({ study_type_ar: x.study_type_ar, study_type_en: x.study_type_en, report: x.report!, ordered_at: x.ordered_at })) }),
      ...(on('procedures') && { procedures: r.procedures.map((p) => ({ name_ar: p.name_ar, name_en: p.name_en, performed_at: p.performed_at })) }),
    };
  },

  async updateFamilyShare(admissionId: string, input: { share?: FamilyShare; message?: string | null }) {
    const u = requireUser();
    const record = findRecord(admissionId);
    const adm = record.admission;
    const next: FamilyShare = { ...(adm.family_share ?? { vitals: true }) };
    for (const k of FAMILY_SHARE_CATEGORIES) {
      const v = input.share?.[k];
      if (v === undefined || Boolean(next[k]) === v) continue;
      if (FAMILY_SHARE_DOCTOR_ONLY.includes(k) && !hasPermission(u.role, 'notes.write.doctor')) throw new Error('مشاركة المعلومات السريرية مع ذوي المريض قرار الطبيب المعالج');
      if (v) next[k] = true;
      else delete next[k];
    }
    adm.family_share = next;
    if (input.message !== undefined) {
      const text = input.message?.trim() || null;
      adm.family_message = text;
      adm.family_message_by = text ? actorName(u) : null;
      adm.family_message_at = text ? new Date().toISOString() : null;
    }
    pushTimeline(record, actorName(u), 'family', 'تحديث ما يُعرض لذوي المريض', 'Family view updated', new Date().toISOString());
    return { family_share: next, family_message: adm.family_message ?? null };
  },

  async admitPatient(input: AdmitInput): Promise<{ admission_id: string; family_pin: string }> {
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
      reason: input.reason ?? null,
      family_pin: demoPin(),
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
    return { admission_id: admission.id, family_pin: admission.family_pin! };
  },

  async regenerateFamilyPin(admissionId: string): Promise<{ family_pin: string }> {
    const record = findRecord(admissionId);
    if (record.admission.status !== 'active') throw new Error('التنويم غير نشط');
    record.admission.family_pin = demoPin();
    return { family_pin: record.admission.family_pin };
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
    found.status = input.abnormal ? 'abnormal' : 'resulted';
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

  async dispenseMedication(_admissionId: string, medicationId: string): Promise<Medication> {
    const u = requireUser();
    const found = Object.values(store.patients).map((e) => e.record?.medications.find((m) => m.id === medicationId)).find(Boolean);
    if (!found) throw new Error('not_found');
    if (found.dispensed_at) throw new Error('تم صرف هذا الدواء مسبقاً');
    found.dispensed_by = actorName(u);
    found.dispensed_at = new Date().toISOString();
    return found;
  },

  async administerMedication(admissionId: string, medicationId: string, input: AdministrationInput): Promise<MedicationAdministration> {
    const u = requireUser();
    const record = findRecord(admissionId);
    record.administrations ??= [];
    const existing = input.clientId ? record.administrations.find((x) => x.id === input.clientId) : undefined;
    if (existing) return existing;
    const med = record.medications.find((m) => m.id === medicationId);
    if (!med) throw new Error('not_found');
    if (med.status !== 'active') throw new Error('الدواء موقوف أو مكتمل — لا تُسجَّل له جرعات');
    const entry: MedicationAdministration = {
      id: input.clientId ?? uid(),
      medication_id: medicationId,
      admission_id: admissionId,
      status: input.status,
      note: input.note ?? null,
      administered_by: actorName(u),
      administered_by_id: u.id,
      administered_at: input.administeredAt ?? new Date().toISOString(),
    };
    record.administrations.unshift(entry);
    const titles = { given: ['إعطاء جرعة', 'Dose given'], held: ['تأجيل جرعة', 'Dose held'], refused: ['رفض المريض الجرعة', 'Dose refused'] }[input.status];
    pushTimeline(record, actorName(u), 'medication', `${titles[0]}: ${med.name_ar}`, `${titles[1]}: ${med.name_en ?? med.name_ar}`, entry.administered_at);
    return entry;
  },

  async deleteAdministration(admissionId: string, administrationId: string): Promise<void> {
    const record = findRecord(admissionId);
    record.administrations = (record.administrations ?? []).filter((x) => x.id !== administrationId);
  },

  async addFluid(input: FluidInput): Promise<FluidEntry> {
    const u = requireUser();
    const record = findRecord(input.admissionId);
    record.fluids ??= [];
    const existing = input.clientId ? record.fluids.find((x) => x.id === input.clientId) : undefined;
    if (existing) return existing;
    const entry: FluidEntry = {
      id: input.clientId ?? uid(),
      admission_id: input.admissionId,
      direction: input.direction,
      kind: input.kind,
      volume_ml: input.volumeMl,
      note: input.note ?? null,
      recorded_by: actorName(u),
      recorded_at: input.recordedAt ?? new Date().toISOString(),
    };
    record.fluids.unshift(entry);
    return entry;
  },

  async deleteFluid(admissionId: string, fluidId: string): Promise<void> {
    const record = findRecord(admissionId);
    record.fluids = (record.fluids ?? []).filter((x) => x.id !== fluidId);
  },

  // وضع العرض: التسجيل والدفع يعملان في النسخة الفعلية فقط
  async signup(): Promise<User> {
    throw new Error('تسجيل المستشفيات متاح في النسخة الفعلية فقط');
  },
  async publicPaymentInfo() {
    return { ...{ price: '', bank_name: '', account_name: '', account_number: '', phone: '', notes: '' }, trial_days: 14 };
  },
  async billing() {
    return { subscription: { status: 'unlimited' as const, ends_at: null, days_left: null }, payment_info: { price: '', bank_name: '', account_name: '', account_number: '', phone: '', notes: '' }, notices: [], can_submit: false };
  },
  async submitPaymentNotice(): Promise<never> {
    throw new Error('غير متاح في وضع العرض');
  },
  async listPaymentNotices() {
    return [];
  },
  async rejectPaymentNotice() {},
  async updateSubscription(): Promise<never> {
    throw new Error('غير متاح في وضع العرض');
  },
  async updatePaymentInfo(info) {
    return info;
  },

  // وضع العرض: الحذف فيه مؤقت في الذاكرة، فالسلة فارغة دائماً
  async listTrash() {
    const u = requireUser();
    return { items: [], canRestore: hasPermission(u.role, 'trash.manage') };
  },
  async requestRestore() {},
  async restoreTrash(): Promise<never> {
    throw new Error('غير متاح في وضع العرض');
  },

  labelZplUrl() {
    return null;
  },

  async listAudit(): Promise<AuditEntry[]> {
    await delay(150);
    return store.activity.slice(0, 50).map((a) => ({
      id: a.id,
      actor_id: null,
      actor_name: a.actor,
      action: a.type,
      resource_type: 'admission',
      resource_id: a.admission_id,
      meta_json: '{}',
      ip: null,
      created_at: a.created_at,
    }));
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

function demoTrack(code: string) {
  const ward = store.wards.find((w) => w.beds.some((b) => b.code === code));
  const bed = ward?.beds.find((b) => b.code === code);
  if (!ward || !bed) throw new Error('السرير غير موجود');
  const dept = store.departments.find((d) => d.id === ward.department_id);
  const entry = Object.values(store.patients).find(
    (e) => e.record?.admission.status === 'active' && e.record.admission.ward_id === ward.id && e.record.admission.bed_no === bed.bed_no,
  );
  const adm = entry?.record?.admission;
  const info: PublicTrackInfo = {
    hospital: { name_ar: store.hospital.name_ar, name_en: store.hospital.name_en },
    department: dept ? { name_ar: dept.name_ar, name_en: dept.name_en } : null,
    ward: { name_ar: ward.name_ar, name_en: ward.name_en },
    room: bed.room,
    bed_no: bed.bed_no,
    occupied: Boolean(adm),
    admission:
      adm && entry
        ? {
            admitted_at: adm.admitted_at,
            days: Math.max(0, Math.floor((Date.now() - Date.parse(adm.admitted_at)) / 86_400_000)),
            patient_initials: entry.patient.full_name_ar
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => `${p[0]}.`)
              .join(' '),
            last_update: entry.record?.timeline[0]?.created_at ?? null,
          }
        : null,
  };
  return { info, entry };
}

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