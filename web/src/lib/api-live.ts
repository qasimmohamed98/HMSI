import type { Api, NewVitalsInput } from './api';

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)hmsi_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const tok = csrfToken();
    if (tok) headers['X-CSRF-Token'] = tok;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new HttpError(0, 'تعذّر الاتصال بالخادم — تحقق من الشبكة');
  }
  if (res.status === 401 && !path.startsWith('/auth/') && !path.startsWith('/public/')) {
    // انتهت الجلسة: أبلغ AuthProvider لإعادة التوجيه لصفحة الدخول
    window.dispatchEvent(new Event('hmsi:unauthorized'));
  }
  if (!res.ok) {
    let message = 'حدث خطأ';
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch {
      /* ignore */
    }
    throw new HttpError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function mapNewVitals(v: NewVitalsInput) {
  return {
    admission_id: v.admissionId,
    temperature: v.temperature,
    pulse: v.pulse,
    respiratory_rate: v.respiratoryRate,
    bp_systolic: v.bpSystolic,
    bp_diastolic: v.bpDiastolic,
    spo2: v.spo2,
    weight: v.weight,
    glucose: v.glucose,
    pain_score: v.painScore ?? null,
    consciousness: v.consciousness ?? null,
    client_id: v.clientId,
    recorded_at: v.recordedAt,
  };
}

export const liveApi: Api = {
  mode: 'live',

  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  dashboard: () => request('/dashboard/stats'),
  listPatients: (params) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.admitted) qs.set('admitted', '1');
    return request(`/patients${qs.toString() ? `?${qs}` : ''}`);
  },
  createPatient: (input) =>
    request('/patients', {
      method: 'POST',
      body: JSON.stringify({
        full_name_ar: input.fullNameAr,
        full_name_en: input.fullNameEn,
        gender: input.gender,
        birth_date: input.birthDate,
        phone: input.phone,
        national_id: input.nationalId,
        blood_type: input.bloodType,
        allergies: input.allergies,
        critical_alerts: input.criticalAlerts,
      }),
    }),
  updatePatient: (id, input) =>
    request(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        full_name_ar: input.fullNameAr,
        full_name_en: input.fullNameEn,
        gender: input.gender,
        birth_date: input.birthDate,
        phone: input.phone,
        national_id: input.nationalId,
        blood_type: input.bloodType,
        allergies: input.allergies,
        critical_alerts: input.criticalAlerts,
      }),
    }),
  deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),
  admitPatient: (input) =>
    request('/admissions', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: input.patientId,
        bed_id: input.bedId,
        department_id: input.departmentId,
        attending_doctor_id: input.attendingDoctorId ?? null,
        reason: input.reason,
      }),
    }),
  transferPatient: (input) =>
    request(`/admissions/${input.admissionId}/transfer`, { method: 'POST', body: JSON.stringify({ bed_id: input.bedId }) }),
  regenerateFamilyPin: (admissionId) => request(`/admissions/${admissionId}/family-pin`, { method: 'POST' }),
  updateFamilyShare: (admissionId, input) => request(`/admissions/${admissionId}/family-share`, { method: 'PATCH', body: JSON.stringify(input) }),
  wards: () => request('/wards'),
  listDepartments: () => request('/org/departments'),
  createDepartment: (input) =>
    request('/org/departments', { method: 'POST', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn ?? null }) }),
  updateDepartment: (id, input) =>
    request(`/org/departments/${id}`, { method: 'PATCH', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn ?? null }) }),
  deleteDepartment: (id) => request(`/org/departments/${id}`, { method: 'DELETE' }),
  createWard: (input) =>
    request('/org/wards', { method: 'POST', body: JSON.stringify({ department_id: input.departmentId, name_ar: input.nameAr, name_en: input.nameEn ?? null, ward_type: input.wardType }) }),
  updateWard: (id, input) =>
    request(`/org/wards/${id}`, { method: 'PATCH', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn ?? null, ward_type: input.wardType }) }),
  deleteWard: (id) => request(`/org/wards/${id}`, { method: 'DELETE' }),
  createBed: (input) => request('/org/beds', { method: 'POST', body: JSON.stringify({ ward_id: input.wardId, room: input.room, bed_no: input.bedNo }) }),
  updateBed: (id, input) => request(`/org/beds/${id}`, { method: 'PATCH', body: JSON.stringify({ room: input.room, bed_no: input.bedNo }) }),
  deleteBed: (id) => request(`/org/beds/${id}`, { method: 'DELETE' }),
  listUnassigned: () => request('/org/unassigned'),
  assignBed: (bedId, admissionId) => request(`/org/beds/${bedId}/assign`, { method: 'POST', body: JSON.stringify({ admission_id: admissionId }) }),
  freeBed: (bedId) => request(`/org/beds/${bedId}/free`, { method: 'POST' }),
  bedOccupant: async (bedId) => (await request<{ occupant: { admission_id: string; patient_id: string; patient_name_ar: string } | null }>(`/org/beds/${bedId}/occupant`)).occupant,
  hospitalProfile: () => request('/hospitals/me'),
  updateHospital: (input) =>
    request('/hospitals/me', { method: 'PATCH', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn }) }),
  listUsers: () => request('/users'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
  resetUserPassword: (userId, password) => request(`/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  getChart: (patientId, admissionId) =>
    request(`/patients/${patientId}/chart${admissionId ? `?admission=${encodeURIComponent(admissionId)}` : ''}`),
  addVitals: (input) => request('/vitals', { method: 'POST', body: JSON.stringify(mapNewVitals(input)) }),
  updateVitals: (vitalsId, input) =>
    request(`/vitals/${vitalsId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        temperature: input.temperature,
        pulse: input.pulse,
        respiratory_rate: input.respiratoryRate,
        bp_systolic: input.bpSystolic,
        bp_diastolic: input.bpDiastolic,
        spo2: input.spo2,
        weight: input.weight,
        glucose: input.glucose,
        pain_score: input.painScore,
        consciousness: input.consciousness,
      }),
    }),
  deleteVitals: (vitalsId) => request(`/vitals/${vitalsId}`, { method: 'DELETE' }),
  addNote: (input) =>
    request(`/patients/${input.admissionId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ admission_id: input.admissionId, kind: input.kind, content: input.content }),
    }),
  addDiagnosis: (input) =>
    request(`/patients/${input.admissionId}/diagnoses`, {
      method: 'POST',
      body: JSON.stringify({
        admission_id: input.admissionId,
        icd10: input.icd10 ?? null,
        title_ar: input.titleAr,
        title_en: input.titleEn ?? null,
        status: input.status,
      }),
    }),
  updateDiagnosis: (admissionId, diagnosisId, input) =>
    request(`/patients/${admissionId}/diagnoses/${diagnosisId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        icd10: input.icd10,
        title_ar: input.titleAr,
        title_en: input.titleEn,
        status: input.status,
      }),
    }),
  addMedication: (input) =>
    request(`/patients/${input.admissionId}/medications`, {
      method: 'POST',
      body: JSON.stringify({
        admission_id: input.admissionId,
        name_ar: input.nameAr,
        name_en: input.nameEn ?? null,
        dose: input.dose,
        route: input.route,
        frequency: input.frequency,
        start_at: input.startAt,
        end_at: input.endAt ?? null,
      }),
    }),
  addLabResult: (input) =>
    request(`/patients/${input.admissionId}/labs`, {
      method: 'POST',
      body: JSON.stringify({
        admission_id: input.admissionId,
        test_name_ar: input.testNameAr,
        test_name_en: input.testNameEn ?? null,
        category: input.category || null,
        result: input.result || null,
        unit: input.unit ?? null,
        reference_range: input.referenceRange ?? null,
      }),
    }),
  addRadiology: (input) =>
    request(`/patients/${input.admissionId}/radiology`, {
      method: 'POST',
      body: JSON.stringify({
        admission_id: input.admissionId,
        study_type_ar: input.studyTypeAr,
        study_type_en: input.studyTypeEn ?? null,
        report: input.report || null,
      }),
    }),
  addConsultation: (input) =>
    request(`/patients/${input.admissionId}/consultations`, {
      method: 'POST',
      body: JSON.stringify({ admission_id: input.admissionId, specialty: input.specialty, reason: input.reason }),
    }),
  addProcedure: (input) =>
    request(`/patients/${input.admissionId}/procedures`, {
      method: 'POST',
      body: JSON.stringify({ admission_id: input.admissionId, name_ar: input.nameAr, name_en: input.nameEn ?? null, notes: input.notes ?? null }),
    }),
  discharge: (input) =>
    request(`/admissions/${input.admissionId}/discharge`, { method: 'POST', body: JSON.stringify({ discharge_type: input.type, summary: input.summary }) }),
  createUser: (input) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: input.username,
        password: input.password,
        full_name_ar: input.fullNameAr,
        full_name_en: input.fullNameEn,
        email: input.email ?? null,
        role: input.role,
      }),
    }),
  updateUser: (id, input) =>
    request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        full_name_ar: input.fullNameAr,
        full_name_en: input.fullNameEn,
        email: input.email,
        role: input.role,
        is_active: input.isActive,
      }),
    }),
  listDoctors: () => request('/doctors'),
  uploadHospitalLogo: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/hospitals/me/logo', { method: 'POST', body: form });
  },
  removeHospitalLogo: () => request('/hospitals/me/logo', { method: 'DELETE' }),
  uploadAttachment: (admissionId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/patients/${admissionId}/attachments`, { method: 'POST', body: form });
  },
  deleteAttachment: (admissionId, attachmentId) => request(`/patients/${admissionId}/attachments/${attachmentId}`, { method: 'DELETE' }),
  attachmentUrl: (admissionId, attachmentId) => `${BASE}/patients/${admissionId}/attachments/${attachmentId}`,
  reportsOverview: (from, to) => {
    const qs = new URLSearchParams({ from, to });
    return request(`/reports/overview?${qs}`);
  },
  listHospitals: () => request('/hospitals'),
  createHospital: (input) =>
    request('/hospitals', { method: 'POST', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn, code: input.code || undefined }) }),
  updateHospitalById: (id, input) =>
    request(`/hospitals/${id}`, { method: 'PATCH', body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn, is_active: input.isActive }) }),
  addHospitalAdmin: (hospitalId, input) =>
    request(`/hospitals/${hospitalId}/admins`, {
      method: 'POST',
      body: JSON.stringify({ username: input.username, password: input.password, full_name_ar: input.fullNameAr, full_name_en: input.fullNameEn || undefined, email: input.email || null }),
    }),
  switchHospital: (hospitalId) => request(`/hospitals/${hospitalId}/switch`, { method: 'POST' }),
  publicTrack: (code) => request(`/public/track/${encodeURIComponent(code)}`),
  familyTrack: (code, pin) => request(`/public/track/${encodeURIComponent(code)}/family`, { method: 'POST', body: JSON.stringify({ pin }) }),

  updateLabResult: (admissionId, labId, input) =>
    request(`/patients/${admissionId}/labs/${labId}`, {
      method: 'PATCH',
      body: JSON.stringify({ result: input.result, unit: input.unit ?? null, reference_range: input.referenceRange ?? null, abnormal: input.abnormal }),
    }),
  updateRadiology: (admissionId, radiologyId, input) =>
    request(`/patients/${admissionId}/radiology/${radiologyId}`, { method: 'PATCH', body: JSON.stringify({ report: input.report }) }),
  updateMedication: (admissionId, medicationId, input) =>
    request(`/patients/${admissionId}/medications/${medicationId}`, {
      method: 'PATCH',
      // الحقول غير المعرّفة لا تُرسل (لا تُمسح)؛ null صريح = مسح القيمة
      body: JSON.stringify({
        status: input.status,
        end_at: input.endAt,
        name_ar: input.nameAr,
        name_en: input.nameEn,
        dose: input.dose,
        route: input.route,
        frequency: input.frequency,
        start_at: input.startAt,
      }),
    }),
  updateNote: (admissionId, noteId, input) =>
    request(`/patients/${admissionId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ content: input.content }) }),
  updateConsultation: (admissionId, consultationId, input) =>
    request(`/patients/${admissionId}/consultations/${consultationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ specialty: input.specialty, reason: input.reason, response: input.response }),
    }),
  updateProcedure: (admissionId, procedureId, input) =>
    request(`/patients/${admissionId}/procedures/${procedureId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name_ar: input.nameAr, name_en: input.nameEn, notes: input.notes }),
    }),
  deleteNote: (admissionId, noteId) => request(`/patients/${admissionId}/notes/${noteId}`, { method: 'DELETE' }),
  deleteDiagnosis: (admissionId, diagnosisId) => request(`/patients/${admissionId}/diagnoses/${diagnosisId}`, { method: 'DELETE' }),
  deleteMedication: (admissionId, medicationId) => request(`/patients/${admissionId}/medications/${medicationId}`, { method: 'DELETE' }),
  dispenseMedication: (admissionId, medicationId) => request(`/patients/${admissionId}/medications/${medicationId}/dispense`, { method: 'POST' }),
  administerMedication: (admissionId, medicationId, input) =>
    request(`/patients/${admissionId}/medications/${medicationId}/administrations`, {
      method: 'POST',
      body: JSON.stringify({ status: input.status, note: input.note ?? null, client_id: input.clientId, administered_at: input.administeredAt }),
    }),
  deleteAdministration: (admissionId, administrationId) => request(`/patients/${admissionId}/administrations/${administrationId}`, { method: 'DELETE' }),
  addFluid: (input) =>
    request(`/patients/${input.admissionId}/fluids`, {
      method: 'POST',
      body: JSON.stringify({
        admission_id: input.admissionId,
        direction: input.direction,
        kind: input.kind,
        volume_ml: input.volumeMl,
        note: input.note ?? null,
        client_id: input.clientId,
        recorded_at: input.recordedAt,
      }),
    }),
  deleteFluid: (admissionId, fluidId) => request(`/patients/${admissionId}/fluids/${fluidId}`, { method: 'DELETE' }),
  listTrash: (restored) => request(`/trash${restored ? '?restored=1' : ''}`),
  requestRestore: (trashId, note) => request(`/trash/${trashId}/request`, { method: 'POST', body: JSON.stringify({ note }) }),
  restoreTrash: (trashId) => request(`/trash/${trashId}/restore`, { method: 'POST' }),
  labelZplUrl: (admissionId, kind) =>
    kind === 'wristband' ? `${BASE}/patients/${admissionId}/labels/wristband` : `${BASE}/patients/${admissionId}/labs/${kind.labId}/label`,
  listAudit: (params) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.action) qs.set('action', params.action);
    return request(`/audit${qs.toString() ? `?${qs}` : ''}`);
  },
  deleteLabResult: (admissionId, labId) => request(`/patients/${admissionId}/labs/${labId}`, { method: 'DELETE' }),
  deleteRadiology: (admissionId, radiologyId) => request(`/patients/${admissionId}/radiology/${radiologyId}`, { method: 'DELETE' }),
  deleteConsultation: (admissionId, consultationId) => request(`/patients/${admissionId}/consultations/${consultationId}`, { method: 'DELETE' }),
  deleteProcedure: (admissionId, procedureId) => request(`/patients/${admissionId}/procedures/${procedureId}`, { method: 'DELETE' }),
};

export { HttpError, csrfToken };