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
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
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
  getChart: (patientId) => request(`/patients/${patientId}/chart`),
  addVitals: (input) => request('/vitals', { method: 'POST', body: JSON.stringify(mapNewVitals(input)) }),
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
        category: input.category ?? null,
        result: input.result ?? '',
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
        report: input.report ?? '',
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
  wards: () => request('/wards'),
  listUsers: () => request('/users'),
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
  updateLabResult: (admissionId, labId, input) =>
    request(`/patients/${admissionId}/labs/${labId}`, {
      method: 'PATCH',
      body: JSON.stringify({ result: input.result, unit: input.unit ?? null, reference_range: input.referenceRange ?? null }),
    }),
  updateRadiology: (admissionId, radiologyId, input) =>
    request(`/patients/${admissionId}/radiology/${radiologyId}`, { method: 'PATCH', body: JSON.stringify({ report: input.report }) }),
  updateMedicationStatus: (admissionId, medicationId, input) =>
    request(`/patients/${admissionId}/medications/${medicationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: input.status, end_at: input.endAt ?? null }),
    }),
  updateNote: (admissionId, noteId, input) =>
    request(`/patients/${admissionId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ content: input.content }) }),
  respondConsultation: (admissionId, consultationId, input) =>
    request(`/patients/${admissionId}/consultations/${consultationId}`, { method: 'PATCH', body: JSON.stringify({ response: input.response }) }),
  deleteNote: (admissionId, noteId) => request(`/patients/${admissionId}/notes/${noteId}`, { method: 'DELETE' }),
  deleteDiagnosis: (admissionId, diagnosisId) => request(`/patients/${admissionId}/diagnoses/${diagnosisId}`, { method: 'DELETE' }),
  deleteMedication: (admissionId, medicationId) => request(`/patients/${admissionId}/medications/${medicationId}`, { method: 'DELETE' }),
  deleteLabResult: (admissionId, labId) => request(`/patients/${admissionId}/labs/${labId}`, { method: 'DELETE' }),
  deleteRadiology: (admissionId, radiologyId) => request(`/patients/${admissionId}/radiology/${radiologyId}`, { method: 'DELETE' }),
  deleteConsultation: (admissionId, consultationId) => request(`/patients/${admissionId}/consultations/${consultationId}`, { method: 'DELETE' }),
  deleteProcedure: (admissionId, procedureId) => request(`/patients/${admissionId}/procedures/${procedureId}`, { method: 'DELETE' }),
};

export { HttpError, csrfToken };