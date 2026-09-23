import { api } from '../src/app.js';

function cookies(setCookie: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of setCookie) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

function headerSetCookie(res: Response): string[] {
  const h = res.headers.getSetCookie();
  return h.length ? h : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
}

let sessionCookie = '';
let csrfToken = '';

async function main() {
  const base = 'http://localhost/api';

  const login = await api.request(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  });
  console.log('login', login.status);
  const jar = cookies(headerSetCookie(login));
  sessionCookie = `hmsi_session=${jar.hmsi_session}; hmsi_csrf=${jar.hmsi_csrf}`;
  csrfToken = jar.hmsi_csrf ?? '';

  const me = await api.request(`${base}/auth/me`, { headers: { cookie: sessionCookie } });
  console.log('me', me.status, await me.text());

  const patients = await api.request(`${base}/patients`, { headers: { cookie: sessionCookie } });
  const patientsBody = await patients.json();
  console.log('patients', patients.status, 'count=', Array.isArray(patientsBody) ? patientsBody.length : JSON.stringify(patientsBody).slice(0, 80));

  const wards = await api.request(`${base}/wards`, { headers: { cookie: sessionCookie } });
  console.log('wards', wards.status, JSON.stringify(await wards.json()).slice(0, 160));

  const vitals = await api.request(`${base}/vitals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ admission_id: 'adm1', temperature: 36.8, pulse: 80, respiratory_rate: 16, bp_systolic: 120, bp_diastolic: 80, spo2: 98, weight: 80, glucose: null }),
  });
  console.log('vitals', vitals.status, (await vitals.text()).slice(0, 200));

  const chart = await api.request(`${base}/patients/p1/chart`, { headers: { cookie: sessionCookie } });
  const chartJson = (await chart.json()) as { vitals?: unknown[]; notes?: unknown[] };
  console.log('chart', chart.status, 'vitals=', chartJson.vitals?.length, 'notes=', chartJson.notes?.length);

  const dash = await api.request(`${base}/dashboard/stats`, { headers: { cookie: sessionCookie } });
  console.log('dashboard', dash.status, (await dash.text()).slice(0, 200));

  const users = await api.request(`${base}/users`, { headers: { cookie: sessionCookie } });
  const usersBody = (await users.json()) as unknown[];
  console.log('users(admin)', users.status, 'count=', Array.isArray(usersBody) ? usersBody.length : JSON.stringify(usersBody).slice(0, 80));

  const viewerLogin = await api.request(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'viewer', password: 'password123' }),
  });
  const vj = cookies(headerSetCookie(viewerLogin));
  const viewerCookie = `hmsi_session=${vj.hmsi_session}; hmsi_csrf=${vj.hmsi_csrf}`;
  const usersForbidden = await api.request(`${base}/users`, { headers: { cookie: viewerCookie } });
  console.log('users(viewer should 403)', usersForbidden.status);

  const bad = await api.request(`${base}/patients`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: sessionCookie, 'x-csrf-token': csrfToken }, body: JSON.stringify({}) });
  console.log('create-empty-patient', bad.status);

  // —— دخول كطبيب (ازمة إنشاء ملاحظة + ديسشارج كست صفر) ——
  const docLogin = await api.request(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'doctor', password: 'password123' }),
  });
  const dj = cookies(headerSetCookie(docLogin));
  const docCookie = `hmsi_session=${dj.hmsi_session}; hmsi_csrf=${dj.hmsi_csrf}`;
  const docCsrf = dj.hmsi_csrf ?? '';

  const note = await api.request(`${base}/patients/adm2/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: docCookie, 'x-csrf-token': docCsrf },
    body: JSON.stringify({ admission_id: 'adm2', kind: 'doctor', content: 'ملاحظة تجريبية من الطبيب' }),
  });
  console.log('doctor-create-note', note.status, (await note.text()).slice(0, 120));

  const docDischarge = await api.request(`${base}/admissions/adm2/discharge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: docCookie, 'x-csrf-token': docCsrf },
    body: JSON.stringify({ discharge_type: 'home' }),
  });
  console.log('doctor-discharge-(should 403)', docDischarge.status);

  // —— دخول كممرضة: vitals مسموح — discharge ممنوع ——
  const nsLogin = await api.request(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'nurse', password: 'password123' }),
  });
  const nj = cookies(headerSetCookie(nsLogin));
  const nsCookie = `hmsi_session=${nj.hmsi_session}; hmsi_csrf=${nj.hmsi_csrf}`;
  const nsCsrf = nj.hmsi_csrf ?? '';

  const nsVitals = await api.request(`${base}/vitals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: nsCookie, 'x-csrf-token': nsCsrf },
    body: JSON.stringify({ admission_id: 'adm3', temperature: 37, pulse: 78, respiratory_rate: 17, bp_systolic: 125, bp_diastolic: 82, spo2: 97 }),
  });
  console.log('nurse-vitals', nsVitals.status);

  const nsDischarge = await api.request(`${base}/admissions/adm3/discharge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: nsCookie, 'x-csrf-token': nsCsrf },
    body: JSON.stringify({ discharge_type: 'home' }),
  });
  console.log('nurse-discharge-(should 403)', nsDischarge.status);

  // —— admin discharge adm1 ——
  const admDischarge = await api.request(`${base}/admissions/adm1/discharge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ discharge_type: 'home', summary: 'تحسن المريض' }),
  });
  console.log('admin-discharge', admDischarge.status);

  const chart2 = await api.request(`${base}/patients/p1/chart`, { headers: { cookie: sessionCookie } });
  const cj = (await chart2.json()) as { patient?: { admission?: { status?: string } | null }; timeline?: unknown[] };
  console.log('chart-after-discharge', chart2.status, 'status=', cj.patient?.admission?.status, 'timeline=', cj.timeline?.length);

  // —— الفجوات: users / records CRUD / attachments / admit-transfer / reports ——
  const post = (path: string, body: unknown) =>
    api.request(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: sessionCookie, 'x-csrf-token': csrfToken }, body: JSON.stringify(body) });
  const patch = (path: string, body: unknown) =>
    api.request(`${base}${path}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: sessionCookie, 'x-csrf-token': csrfToken }, body: JSON.stringify(body) });
  const del = (path: string) => api.request(`${base}${path}`, { method: 'DELETE', headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken } });
  const get = (path: string) => api.request(`${base}${path}`, { headers: { cookie: sessionCookie } });

  const newUser = await post('/users', { username: 'smoke_user', password: 'password123', full_name_ar: 'مستخدم تجريبي', role: 'nurse' });
  const newUserBody = (await newUser.json()) as { id: string };
  console.log('create-user', newUser.status, newUserBody.id);
  const updUser = await patch(`/users/${newUserBody.id}`, { full_name_ar: 'مستخدم معدّل', is_active: false });
  const updUserBody = (await updUser.json()) as { full_name_ar: string; is_active: boolean };
  console.log('update-user', updUser.status, updUserBody.full_name_ar, 'active=', updUserBody.is_active);

  const labAdd = await post('/patients/adm2/labs', { admission_id: 'adm2', test_name_ar: 'صوديوم الدم', result: '', unit: null, reference_range: '135-145' });
  const labBody = (await labAdd.json()) as { id: string };
  console.log('add-lab', labAdd.status);
  const labPatch = await patch(`/patients/adm2/labs/${labBody.id}`, { result: '138', unit: 'مليمول/ل', reference_range: '135-145' });
  const labPatchBody = (await labPatch.json()) as { status?: string; result?: string };
  console.log('patch-lab', labPatch.status, labPatchBody.status, labPatchBody.result);
  console.log('delete-lab', (await del(`/patients/adm2/labs/${labBody.id}`)).status);

  const radAdd = await post('/patients/adm2/radiology', { admission_id: 'adm2', study_type_ar: 'أشعة صدر', report: '' });
  const radBody = (await radAdd.json()) as { id: string };
  const radPatch = await patch(`/patients/adm2/radiology/${radBody.id}`, { report: 'قلب طبيعي دون تكثف' });
  const radPatchBody = (await radPatch.json()) as { report?: string };
  console.log('add/patch-radiology', radAdd.status, radPatch.status, radPatchBody.report);
  console.log('delete-radiology', (await del(`/patients/adm2/radiology/${radBody.id}`)).status);

  const medAdd = await post('/patients/adm2/medications', { admission_id: 'adm2', name_ar: 'باراسيتامول', dose: '500 مغ', route: 'PO', frequency: 'كل 8 ساعات', start_at: '2026-09-23' });
  const medBody = (await medAdd.json()) as { id: string };
  const medPatch = await patch(`/patients/adm2/medications/${medBody.id}`, { status: 'completed', end_at: '2026-09-23' });
  const medPatchBody = (await medPatch.json()) as { status?: string };
  console.log('add/patch-medication', medAdd.status, medPatch.status, medPatchBody.status);
  console.log('delete-medication', (await del(`/patients/adm2/medications/${medBody.id}`)).status);

  const diag = await post('/patients/adm2/diagnoses', { admission_id: 'adm2', title_ar: 'ارتفاع ضغط', icd10: 'I10' });
  const diagBody = (await diag.json()) as { id: string };
  console.log('add/delete-diagnosis', diag.status, (await del(`/patients/adm2/diagnoses/${diagBody.id}`)).status);

  const proc = await post('/patients/adm2/procedures', { admission_id: 'adm2', name_ar: 'قسطرة وريدية', notes: null });
  const procBody = (await proc.json()) as { id: string };
  console.log('add/delete-procedure', proc.status, (await del(`/patients/adm2/procedures/${procBody.id}`)).status);

  const cons = await post('/patients/adm2/consultations', { admission_id: 'adm2', specialty: 'طب القلب', reason: 'يشتكي ألم صدر' });
  const consBody = (await cons.json()) as { id: string };
  const consResp = await patch(`/patients/adm2/consultations/${consBody.id}`, { response: 'لا توجد موانع' });
  const consRespBody = (await consResp.json()) as { response?: string };
  console.log('add/respond-consultation', cons.status, consResp.status, consRespBody.response);
  console.log('delete-consultation', (await del(`/patients/adm2/consultations/${consBody.id}`)).status);

  const fd = new FormData();
  fd.append('file', new File(['محتوى تجريبي للملف'], 'smoke.txt', { type: 'text/plain' }));
  const upAtt = await api.request(`${base}/patients/adm2/attachments`, { method: 'POST', headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken }, body: fd });
  const attBody = (await upAtt.json()) as { id: string; size: number };
  console.log('upload-attachment', upAtt.status, 'size=', attBody.size);
  const dlAtt = await get(`/patients/adm2/attachments/${attBody.id}`);
  console.log('download-attachment', dlAtt.status, dlAtt.headers.get('content-type'));
  console.log('delete-attachment', (await del(`/patients/adm2/attachments/${attBody.id}`)).status);

  const wardsBody = (await (await get('/wards')).json()) as { department_id: string; beds: { id: string; status: string }[] }[];
  const freeBeds = wardsBody.flatMap((w) => w.beds.filter((b) => b.status === 'free').map((b) => ({ bedId: b.id, deptId: w.department_id })));
  if (freeBeds.length > 0) {
    const admit = await post('/admissions', { patient_id: 'p1', bed_id: freeBeds[0].bedId, department_id: freeBeds[0].deptId, reason: 'متابعة بعد الخروج' });
    const admBody = (await admit.json()) as { admission_id: string };
    console.log('admit', admit.status, admBody.admission_id);
    const trans = await post(`/admissions/${admBody.admission_id}/transfer`, { bed_id: freeBeds[1]?.bedId ?? freeBeds[0].bedId });
    console.log('transfer', trans.status);
  } else {
    console.log('admit: لا يوجد سرير شاغر');
  }

  const rep = await get('/reports/overview?from=2026-09-01&to=2026-09-23');
  const repBody = (await rep.json()) as { totalAdmissions: number; totalDischarges: number };
  console.log('reports-overview', rep.status, 'admissions=', repBody.totalAdmissions, 'discharges=', repBody.totalDischarges);

  // —— نقطة seed المحمية (SEED_TOKEN) ——
  const seedWrong = await api.request(`${base}/__staff/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-staff-token': 'wrong' },
    body: '{}',
  });
  console.log('staff-seed-wrong-token (should 404)', seedWrong.status);

  const seedOk = await api.request(`${base}/__staff/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-staff-token': process.env.SEED_TOKEN ?? '' },
    body: '{}',
  });
  console.log('staff-seed-with-token', seedOk.status, (await seedOk.text()).slice(0, 120));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});