/**
 * اختبار e2e شامل للـ API (داخل العملية، بدون خادم).
 * ⚠ يمسح القاعدة ويزرعها — يعمل فقط على قاعدة محلية:
 *   npm run test:smoke -w @hmsi/api
 */
export {};

if (process.env.TURSO_URL) {
  console.error('smoke test refuses to run against TURSO_URL (it wipes the database)');
  process.exit(1);
}
process.env.LOCAL_DB_URL ??= 'file:smoke.db';

const { api } = await import('../src/app.js');
const { runMigrations } = await import('../src/seed/migrate.js');
const { runSeed } = await import('../src/seed/run.js');

await runMigrations();
await runSeed();

const BASE = 'http://localhost/api';
let failures = 0;
let passed = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? '');
  }
}

interface Sess {
  cookie: string;
  csrf: string;
}

async function login(username: string, password = 'HmsiDemo2026'): Promise<Sess> {
  const res = await api.request(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${username.length}` },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status} ${await res.text()}`);
  const jar: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return { cookie: `hmsi_session=${jar.hmsi_session}; hmsi_csrf=${jar.hmsi_csrf}`, csrf: decodeURIComponent(jar.hmsi_csrf) };
}

function client(s: Sess | null) {
  const headers = (json: boolean): Record<string, string> => ({
    ...(json ? { 'content-type': 'application/json' } : {}),
    ...(s ? { cookie: s.cookie, 'x-csrf-token': s.csrf } : {}),
  });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await api.request(`${BASE}${path}`, { method, headers: headers(body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  };
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b: unknown = {}) => call('POST', p, b),
    patch: (p: string, b: unknown) => call('PATCH', p, b),
    put: (p: string, b: unknown) => call('PUT', p, b),
    del: (p: string) => call('DELETE', p),
  };
}

console.log('\n— المصادقة والجلسات');
const anon = client(null);
check('me بدون جلسة = null', (await anon.get('/auth/me')).json === null);
check('كلمة مرور خاطئة = 401', (await anon.post('/auth/login', { username: 'doctor', password: 'wrong-password' })).status === 401);
const superA = client(await login('admin'));
const manager = client(await login('manager'));
const doctor = client(await login('doctor'));
const nurse = client(await login('nurse'));
const lab = client(await login('lab'));
const reception = client(await login('reception'));
const viewer = client(await login('viewer'));
const admin2 = client(await login('admin2'));
// الطبيب يرى مرضاه فقط: نضيفه لفريق رعاية مريض adm2 (طبيبه المعالج doctor2) كما يفعل الاستقبال أو الإدارة
await client(await login('manager')).post('/care-team/admissions/adm2', { user_id: 'u_doctor', role: 'doctor', specialty: 'باطنية' });
check('اسم المستخدم غير حساس لحالة الأحرف', (await login('DOCTOR').then(() => true).catch(() => false)));

console.log('\n— CSRF');
{
  const s = await login('doctor');
  const res = await api.request(`${BASE}/vitals`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: s.cookie }, body: '{}' });
  check('طلب كتابة بدون X-CSRF-Token = 403', res.status === 403);
}

console.log('\n— الصلاحيات');
check('viewer لا يرى المستخدمين (403)', (await viewer.get('/users')).status === 403);
check('manager يرى المستخدمين', (await manager.get('/users')).status === 200);
check('مدير النظام يملك الصلاحيات السريرية (201)', (await superA.post('/patients/adm2/notes', { admission_id: 'adm2', kind: 'doctor', content: 'ملاحظة المدير' })).status === 201);
check('مدير المستشفى يشارك التحاليل مع العائلة', (await manager.patch('/admissions/adm2/family-share', { share: { labs: true } })).status === 200);
check('مدير المستشفى لا يدير المستشفيات (403)', (await manager.post('/hospitals', { name_ar: 'مستشفى س', name_en: 'Hospital X' })).status === 403);
check('ممرض يكتب ملاحظة تمريض (201)', (await nurse.post('/patients/adm2/notes', { admission_id: 'adm2', kind: 'nursing', content: 'المريضة مستقرة' })).status === 201);
check('ممرض لا يكتب ملاحظة طبية (403)', (await nurse.post('/patients/adm2/notes', { admission_id: 'adm2', kind: 'doctor', content: 'test note' })).status === 403);
const docNote = await doctor.post('/patients/adm2/notes', { admission_id: 'adm2', kind: 'doctor', content: 'ملاحظة الطبيب' });
check('طبيب يكتب ملاحظة طبية (201)', docNote.status === 201);
check('ممرض لا يعدّل ملاحظة الطبيب (403)', (await nurse.patch(`/patients/adm2/notes/${docNote.json.id}`, { content: 'تعديل' })).status === 403);
check('الطبيب يعدّل ملاحظته (200)', (await doctor.patch(`/patients/adm2/notes/${docNote.json.id}`, { content: 'ملاحظة معدّلة' })).status === 200);
check('ممرض لا يعتمد الخروج (403)', (await nurse.post('/admissions/adm3/discharge', { discharge_type: 'home' })).status === 403);
check('manager لا يعدّل حساب المدير العام (403)', (await manager.patch('/users/u_admin', { is_active: false })).status === 403);
check('لا يمكن تغيير دورك بنفسك (400)', (await manager.patch('/users/u_manager', { role: 'doctor' })).status === 400);

console.log('\n— عزل المستشفيات');
check('مدير مستشفى آخر لا يرى ملف مريض (404)', (await admin2.get('/patients/p1/chart')).status === 404);
check('مدير مستشفى آخر لا يرى قائمة مرضى مستشفى 1', ((await admin2.get('/patients')).json as unknown[]).length === 0);
check('مدير مستشفى آخر لا يصدر رمز عائلة لتنويم خارجي (404)', (await admin2.post('/admissions/adm1/family-pin')).status === 404);
check('مدير مستشفى آخر لا يحذف مرفقات تنويم خارجي (404)', (await admin2.del('/patients/adm1/attachments/x')).status === 404);
check('مدير مستشفى آخر لا ينقل مريضاً خارجياً (409/404)', [404, 409].includes((await admin2.post('/admissions/adm1/transfer', { bed_id: 'bed-17' })).status));

console.log('\n— المختبر والأشعة');
const order = await doctor.post('/patients/adm2/labs', { admission_id: 'adm2', test_name_ar: 'صوديوم الدم', category: null });
check('الطبيب يطلب فحصاً (201, ordered)', order.status === 201 && order.json.status === 'ordered', order.json);
check('الطبيب لا يدخل نتيجة (403)', (await doctor.patch(`/patients/adm2/labs/${order.json.id}`, { result: '138' })).status === 403);
const res1 = await lab.patch(`/patients/adm2/labs/${order.json.id}`, { result: '128', unit: 'mmol/L', reference_range: '135-145', abnormal: true });
check('فني المختبر يدخل النتيجة (abnormal)', res1.status === 200 && res1.json.status === 'abnormal', res1.json);
check('الطبيب لا يحذف فحصاً صدرت نتيجته (409)', (await doctor.del(`/patients/adm2/labs/${order.json.id}`)).status === 409);
const rad = await doctor.post('/patients/adm2/radiology', { admission_id: 'adm2', study_type_ar: 'أشعة صدر' });
check('الطبيب يطلب أشعة (201, ordered)', rad.status === 201 && rad.json.status === 'ordered');
check('فني الأشعة يكتب التقرير', (await client(await login('radiology')).patch(`/patients/adm2/radiology/${rad.json.id}`, { report: 'طبيعي' })).status === 200);

console.log('\n— الأدوية');
const med = await doctor.post('/patients/adm2/medications', { admission_id: 'adm2', name_ar: 'باراسيتامول', name_en: 'Paracetamol', dose: '500mg', route: 'PO', frequency: 'q8h', start_at: '2026-09-23' });
check('إضافة دواء', med.status === 201);
const medUpd = await doctor.patch(`/patients/adm2/medications/${med.json.id}`, { status: 'completed', end_at: '2026-09-24' });
check('تغيير الحالة لا يمسح الاسم الإنجليزي', medUpd.status === 200 && medUpd.json.name_en === 'Paracetamol', medUpd.json);

console.log('\n— المرضى والتنويم');
const p1 = await reception.post('/patients', { full_name_ar: 'مريض اختبار أول', gender: 'male', birth_date: '1990-01-01' });
const p2 = await reception.post('/patients', { full_name_ar: 'مريض اختبار ثاني', gender: 'female', birth_date: '1991-01-01' });
const n1 = Number(String(p1.json.file_number).slice(3));
const n2 = Number(String(p2.json.file_number).slice(3));
check('أرقام الملفات تسلسلية', p1.status === 201 && n2 === n1 + 1, [p1.json.file_number, p2.json.file_number]);
const wards = (await reception.get('/wards')).json as { department_id: string; beds: { id: string; status: string; code: string }[] }[];
check('كل الأسرّة لها كود QR', wards.every((w) => w.beds.every((b) => /^b[a-z0-9]{6,}$/.test(b.code))));
const h1Wards = wards.filter((w) => w.department_id !== 'd-h2-1');
const free = h1Wards.flatMap((w) => w.beds.filter((b) => b.status === 'free').map((b) => ({ bed: b, dept: w.department_id })));
const admit = await reception.post('/admissions', { patient_id: p1.json.id, bed_id: free[0].bed.id, department_id: free[0].dept, attending_doctor_id: 'u_doctor', reason: 'ألم بطن' });
check('الاستقبال ينوّم مريضاً ويحصل على رمز عائلة', admit.status === 201 && /^\d{6}$/.test(admit.json.family_pin), admit.json);
check('حجز نفس السرير مرة أخرى = 409', (await reception.post('/admissions', { patient_id: p2.json.id, bed_id: free[0].bed.id, department_id: free[0].dept })).status === 409);
const chartViewer = await viewer.get(`/patients/${p1.json.id}/chart`);
check('رمز العائلة مخفي عمّن لا يدير التنويم', chartViewer.status === 200 && chartViewer.json.patient.admission.family_pin === null);
const chartNurse = await nurse.get(`/patients/${p1.json.id}/chart`);
check('رمز العائلة ظاهر للتمريض', chartNurse.json.patient.admission.family_pin === admit.json.family_pin);

console.log('\n— صفحة ذوي المريض (QR)');
const code = free[0].bed.code;
const pub = await anon.get(`/public/track/${code}`);
check('المعلومات العامة بدون تسجيل دخول', pub.status === 200 && pub.json.occupied === true && pub.json.admission.patient_initials === 'م*** ا***', pub.json);
check('لا بيانات طبية أو اسم كامل في الرد العام', !JSON.stringify(pub.json).includes('مريض اختبار') && !('patient' in pub.json));
check('رمز خاطئ = 403', (await anon.post(`/public/track/${code}/family`, { pin: admit.json.family_pin === '000000' ? '111111' : '000000' })).status === 403);
const fam = await anon.post(`/public/track/${code}/family`, { pin: admit.json.family_pin });
check('الرمز الصحيح يعرض الاسم الكامل', fam.status === 200 && fam.json.patient.full_name_ar === 'مريض اختبار أول', fam.json);
{
  // ما يراه ذوو المريض: الافتراضي العلامات الحيوية فقط، والباقي بقرار الطاقم
  const admId = admit.json.admission_id;
  const pin = admit.json.family_pin;
  check('افتراضياً: العلامات الحيوية فقط', fam.json.shared.length === 1 && fam.json.shared[0] === 'vitals' && !('labs' in fam.json) && !('diagnoses' in fam.json), fam.json.shared);
  check('الممرض لا يشارك التحاليل (403)', (await nurse.patch(`/admissions/${admId}/family-share`, { share: { labs: true } })).status === 403);
  check('المشاهد لا يغيّر المشاركة (403)', (await viewer.patch(`/admissions/${admId}/family-share`, { share: { vitals: false } })).status === 403);
  check('الممرض يكتب رسالة للعائلة', (await nurse.patch(`/admissions/${admId}/family-share`, { message: 'المريض مستقر ويتناول طعامه' })).status === 200);
  await doctor.post(`/patients/${admId}/diagnoses`, { admission_id: admId, title_ar: 'التهاب الزائدة', status: 'confirmed' });
  await doctor.post(`/patients/${admId}/diagnoses`, { admission_id: admId, title_ar: 'تشخيص مشتبه سري', status: 'suspected' });
  const lo = await doctor.post(`/patients/${admId}/labs`, { admission_id: admId, test_name_ar: 'خضاب الدم' });
  await lab.patch(`/patients/${admId}/labs/${lo.json.id}`, { result: '13.5', unit: 'g/dL' });
  await doctor.post(`/patients/${admId}/labs`, { admission_id: admId, test_name_ar: 'طلب معلّق' });
  const sh = await doctor.patch(`/admissions/${admId}/family-share`, { share: { labs: true, diagnosis: true } });
  check('الطبيب يشارك التحاليل والتشخيص', sh.status === 200 && sh.json.family_share.labs === true && sh.json.family_share.vitals === true, sh.json);
  const fam2 = await anon.post(`/public/track/${code}/family`, { pin });
  check('العائلة ترى التحاليل الصادرة فقط', fam2.status === 200 && fam2.json.labs.length === 1 && fam2.json.labs[0].result === '13.5', fam2.json.labs);
  check('التشخيص المشتبه لا يظهر للعائلة', fam2.json.diagnoses.length === 1 && !JSON.stringify(fam2.json).includes('مشتبه سري'));
  check('رسالة الطاقم تظهر للعائلة', fam2.json.message?.text === 'المريض مستقر ويتناول طعامه');
  check('الأدوية غير المفعّلة لا تُرسل', !('medications' in fam2.json));
  check('لا شيء سريري بدون رمز العائلة', !JSON.stringify((await anon.get(`/public/track/${code}`)).json).includes('13.5'));
  await doctor.patch(`/admissions/${admId}/family-share`, { share: { labs: false } });
  check('إلغاء المشاركة يخفي التحاليل', !('labs' in (await anon.post(`/public/track/${code}/family`, { pin })).json));
  check('مستخدم من مستشفى آخر لا يغيّر المشاركة', [403, 404].includes((await admin2.patch(`/admissions/${admId}/family-share`, { share: { vitals: false } })).status));
}
check('كود سرير غير موجود = 404', (await anon.get('/public/track/bnotexisting00')).status === 404);
{
  const bruteCode = h1Wards[0].beds[0].code;
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await anon.post(`/public/track/${bruteCode}/family`, { pin: '999999' })).status;
  check('حد محاولات الرمز (429)', last === 429);
}

console.log('\n— النقل والخروج');
const trans = await nurse.post(`/admissions/${admit.json.admission_id}/transfer`, { bed_id: free[1].bed.id });
check('نقل إلى سرير آخر', trans.status === 204);
const wards2 = (await reception.get('/wards')).json as { beds: { id: string; status: string }[] }[];
const bedStatus = (id: string) => wards2.flatMap((w) => w.beds).find((b) => b.id === id)?.status;
check('السرير القديم تحرر والجديد مشغول', bedStatus(free[0].bed.id) === 'free' && bedStatus(free[1].bed.id) === 'occupied');
check('الخروج', (await manager.post(`/admissions/${admit.json.admission_id}/discharge`, { discharge_type: 'home', summary: 'تحسن' })).status === 204);
const afterDis = await doctor.get(`/patients/${p1.json.id}/chart`);
check('سبب الدخول محفوظ وملخص الخروج مستقل', afterDis.json.patient.admission.reason === 'ألم بطن' && afterDis.json.patient.admission.discharge_summary === 'تحسن', afterDis.json.patient.admission);
check('لا أوامر جديدة لتنويم منتهٍ (409)', (await doctor.post(`/patients/${admit.json.admission_id}/medications`, { admission_id: admit.json.admission_id, name_ar: 'دواء', dose: '1', route: 'PO', frequency: 'x', start_at: '2026-09-24' })).status === 409);
check('رمز العائلة يبطل بعد الخروج', (await anon.post(`/public/track/${free[1].bed.code}/family`, { pin: admit.json.family_pin })).status === 403);
const readmit = await reception.post('/admissions', { patient_id: p1.json.id, bed_id: free[2].bed.id, department_id: free[2].dept });
const hist = await doctor.get(`/patients/${p1.json.id}/chart`);
check('سجل التنويمات السابقة متاح', readmit.status === 201 && hist.json.admissions.length === 2);
check('عرض تنويم سابق', (await doctor.get(`/patients/${p1.json.id}/chart?admission=${admit.json.admission_id}`)).json.admissionId === admit.json.admission_id);

console.log('\n— الأقسام والمرفقات والتقارير');
check('قسم بدون اسم إنجليزي (201)', (await manager.post('/org/departments', { name_ar: 'قسم جديد' })).status === 201);
{
  const s = await login('doctor');
  const fd = new FormData();
  fd.append('file', new File(['نص تجريبي'], 'تقرير.txt', { type: 'text/plain' }));
  const up = await api.request(`${BASE}/patients/adm2/attachments`, { method: 'POST', headers: { cookie: s.cookie, 'x-csrf-token': s.csrf }, body: fd });
  const upJson = (await up.json()) as { id: string };
  check('رفع مرفق', up.status === 201);
  const dl = await api.request(`${BASE}/patients/adm2/attachments/${upJson.id}`, { headers: { cookie: s.cookie } });
  check('التنزيل يحفظ اسم الملف', dl.status === 200 && (dl.headers.get('content-disposition') ?? '').includes(encodeURIComponent('تقرير.txt')));
  const fd2 = new FormData();
  fd2.append('file', new File(['<svg onload=alert(1)>'], 'x.svg', { type: 'image/svg+xml' }));
  const bad = await api.request(`${BASE}/patients/adm2/attachments`, { method: 'POST', headers: { cookie: s.cookie, 'x-csrf-token': s.csrf }, body: fd2 });
  check('رفض أنواع ملفات خطرة (415)', bad.status === 415);
}
check('تقرير بمدى صحيح', (await manager.get('/reports/overview?from=2026-09-01&to=2026-09-30')).status === 200);
check('تقرير بدون مدى = 422', (await manager.get('/reports/overview')).status === 422);
check('تقرير بمدى أكبر من سنة = 422', (await manager.get('/reports/overview?from=2020-01-01&to=2026-01-01')).status === 422);

console.log('\n— المدير العام');
const hosp = await superA.post('/hospitals', { name_ar: 'مستشفى الاختبار', name_en: 'Test Hospital' });
check('إنشاء مستشفى', hosp.status === 201 && hosp.json.is_active === true, hosp.json);
check('manager لا ينشئ مستشفى (403)', (await manager.post('/hospitals', { name_ar: 'x y', name_en: 'x y' })).status === 403);
const hadmin = await superA.post(`/hospitals/${hosp.json.id}/admins`, { username: 'TestAdmin', password: 'HmsiDemo2026', full_name_ar: 'مدير الاختبار' });
check('إنشاء مدير للمستشفى', hadmin.status === 201);
const tAdmin = client(await login('testadmin'));
check('مدير المستشفى الجديد يدخل ويرى مستشفاه', (await tAdmin.get('/auth/me')).json.hospital_id === hosp.json.id);
check('اسم مستخدم مكرر = 409', (await superA.post(`/hospitals/${hosp.json.id}/admins`, { username: 'doctor', password: 'password123', full_name_ar: 'مكرر' })).status === 409);
const list = await superA.get('/hospitals');
check('قائمة المستشفيات مع المدراء', list.status === 200 && list.json.some((h: any) => h.id === hosp.json.id && h.admins.length === 1));
check('التبديل إلى مستشفى آخر', (await superA.post('/hospitals/h-2/switch')).status === 200 && (await superA.get('/auth/me')).json.hospital_id === 'h-2');
check('بعد التبديل: مرضى المستشفى الأول غير مرئيين', ((await superA.get('/patients')).json as unknown[]).length === 0);
check('العودة للمستشفى الأصلي', (await superA.post('/hospitals/h-1/switch')).status === 200 && (await superA.get('/auth/me')).json.hospital_id === 'h-1');
check('تعطيل مستشفى', (await superA.patch(`/hospitals/${hosp.json.id}`, { is_active: false })).status === 200);
check('جلسة مستخدم المستشفى المعطّل تتوقف', (await tAdmin.get('/auth/me')).json === null);

console.log('\n— الصيدلية والخروج والتدقيق');
{
  const pharm = client(await login('pharmacist'));
  check('الصيدلي لا يصف دواء (403)', (await pharm.post('/patients/adm2/medications', { admission_id: 'adm2', name_ar: 'دواء', dose: '1', route: 'PO', frequency: 'x', start_at: '2026-09-24' })).status === 403);
  const m = await doctor.post('/patients/adm2/medications', { admission_id: 'adm2', name_ar: 'أموكسيسيلين', dose: '500mg', route: 'PO', frequency: 'q8h', start_at: '2026-09-24' });
  const d1 = await pharm.post(`/patients/adm2/medications/${m.json.id}/dispense`);
  check('الصيدلي يصرف الدواء', d1.status === 200 && Boolean(d1.json.dispensed_at), d1.json);
  check('لا صرف مكرر (409)', (await pharm.post(`/patients/adm2/medications/${m.json.id}/dispense`)).status === 409);
  check('الطبيب لا يصرف (403)', (await doctor.post(`/patients/adm2/medications/${m.json.id}/dispense`)).status === 403);
  const notMine = await doctor.post('/admissions/adm5/discharge', { discharge_type: 'home', summary: 'تحسن' });
  check('طبيب من خارج الفريق لا يعتمد الخروج (403 not_your_patient)', notMine.status === 403 && notMine.json.code === 'not_your_patient');
  check('الطبيب المعالج يعتمد الخروج', (await client(await login('doctor3')).post('/admissions/adm5/discharge', { discharge_type: 'home', summary: 'تحسن' })).status === 204);
  const audit = await manager.get('/audit');
  check('سجل التدقيق لمدير المستشفى', audit.status === 200 && audit.json.length > 0 && audit.json.some((e: any) => e.action === 'medication_dispensed'));
  check('سجل التدقيق معزول عن المستشفيات الأخرى', ((await admin2.get('/audit')).json as any[]).every((e) => e.actor_id !== 'u_doctor'));
  check('الطبيب لا يرى سجل التدقيق (403)', (await doctor.get('/audit')).status === 403);
  check('تواريخ التدقيق بصيغة ISO', /T.*Z$/.test(audit.json[0].created_at));
}

console.log('\n— سجلات التمريض (ألم، وعي، سوائل) والعمل دون اتصال');
{
  const cid = `c_${Date.now().toString(36)}-vitals01`;
  const v1 = await nurse.post('/vitals', { admission_id: 'adm2', pulse: 88, pain_score: 6, consciousness: 'voice', client_id: cid, recorded_at: new Date(Date.now() - 3600_000).toISOString() });
  check('علامات حيوية مع الألم والوعي (201)', v1.status === 201 && v1.json.pain_score === 6 && v1.json.consciousness === 'voice', v1.json);
  check('وقت القياس الفعلي محفوظ (دون اتصال)', Date.now() - Date.parse(v1.json.recorded_at) > 50 * 60_000);
  const v2 = await nurse.post('/vitals', { admission_id: 'adm2', pulse: 88, client_id: cid });
  check('إعادة الإرسال بنفس المعرّف لا تكرر السجل (200)', v2.status === 200 && v2.json.id === cid);
  check('وقت أقدم من 48 ساعة مرفوض (422)', (await nurse.post('/vitals', { admission_id: 'adm2', pulse: 80, recorded_at: new Date(Date.now() - 72 * 3600_000).toISOString() })).status === 422);
  check('مقياس ألم خارج المدى (422)', (await nurse.post('/vitals', { admission_id: 'adm2', pain_score: 14 })).status === 422);
  const fin = await nurse.post('/patients/adm2/fluids', { admission_id: 'adm2', direction: 'in', kind: 'iv', volume_ml: 500 });
  check('تسجيل سوائل داخلة (201)', fin.status === 201 && fin.json.volume_ml === 500, fin.json);
  check('نوع سائل لا يطابق الاتجاه (422)', (await nurse.post('/patients/adm2/fluids', { admission_id: 'adm2', direction: 'in', kind: 'urine', volume_ml: 200 })).status === 422);
  check('المشاهد لا يسجل سوائل (403)', (await viewer.post('/patients/adm2/fluids', { admission_id: 'adm2', direction: 'out', kind: 'urine', volume_ml: 200 })).status === 403);
  const chart = await nurse.get('/patients/p2/chart');
  check('الملف يعرض السوائل', chart.status === 200 && chart.json.fluids.some((f: any) => f.id === fin.json.id), chart.json.fluids);
  const dash = await manager.get('/dashboard/stats');
  check('لوحة التحكم تعرض إنذار MEWS', dash.status === 200 && Array.isArray(dash.json.mewsAlerts) && dash.json.mewsAlerts.length > 0, dash.json.mewsAlerts);
}

console.log('\n— سجل إعطاء الأدوية (MAR)');
{
  const m = await doctor.post('/patients/adm2/medications', { admission_id: 'adm2', name_ar: 'سيفترياكسون', dose: '1g', route: 'IV', frequency: 'q12h', start_at: '2026-09-24' });
  const give = await nurse.post(`/patients/adm2/medications/${m.json.id}/administrations`, { status: 'given' });
  check('الممرض يسجل إعطاء جرعة (201)', give.status === 201 && give.json.status === 'given', give.json);
  check('تأجيل الجرعة بدون سبب مرفوض (422)', (await nurse.post(`/patients/adm2/medications/${m.json.id}/administrations`, { status: 'held' })).status === 422);
  check('تأجيل الجرعة مع السبب (201)', (await nurse.post(`/patients/adm2/medications/${m.json.id}/administrations`, { status: 'held', note: 'المريض صائم للعملية' })).status === 201);
  const pharm = client(await login('pharmacist'));
  check('الصيدلي لا يسجل إعطاء (403)', (await pharm.post(`/patients/adm2/medications/${m.json.id}/administrations`, { status: 'given' })).status === 403);
  check('لا يُحذف دواء أُعطيت منه جرعات (409)', (await doctor.del(`/patients/adm2/medications/${m.json.id}`)).status === 409);
  check('غير المسجِّل لا يلغي الإدخال (403)', (await doctor.del(`/patients/adm2/administrations/${give.json.id}`)).status === 403);
  check('المسجِّل يصحح إدخاله خلال ساعة (204)', (await nurse.del(`/patients/adm2/administrations/${give.json.id}`)).status === 204);
  await doctor.patch(`/patients/adm2/medications/${m.json.id}`, { status: 'discontinued' });
  check('لا جرعات لدواء موقوف (409)', (await nurse.post(`/patients/adm2/medications/${m.json.id}/administrations`, { status: 'given' })).status === 409);
  const chart = await nurse.get('/patients/p2/chart');
  check('الملف يعرض سجل الإعطاء', chart.json.administrations.length >= 1 && chart.json.administrations.every((x: any) => x.admission_id === 'adm2'));
}

console.log('\n— الملصقات والمرفقات');
{
  const wb = await api.request(`${BASE}/patients/adm2/labels/wristband`, { headers: { cookie: (await login('viewer')).cookie } });
  const zplBody = await wb.text();
  check('ملصق السوار بصيغة ZPL', wb.status === 200 && zplBody.startsWith('^XA') && zplBody.includes('^BC') && zplBody.trim().endsWith('^XZ'), zplBody.slice(0, 80));
  check('ملصق مستشفى آخر = 404', (await admin2.get('/patients/adm2/labels/wristband')).status === 404);
  const s = await login('doctor');
  const fd = new FormData();
  fd.append('file', new File(['<html><script>alert(1)</script></html>'], 'x.png', { type: 'image/png' }));
  const fake = await api.request(`${BASE}/patients/adm2/attachments`, { method: 'POST', headers: { cookie: s.cookie, 'x-csrf-token': s.csrf }, body: fd });
  check('ملف بنوع مزوّر مرفوض (415)', fake.status === 415);
  const fd2 = new FormData();
  fd2.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], 'r.pdf', { type: 'application/pdf' }));
  check('ملف PDF حقيقي مقبول (201)', (await api.request(`${BASE}/patients/adm2/attachments`, { method: 'POST', headers: { cookie: s.cookie, 'x-csrf-token': s.csrf }, body: fd2 })).status === 201);
  check('تنزيل المرفق يتطلب جلسة (401)', (await anon.get('/patients/adm2/attachments/x')).status === 401);
}

console.log('\n— سلة المحذوفات والاستعادة');
{
  const dg = await doctor.post('/patients/adm2/diagnoses', { admission_id: 'adm2', title_ar: 'تشخيص للحذف', status: 'confirmed' });
  check('حذف تشخيص (204)', (await doctor.del(`/patients/adm2/diagnoses/${dg.json.id}`)).status === 204);
  check('المحذوف اختفى من الملف', !(await doctor.get('/patients/p2/chart')).json.diagnoses.some((d: any) => d.id === dg.json.id));
  const mgrList = await manager.get('/trash');
  const item = mgrList.json.items.find((x: any) => x.record_id === dg.json.id);
  check('المدير يرى المحذوف في السلة مع اسم المريض', mgrList.json.canRestore === true && item?.kind === 'diagnosis' && item.patient_name_ar === 'سارة أحمد يوسف', item);
  const docList = await doctor.get('/trash');
  check('الطبيب يرى ما حذفه فقط ولا يستعيد', docList.json.canRestore === false && docList.json.items.every((x: any) => x.deleted_by_id === 'u_doctor') && docList.json.items.some((x: any) => x.id === item.id));
  check('الممرض لا يرى محذوفات الطبيب', !(await nurse.get('/trash')).json.items.some((x: any) => x.id === item.id));
  check('الطبيب لا يستعيد (403)', (await doctor.post(`/trash/${item.id}/restore`)).status === 403);
  check('الممرض لا يطلب استعادة ما لم يحذفه (404)', (await nurse.post(`/trash/${item.id}/request`, { note: 'x' })).status === 404);
  check('الطبيب يطلب الاستعادة', (await doctor.post(`/trash/${item.id}/request`, { note: 'حُذف بالخطأ' })).status === 204);
  check('الطلب يظهر للمدير', (await manager.get('/trash')).json.items.find((x: any) => x.id === item.id)?.restore_request_note === 'حُذف بالخطأ');
  check('المدير يستعيد (200)', (await manager.post(`/trash/${item.id}/restore`)).status === 200);
  check('المستعاد عاد إلى الملف', (await doctor.get('/patients/p2/chart')).json.diagnoses.some((d: any) => d.id === dg.json.id));
  check('لا استعادة مكررة (409)', (await manager.post(`/trash/${item.id}/restore`)).status === 409);
  check('مستشفى آخر لا يرى السلة', !(await admin2.get('/trash')).json.items.some((x: any) => x.id === item.id));

  const wardsNow = (await manager.get('/wards')).json as { beds: { id: string; status: string }[] }[];
  const freeBed = wardsNow.flatMap((w) => w.beds).find((b) => b.status === 'free')!;
  check('حذف سرير فارغ', (await manager.del(`/org/beds/${freeBed.id}`)).status === 204);
  const bedItem = (await manager.get('/trash')).json.items.find((x: any) => x.record_id === freeBed.id);
  check('السرير في السلة', bedItem?.kind === 'bed');
  await manager.post(`/trash/${bedItem.id}/restore`);
  check('استعادة السرير بنفس رمز QR', ((await manager.get('/wards')).json as any[]).flatMap((w) => w.beds).some((b: any) => b.id === freeBed.id && b.code));

  const px = await reception.post('/patients', { full_name_ar: 'مريض للأرشفة', gender: 'male', birth_date: '1980-01-01' });
  check('أرشفة مريض', (await reception.del(`/patients/${px.json.id}`)).status === 204);
  const pItem = (await manager.get('/trash')).json.items.find((x: any) => x.record_id === px.json.id);
  check('المريض المؤرشف في السلة', pItem?.mode === 'archive');
  await manager.post(`/trash/${pItem.id}/restore`);
  check('إلغاء الأرشفة يعيده للقائمة', ((await manager.get('/patients?search=' + encodeURIComponent('مريض للأرشفة'))).json as any[]).length === 1);
}

console.log('\n— شعار المستشفى');
{
  const { readFileSync } = await import('node:fs');
  const png = readFileSync(new URL('../../web/public/icons/icon-192.png', import.meta.url));
  const s = await login('manager');
  const up = async (bytes: Uint8Array, name: string, type: string) => {
    const fd = new FormData();
    fd.append('file', new File([Buffer.from(bytes)], name, { type }));
    return api.request(`${BASE}/hospitals/me/logo`, { method: 'POST', headers: { cookie: s.cookie, 'x-csrf-token': s.csrf }, body: fd });
  };
  const r = await up(new Uint8Array(png), 'logo.png', 'image/png');
  const h = (await r.json()) as { logo_url: string };
  check('رفع شعار المستشفى', r.status === 200 && /^\/api\/public\/hospitals\/h-1\/logo\?v=/.test(h.logo_url), h);
  const pub = await api.request(`http://localhost${h.logo_url}`);
  check('الشعار عام ومخزّن مؤقتاً', pub.status === 200 && pub.headers.get('content-type') === 'image/png' && (pub.headers.get('cache-control') ?? '').includes('immutable'));
  check('صورة مزوّرة مرفوضة (415)', (await up(new TextEncoder().encode('<svg onload=alert(1)>'), 'x.png', 'image/png')).status === 415);
  check('الطبيب لا يغيّر الشعار (403)', (await doctor.del('/hospitals/me/logo')).status === 403);
  check('الشعار في بيانات المستخدم', typeof (await manager.get('/auth/me')).json.hospital_logo_url === 'string');
}

console.log('\n— التسجيل الذاتي والفترة التجريبية والدفع');
{
  const { db } = await import('../db/index.js');
  check('المستشفيات القائمة بلا حد زمني', (await manager.get('/auth/me')).json.subscription.status === 'unlimited');
  check('المدير العام يضبط معلومات الدفع', (await superA.put('/billing/payment-info', { price: '100,000 د.ع شهرياً', bank_name: 'مصرف الرافدين', account_name: 'HMSI', account_number: '123456', phone: '07700000000', notes: '' })).status === 200);
  check('مدير المستشفى لا يضبط معلومات الدفع (403)', (await manager.put('/billing/payment-info', { price: 'x' })).status === 403);
  const info = await anon.get('/public/payment-info');
  check('معلومات الدفع عامة مع مدة التجربة', info.status === 200 && info.json.bank_name === 'مصرف الرافدين' && info.json.trial_days === 14);
  process.env.SIGNUP_MIN_MS = '0';
  const formToken = (await anon.get('/public/signup-token')).json.token as string;
  const signupBody = { hospital_name_ar: 'مستشفى التسجيل الذاتي', contact_phone: '07701234567', full_name_ar: 'مدير جديد', username: 'selfadmin', password: 'Trial2026x', city: 'بغداد', form_token: formToken };
  check('التسجيل بلا رمز نموذج مرفوض', (await anon.post('/public/signup', { ...signupBody, form_token: undefined })).json?.code === 'form_expired');
  check('رمز نموذج مزوّر مرفوض', (await anon.post('/public/signup', { ...signupBody, form_token: `${Date.now() - 60_000}.forged` })).status === 422);
  check('الحقل المخفي (فخ البرامج الآلية) يرفض التسجيل', (await anon.post('/public/signup', { ...signupBody, website: 'http://spam.example' })).status === 422);
  process.env.SIGNUP_MIN_MS = '3000';
  check('إرسال النموذج فوراً بعد فتحه مرفوض', (await anon.post('/public/signup', { ...signupBody, form_token: (await anon.get('/public/signup-token')).json.token })).status === 422);
  process.env.SIGNUP_MIN_MS = '0';
  check('كلمة مرور شائعة عند التسجيل مرفوضة', (await anon.post('/public/signup', { ...signupBody, password: 'Password123' })).status === 422);
  check('كلمة مرور ضعيفة عند التسجيل (422)', (await anon.post('/public/signup', { ...signupBody, password: 'abcdefgh' })).status === 422);
  check('اسم مستخدم مكرر عند التسجيل (409)', (await anon.post('/public/signup', { ...signupBody, username: 'doctor' })).status === 409);
  const reg = await api.request(`${BASE}/public/signup`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' }, body: JSON.stringify(signupBody) });
  const regUser = (await reg.json()) as any;
  check('تسجيل مستشفى جديد بفترة تجريبية 14 يوماً', reg.status === 201 && regUser.role === 'admin' && regUser.subscription.status === 'trial' && regUser.subscription.days_left === 14, regUser);
  const self = client(await login('selfadmin', 'Trial2026x'));
  check('المستشفى الجديد يعمل أثناء التجربة', (await self.get('/patients')).status === 200);
  await db.execute({ sql: `UPDATE hospitals SET trial_ends_at = ? WHERE id = ?`, args: [new Date(Date.now() - 1000).toISOString(), regUser.hospital_id] });
  const blocked = await self.get('/patients');
  check('بعد انتهاء التجربة: البيانات محجوبة (402)', blocked.status === 402 && blocked.json.code === 'subscription_expired');
  const bill = await self.get('/billing');
  check('صفحة الدفع متاحة بعد الانتهاء', bill.status === 200 && bill.json.subscription.status === 'expired' && bill.json.payment_info.account_number === '123456' && bill.json.can_submit === true);
  const notice = await self.post('/billing/notices', { amount: '100000', method: 'تحويل مصرفي', reference: 'TRX-778' });
  check('مدير المستشفى يرسل إشعار دفع', notice.status === 201 && notice.json.status === 'pending');
  const list = await superA.get('/billing/notices?status=pending');
  check('الإشعار يظهر للمدير العام', list.json.some((n: any) => n.id === notice.json.id && n.hospital_name_ar === 'مستشفى التسجيل الذاتي'));
  check('مدير مستشفى آخر لا يرى الإشعارات (403)', (await manager.get('/billing/notices')).status === 403);
  const act = await superA.post(`/hospitals/${regUser.hospital_id}/subscription`, { months: 1, notice_id: notice.json.id });
  check('المدير العام يفعّل الاشتراك شهراً', act.status === 200 && act.json.subscription.status === 'active' && act.json.subscription.days_left >= 28, act.json.subscription);
  check('الإشعار صار معتمداً', (await self.get('/billing')).json.notices[0].status === 'approved');
  check('الوصول عاد بعد التفعيل', (await self.get('/patients')).status === 200);
  check('المدير العام غير مقيّد بالاشتراك', (await superA.get('/hospitals')).status === 200);
}

console.log('\n— صفحة من نحن');
{
  const about = await anon.get('/public/about');
  check('صفحة من نحن عامة بمحتوى مبدئي', about.status === 200 && about.json.name.length > 0);
  check('مدير المستشفى لا يعدّلها (403)', (await manager.put('/site/about', { ...about.json, name: 'x' })).status === 403);
  check('المدير العام يعدّلها', (await superA.put('/site/about', { ...about.json, name: 'شركة الاختبار', phone: '0770' })).status === 200);
  check('التعديل ظاهر للزوار', (await anon.get('/public/about')).json.name === 'شركة الاختبار');
}

console.log('\n— التقارير التفصيلية');
{
  const range = 'from=2026-01-01&to=2026-12-31&tz=180';
  for (const type of ['admissions', 'discharges', 'census', 'occupancy', 'lab', 'radiology', 'pharmacy', 'mar', 'diagnoses', 'doctors']) {
    const r = await manager.get(`/reports/detail/${type}?${range}`);
    check(`تقرير ${type}`, r.status === 200 && Array.isArray(r.json.rows) && r.json.columns.length > 0 && r.json.summary.length > 0, r.json);
  }
  const census = await manager.get(`/reports/detail/census?${range}`);
  check('المنوّمون حالياً فيه صفوف فعلية', census.json.rows.length > 0 && census.json.rows.every((x: any) => x.patient && x.file_number));
  const other = await admin2.get(`/reports/detail/admissions?${range}`);
  check('التقرير معزول عن المستشفيات الأخرى', !other.json.rows.some((x: any) => x.patient === 'سارة أحمد يوسف'));
  check('نوع تقرير غير معروف (404)', (await manager.get(`/reports/detail/xyz?${range}`)).status === 404);
  check('المشاهد لا يرى التقارير (403)', (await viewer.get(`/reports/detail/admissions?${range}`)).status === 403);
}

console.log('\n— تحذير الحساسية عند الوصف');
{
  // adm1: المريض p1 لديه حساسية بنسلين
  const base = { admission_id: 'adm1', dose: '1g', route: 'IV', frequency: 'q8h', start_at: '2026-09-24' };
  const blocked = await doctor.post('/patients/adm1/medications', { ...base, name_ar: 'أوجمنتين' });
  check('وصف بنسلين لمريض حساس يُرفض بلا سبب (409)', blocked.status === 409 && blocked.json.code === 'allergy_conflict' && blocked.json.conflicts?.[0]?.kind === 'class');
  const cross = await doctor.post('/patients/adm1/medications', { ...base, name_ar: 'سيفترياكسون', name_en: 'Ceftriaxone' });
  check('التفاعل المتصالب (سيفالوسبورين) يُنبَّه عليه', cross.status === 409 && cross.json.conflicts?.[0]?.kind === 'cross');
  check('سبب قصير غير مقبول', (await doctor.post('/patients/adm1/medications', { ...base, name_ar: 'أوجمنتين', allergy_override_reason: 'ok' })).status === 422);
  const ok = await doctor.post('/patients/adm1/medications', { ...base, name_ar: 'أوجمنتين', allergy_override_reason: 'تحمّله سابقاً دون تفاعل — مراقبة لصيقة' });
  const ov = JSON.parse(ok.json.allergy_override_json ?? 'null');
  check('التجاوز بسبب مكتوب يُحفظ مع الدواء', ok.status === 201 && ov?.reason?.includes('تحمّله') && ov?.conflicts?.length === 1);
  const { db } = await import('../db/index.js');
  const aud = await db.execute({ sql: `SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'allergy_override' AND resource_id = ?`, args: [ok.json.id] });
  check('التجاوز مسجّل في سجل التدقيق', Number(aud.rows[0]!.n) === 1);
  const safe = await doctor.post('/patients/adm1/medications', { ...base, name_ar: 'باراسيتامول', name_en: 'Paracetamol' });
  check('دواء آمن يوصف مباشرة', safe.status === 201 && !safe.json.allergy_override_json);
  const rename = await doctor.patch(`/patients/adm1/medications/${safe.json.id}`, { name_ar: 'أموكسيسيلين' });
  check('تغيير اسم الدواء يعيد فحص الحساسية', rename.status === 409);
}

console.log('\n— النسخ الاحتياطي والتصدير والمراقبة');
{
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  process.env.BACKUP_DIR = await mkdtemp(join(tmpdir(), 'hmsi-bk-'));
  process.env.BACKUP_KEY = 'smoke-test-backup-key';
  const { decodeBackup } = await import('../src/lib/backup.js');

  const health = await anon.get('/health');
  check('فحص الصحة العام يعمل بلا تسجيل دخول', health.status === 200 && health.json.ok === true && !('counts' in health.json));
  check('صحة النظام التفصيلية للمدير العام فقط', (await manager.get('/system/health')).status === 403);
  check('مدير المستشفى لا ينشئ نسخة احتياطية (403)', (await manager.post('/system/backups')).status === 403);

  const made = await superA.post('/system/backups');
  check('المدير العام ينشئ نسخة احتياطية مشفّرة', made.status === 201 && made.json.encrypted === true && made.json.counts.patients > 0 && !('sessions' in made.json.counts));
  const list = await superA.get('/system/backups');
  check('قائمة النسخ تعرضها', list.json.backups?.[0]?.key === made.json.key);
  check('مفتاح نسخة غير صالح مرفوض', (await superA.get('/system/backups/..%2F..%2Fetc')).status === 404);
  const dl = await api.request(`${BASE}/system/backups/${made.json.key}`, { headers: { cookie: (await login('admin')).cookie } });
  const bytes = Buffer.from(await dl.arrayBuffer());
  const decoded = decodeBackup(bytes);
  check('النسخة المنزّلة تُفك بالمفتاح وتطابق الأعداد', dl.status === 200 && decoded.counts.patients === made.json.counts.patients && decoded.tables.users.length > 0);
  let wrongKey = false;
  try {
    decodeBackup(bytes, 'wrong-key');
  } catch {
    wrongKey = true;
  }
  check('لا تُفك النسخة بمفتاح خاطئ', wrongKey);
  check('ملف النسخة لا يحوي نصاً مقروءاً', !bytes.includes(Buffer.from('password_hash')));

  // تمرين الاستعادة على ملف محلي
  const bakFile = join(process.env.BACKUP_DIR, made.json.key);
  const { execFileSync } = await import('node:child_process');
  let drill = '';
  try {
    drill = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/restore-drill.ts', bakFile, `file:${join(process.env.BACKUP_DIR, 'drill.db')}`], { encoding: 'utf8', env: { ...process.env, LOCAL_DB_URL: `file:${join(process.env.BACKUP_DIR, 'drill-src.db')}` } });
  } catch (e) {
    drill = String((e as { stdout?: string }).stdout ?? e);
  }
  check('تمرين الاستعادة ينجح ويطابق كل الجداول', drill.includes('✓ الاستعادة سليمة'));

  const exp = await manager.get('/system/export');
  const expUsers: Record<string, unknown>[] = exp.json?.tables?.users ?? [];
  check('مدير المستشفى يصدّر بيانات مستشفاه', exp.status === 200 && exp.json.scope === 'hospital' && exp.json.tables.patients.length > 0);
  check('التصدير بلا كلمات مرور أو أسرار', expUsers.length > 0 && expUsers.every((u) => !('password_hash' in u) && !('totp_secret' in u)));
  check('التصدير لا يتضمن مستشفى آخر', exp.json.tables.patients.every((p: { hospital_id: string }) => p.hospital_id === exp.json.hospital_id) && exp.json.tables.hospitals.length === 1);
  check('الطبيب لا يصدّر (403)', (await doctor.get('/system/export')).status === 403);

  check('تسجيل خطأ من الواجهة', (await doctor.post('/system/client-errors', { message: 'TypeError: x is undefined 1012312341', path: '/patients/p1' })).status === 204);
  await doctor.post('/system/client-errors', { message: 'TypeError: x is undefined 1012312341', path: '/patients/p2' });
  const errs = await superA.get('/system/errors');
  const e = errs.json.find((x: { source: string }) => x.source === 'client');
  check('الأخطاء المتكررة تُجمع والأرقام الطويلة تُحجب', e?.count === 2 && !String(e.message).includes('1012312341'));
  check('صحة النظام تعرض النسخ والأخطاء', (await superA.get('/system/health')).json.backup.count === 1);
  delete process.env.BACKUP_KEY;
}

console.log('\n— كلمات المرور الضعيفة والمؤقتة والخمول');
{
  const { db } = await import('../db/index.js');
  const { hashPassword } = await import('../src/lib/password.js');
  // حساب تجريبي قديم بكلمة password123 (مثل ما قد يوجد في قاعدة الإنتاج)
  await db.execute({ sql: `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = 'u_viewer'`, args: [await hashPassword('password123')] });
  const weak = client(await login('viewer', 'password123'));
  const meWeak = await weak.get('/auth/me');
  check('الدخول بكلمة ضعيفة يفرض تغييرها', meWeak.json.must_change_password === true);
  const blockedWeak = await weak.get('/patients');
  check('لا وصول للبيانات قبل التغيير (403)', blockedWeak.status === 403 && blockedWeak.json.code === 'password_change_required');
  check('كلمة جديدة شائعة مرفوضة (422)', (await weak.post('/auth/password', { current_password: 'password123', new_password: 'Password1' })).status === 422);
  check('تغيير كلمة المرور يرفع القيد', (await weak.post('/auth/password', { current_password: 'password123', new_password: 'Obs#2026xq7' })).status === 204);
  check('الوصول بعد التغيير', (await weak.get('/patients')).status === 200 && (await weak.get('/auth/me')).json.must_change_password === false);

  // كلمة مؤقتة يضعها المدير
  check('المدير يعيد تعيين كلمة موظف', (await manager.post('/users/u_lab/password', { password: 'Temp2026lab' })).status === 204);
  const temp = client(await login('lab', 'Temp2026lab'));
  check('الكلمة المؤقتة تفرض التغيير', (await temp.get('/auth/me')).json.must_change_password === true && (await temp.get('/patients')).status === 403);
  await temp.post('/auth/password', { current_password: 'Temp2026lab', new_password: 'Specimen#2026' });

  // الخمول: جلسة بلا نشاط 31 دقيقة تنتهي
  const idle = await login('reception');
  await db.execute({ sql: `UPDATE sessions SET last_seen_at = ? WHERE user_id = 'u_reception'`, args: [new Date(Date.now() - 31 * 60_000).toISOString()] });
  const r = await api.request(`${BASE}/auth/me`, { headers: { cookie: idle.cookie } });
  check('الجلسة تنتهي بعد 30 دقيقة خمول', (await r.json()) === null);
}

console.log('\n— كلمات المرور');
{
  const nurse2 = client(await login('nurse2'));
  check('كلمة مرور ضعيفة مرفوضة (422)', (await nurse2.post('/auth/password', { current_password: 'HmsiDemo2026', new_password: 'abcdefgh' })).status === 422);
  check('كلمة مرور حالية خاطئة (403)', (await nurse2.post('/auth/password', { current_password: 'wrongpass1', new_password: 'newPass2026' })).status === 403);
  check('تغيير كلمة المرور', (await nurse2.post('/auth/password', { current_password: 'HmsiDemo2026', new_password: 'newPass2026' })).status === 204);
  check('الدخول بكلمة المرور الجديدة', await login('nurse2', 'newPass2026').then(() => true).catch(() => false));
  check('المدير يعيد تعيين كلمة مرور موظف', (await manager.post('/users/u_nurse2/password', { password: 'reset2026x' })).status === 204);
  check('الجلسة القديمة تنتهي بعد إعادة التعيين', (await nurse2.get('/auth/me')).json === null);
  check('المدير لا يعيد تعيين كلمة مرور المدير العام (403)', (await manager.post('/users/u_admin/password', { password: 'reset2026x' })).status === 403);
}

console.log('\n— التحقق بخطوتين');
{
  const { totpAt, currentStep } = await import('../src/lib/totp.js');
  const rawLogin = (username: string, password = 'HmsiDemo2026') =>
    api.request(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.7.7' }, body: JSON.stringify({ username, password }) });
  const cookiesOf = (res: Response) => {
    const jar: Record<string, string> = {};
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const i = pair!.indexOf('=');
      jar[pair!.slice(0, i)] = pair!.slice(i + 1);
    }
    return jar;
  };
  const rad = client(await login('radiology'));
  check('الحالة الابتدائية: غير مفعّل', (await rad.get('/auth/2fa/status')).json.enabled === false);
  const setup = await rad.post('/auth/2fa/setup');
  check('الإعداد يعيد سراً ورابط QR', setup.status === 200 && /^[A-Z2-7]{32}$/.test(setup.json.secret) && setup.json.otpauth_url.startsWith('otpauth://totp/'));
  const secret = setup.json.secret as string;
  check('رمز خاطئ لا يفعّل', (await rad.post('/auth/2fa/enable', { code: '000000' })).status === 422);
  const en = await rad.post('/auth/2fa/enable', { code: totpAt(secret, currentStep()) });
  check('التفعيل برمز صحيح يعيد 8 رموز استرداد', en.status === 200 && en.json.recovery_codes.length === 8);
  const recovery = en.json.recovery_codes as string[];
  const { db } = await import('../db/index.js');
  const stored = await db.execute(`SELECT totp_secret, totp_recovery_json FROM users WHERE id = 'u_radiology'`);
  check('السر مخزّن مشفّراً ورموز الاسترداد مجزّأة', !String(stored.rows[0]!.totp_secret).includes(secret) && !String(stored.rows[0]!.totp_recovery_json).includes(recovery[0]!));

  const step1 = await rawLogin('radiology');
  const s1 = (await step1.json()) as { mfa_required?: boolean; mfa_token?: string };
  check('كلمة المرور وحدها لا تنشئ جلسة', s1.mfa_required === true && !!s1.mfa_token && !cookiesOf(step1).hmsi_session);
  const bad = await anon.post('/auth/2fa/login', { mfa_token: s1.mfa_token, code: '123456' });
  check('رمز خاطئ في الخطوة الثانية = 401', bad.status === 401);
  // الرمز المستخدم في التفعيل لا يُقبل ثانية (منع إعادة الاستخدام) — نستخدم رمز الخطوة التالية
  const good = await api.request(`${BASE}/auth/2fa/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mfa_token: s1.mfa_token, code: totpAt(secret, currentStep() + 1) }) });
  check('الرمز الصحيح ينشئ الجلسة', good.status === 200 && !!cookiesOf(good).hmsi_session);
  const replay = await rawLogin('radiology');
  const t2 = ((await replay.json()) as { mfa_token: string }).mfa_token;
  check('نفس الرمز لا يُستخدم مرتين', (await anon.post('/auth/2fa/login', { mfa_token: t2, code: totpAt(secret, currentStep() + 1) })).status === 401);
  const rec = await anon.post('/auth/2fa/login', { mfa_token: t2, code: recovery[0] });
  check('رمز الاسترداد يعمل', rec.status === 200 && rec.json.username === 'radiology');
  const t3 = ((await (await rawLogin('radiology')).json()) as { mfa_token: string }).mfa_token;
  check('رمز الاسترداد لا يُستخدم مرتين', (await anon.post('/auth/2fa/login', { mfa_token: t3, code: recovery[0] })).status === 401);
  for (let i = 0; i < 4; i++) await anon.post('/auth/2fa/login', { mfa_token: t3, code: '111111' });
  check('التذكرة تُقفل بعد 5 محاولات', (await anon.post('/auth/2fa/login', { mfa_token: t3, code: recovery[1] })).json?.code === 'mfa_expired');
  check('تذكرة مزوّرة مرفوضة', (await anon.post('/auth/2fa/login', { mfa_token: 'x'.repeat(40), code: '123456' })).status === 401);

  check('الإيقاف يتطلب كلمة المرور', (await rad.post('/auth/2fa/disable', { password: 'wrong' })).status === 403);
  check('الطبيب لا يعيد ضبط التحقق لغيره (403)', (await doctor.post('/users/u_radiology/2fa/reset')).status === 403);
  check('مدير مستشفى آخر لا يعيد الضبط (404)', (await admin2.post('/users/u_radiology/2fa/reset')).status === 404);
  check('مدير المستشفى يعيد ضبط التحقق لموظف فقد هاتفه', (await manager.post('/users/u_radiology/2fa/reset')).status === 204);
  const after = await rawLogin('radiology');
  check('بعد إعادة الضبط: الدخول بكلمة المرور فقط', after.status === 200 && !!cookiesOf(after).hmsi_session);
}

console.log('\n— الإشعارات');
{
  const labUser = client(await login('lab', 'Specimen#2026'));
  const pharm = client(await login('pharmacist'));
  const nurseN = client(await login('nurse'));
  const doc2 = client(await login('doctor2'));
  await doctor.post('/notifications/read-all');
  await labUser.post('/notifications/read-all');
  await pharm.post('/notifications/read-all');
  await nurseN.post('/notifications/read-all');

  // طلب فحص من الطبيب → فني المختبر
  const order = await doctor.post('/patients/adm1/labs', { admission_id: 'adm1', test_name_ar: 'صوديوم', test_name_en: 'Sodium' });
  const labN = await labUser.get('/notifications');
  check('طلب الفحص يصل لفني المختبر', labN.json.some((n: any) => n.kind === 'lab_ordered' && n.title_ar.includes('صوديوم') && !n.is_read));
  check('الطبيب لا يُشعَر بما فعله بنفسه', !(await doctor.get('/notifications')).json.some((n: any) => n.kind === 'lab_ordered'));
  // نتيجة غير طبيعية → الطبيب المعالج فقط (u_doctor لـ adm1)
  await labUser.patch(`/patients/adm1/labs/${order.json.id}`, { result: '121', unit: 'mmol/L', abnormal: true });
  const dn = await doctor.get('/notifications');
  const abn = dn.json.find((n: any) => n.kind === 'lab_abnormal');
  check('النتيجة غير الطبيعية تصل للطبيب المعالج', abn?.severity === 'warning' && abn.link === '/patients/p1' && abn.body_ar.includes('121'));
  check('طبيب آخر لا يرى إشعار مريض غيره', !(await doc2.get('/notifications')).json.some((n: any) => n.id === abn.id));
  const cnt = await doctor.get('/notifications/count');
  check('عدّاد غير المقروء يعمل مع أعلى خطورة', cnt.json.unread >= 1 && ['warning', 'critical'].includes(cnt.json.top));
  check('قراءة إشعار', (await doctor.post(`/notifications/${abn.id}/read`)).status === 204 && (await doctor.get('/notifications')).json.find((n: any) => n.id === abn.id).is_read === true);
  check('لا يمكن قراءة إشعار غيرك (404)', (await doc2.post(`/notifications/${abn.id}/read`)).status === 404);
  check('مستشفى آخر لا يرى الإشعار', !(await admin2.get('/notifications')).json.some((n: any) => n.id === abn.id));

  // وصف دواء → الصيدلي
  await doctor.post('/patients/adm1/medications', { admission_id: 'adm1', name_ar: 'أوميبرازول', dose: '40mg', route: 'IV', frequency: 'OD', start_at: '2026-09-24' });
  check('وصف الدواء يصل للصيدلي', (await pharm.get('/notifications')).json.some((n: any) => n.kind === 'medication_prescribed' && n.title_ar.includes('أوميبرازول')));

  // MEWS مرتفع → الطبيب المعالج والتمريض (من ممرض آخر)
  const nurse2c = client(await login('nurse2', 'reset2026x'));
  await nurse2c.post('/auth/password', { current_password: 'reset2026x', new_password: 'Ward#Night77' });
  const vr = await nurse2c.post('/vitals', { admission_id: 'adm1', temperature: 39.4, pulse: 135, respiratory_rate: 32, bp_systolic: 78, consciousness: 'voice' });
  const mews = (await doctor.get('/notifications')).json.find((n: any) => n.kind === 'mews_high');
  check('MEWS المرتفع ينبّه الطبيب بخطورة حرجة', mews?.severity === 'critical');
  check('و ينبّه طاقم التمريض', (await nurseN.get('/notifications')).json.some((n: any) => n.kind === 'mews_high'));
  check('تسجيل العلامات الحيوية', vr.status === 201, vr.json);
  await nurse2c.post('/vitals', { admission_id: 'adm1', temperature: 36.8, pulse: 78, respiratory_rate: 16, bp_systolic: 120, consciousness: 'alert' });
  check('العلامات الطبيعية لا تنبّه', (await doctor.get('/notifications')).json.filter((n: any) => n.kind === 'mews_high').length === 1);

  check('قراءة الكل تصفّر العدّاد', (await doctor.post('/notifications/read-all')).status === 204 && (await doctor.get('/notifications/count')).json.unread === 0);
}

console.log('\n— جولة الأدوية وجدولة الجرعات');
{
  const { parseFrequency, doseStatus } = await import('@hmsi/shared');
  check('فهم التكرار العربي والإنجليزي', parseFrequency('كل 8 ساعات').hours === 8 && parseFrequency('مرتين يومياً').hours === 12 && parseFrequency('TID').hours === 8 && parseFrequency('يومياً').hours === 24 && parseFrequency('عند الحاجة').kind === 'prn' && parseFrequency('صباحاً').times?.[0] === 8);
  check('تكرار غير مفهوم لا يُخمَّن', parseFrequency('حسب الوضع').kind === 'unknown');
  const now = new Date('2026-09-25T12:00:00Z');
  const med = { frequency: 'q8h', start_at: '2026-09-20', created_at: '2026-09-20T06:00:00Z' };
  check('جرعة متأخرة', doseStatus(med, '2026-09-25T02:00:00Z', now).state === 'overdue');
  check('جرعة مستحقة الآن', doseStatus(med, '2026-09-25T04:30:00Z', now).state === 'due');
  check('جرعة قريبة', doseStatus(med, '2026-09-25T06:00:00Z', now).state === 'upcoming');
  check('جرعة لاحقة', doseStatus(med, '2026-09-25T11:30:00Z', now).state === 'later');
  check('دواء لمرة واحدة أُعطي = منتهٍ', doseStatus({ ...med, frequency: 'STAT' }, '2026-09-25T11:30:00Z', now).state === 'done');

  const nurseR = client(await login('nurse'));
  const r = await nurseR.get('/medication-rounds');
  check('الممرض يرى جولة الأدوية لمرضى مستشفاه', r.status === 200 && r.json.length > 0 && r.json.every((m: any) => m.full_name_ar && 'last_at' in m));
  const m0 = r.json[0];
  await nurseR.post(`/patients/${m0.admission_id}/medications/${m0.id}/administrations`, { status: 'given' });
  const r2 = await nurseR.get('/medication-rounds');
  check('آخر جرعة مسجّلة تظهر', r2.json.find((m: any) => m.id === m0.id)?.last_status === 'given');
  const ward = r.json[0].ward_id;
  check('تصفية حسب الردهة', (await nurseR.get(`/medication-rounds?ward=${ward}`)).json.every((m: any) => m.ward_id === ward));
  check('الاستقبال لا يرى جولة الأدوية (403)', (await client(await login('reception')).get('/medication-rounds')).status === 403);
  check('مستشفى آخر لا يرى أدوية هذا المستشفى', !(await admin2.get('/medication-rounds')).json.some((m: any) => r.json.some((x: any) => x.id === m.id)));
}

console.log('\n— تسليم المناوبة');
{
  const nurseH = client(await login('nurse'));
  const list = await nurseH.get('/handover');
  const p1 = list.json.find((x: any) => x.admission_id === 'adm1');
  check('ملخص التسليم لكل المرضى المنوّمين', list.status === 200 && list.json.length > 0 && !!p1);
  check('الملخص يتضمن الحساسية والعلامات الحيوية وMEWS', p1.allergies.length > 0 && p1.vitals && typeof p1.mews?.score === 'number');
  check('الملخص يتضمن الأعداد المعلقة', typeof p1.pending_labs === 'number' && typeof p1.active_meds === 'number');
  check('ملاحظة بلا وضع حالي مرفوضة', (await nurseH.post('/handover/adm1', { situation: '' })).status === 422);
  const w = await nurseH.post('/handover/adm1', { situation: 'مستقر، حرارة 38.2 ليلاً', background: 'التهاب رئوي', assessment: 'MEWS 3', recommendation: 'متابعة الحرارة كل 4 ساعات، نتيجة زرع الدم معلقة' });
  check('الممرض يكتب ملاحظة تسليم SBAR', w.status === 201);
  const after = (await nurseH.get('/handover')).json.find((x: any) => x.admission_id === 'adm1');
  check('آخر ملاحظة تسليم تظهر في الملخص', after.handover?.recommendation?.includes('زرع الدم') && after.handover.author);
  check('الاستقبال لا يكتب ملاحظة تسليم (403)', (await client(await login('reception')).post('/handover/adm1', { situation: 'x x' })).status === 403);
  check('مستشفى آخر لا يكتب على مريض هذا المستشفى (404)', (await admin2.post('/handover/adm1', { situation: 'تجربة' })).status === 404);
  check('مستشفى آخر لا يرى هذا المستشفى في التسليم', !(await admin2.get('/handover')).json.some((x: any) => x.admission_id === 'adm1'));
}

console.log('\n— فريق الرعاية: الطبيب يرى مرضاه فقط، ممرض واحد لكل مريض، التسليم والاستلام، الخطة العلاجية');
{
  const doc3 = client(await login('doctor3'));
  const nurseA = client(await login('nurse'));
  const nurseB = client(await login('nurse2', 'Ward#Night77'));
  const mgr = client(await login('manager'));
  const recep = client(await login('reception'));

  // قائمة المرضى
  const l1 = await doctor.get('/patients');
  const l3 = await doc3.get('/patients');
  check('الطبيب يرى مرضاه فقط في القائمة', l1.json.some((p: any) => p.id === 'p1') && !l3.json.some((p: any) => p.id === 'p1') && l3.json.some((p: any) => p.id === 'p3'));
  check('الاستقبال يرى كل المرضى', (await recep.get('/patients')).json.some((p: any) => p.id === 'p1') && (await recep.get('/patients')).json.some((p: any) => p.id === 'p3'));
  const denied = await doc3.get('/patients/p1/chart');
  check('ملف مريض ليس من مرضاه = 403 not_your_patient', denied.status === 403 && denied.json.code === 'not_your_patient');
  check('ولا سجلاته الطبية', (await doc3.post('/patients/adm1/notes', { admission_id: 'adm1', kind: 'doctor', content: 'محاولة' })).status === 403);
  check('ولا في جولة الأدوية', !(await doc3.get('/medication-rounds')).json.some((m: any) => m.patient_id === 'p1'));
  check('ولا في الإنذار المبكر بلوحة التحكم', !((await doc3.get('/dashboard/stats')).json.mewsAlerts ?? []).some((m: any) => m.patient_id === 'p1'));

  // الوصول الطارئ
  check('الوصول الطارئ يتطلب سبباً', (await doc3.post('/patients/p1/emergency-access', { reason: '' })).status === 422);
  const em = await doc3.post('/patients/p1/emergency-access', { reason: 'استدعاء طارئ — الطبيب المعالج غير متاح' });
  check('وصول طارئ بسبب مكتوب لمدة محدودة', em.status === 201 && Date.parse(em.json.expires_at) > Date.now());
  check('بعده يفتح الملف', (await doc3.get('/patients/p1/chart')).status === 200);
  check('المدير يُبلَّغ بالوصول الطارئ', (await mgr.get('/notifications')).json.some((n: any) => n.kind === 'emergency_access'));

  // أكثر من طبيب
  const add = await mgr.post('/care-team/admissions/adm3', { user_id: 'u_doctor2', role: 'doctor', specialty: 'قلبية' });
  const team3 = (await mgr.get('/care-team/admissions/adm3')).json.members;
  check('أكثر من طبيب على المريض (تخصصات)', add.status === 201 && team3.filter((m: any) => m.role === 'doctor').length === 2 && team3.some((m: any) => m.specialty === 'قلبية'));
  check('الطبيب المضاف يصل للمريض', (await client(await login('doctor2')).get('/patients/p3/chart')).status === 200);
  check('المشاهد لا يضيف أطباء (403)', (await client(await login('viewer', 'Obs#2026xq7')).post('/care-team/admissions/adm3', { user_id: 'u_doctor', role: 'doctor' })).status === 403);
  check('لا يُضاف مستخدم غير طبيب كطبيب (404)', (await mgr.post('/care-team/admissions/adm3', { user_id: 'u_nurse', role: 'doctor' })).status === 404);

  // ممرض واحد لكل مريض
  const r1 = await recep.post('/patients', { full_name_ar: 'مريض التعيين', gender: 'male', birth_date: '1990-01-01', phone: '0770000123', national_id: '99887766' });
  const free = (await mgr.get('/wards')).json.flatMap((w: any) => w.beds.filter((b: any) => b.status === 'free').map((b: any) => ({ bed: b.id, dept: w.department_id })));
  const adm = (await recep.post('/admissions', { patient_id: r1.json.id, bed_id: free[0].bed, department_id: free[0].dept, attending_doctor_id: 'u_doctor' })).json.admission_id;
  check('ممرض يستلم مريضاً غير معيَّن', (await nurseB.post(`/care-team/admissions/${adm}`, { user_id: 'u_nurse2', role: 'nurse' })).status === 201);
  const second = await nurseA.post(`/care-team/admissions/${adm}`, { user_id: 'u_nurse', role: 'nurse' });
  check('لا يُعيَّن ممرضان على نفس المريض (409)', second.status === 409);
  check('ولا حتى بواسطة المدير (409)', (await mgr.post(`/care-team/admissions/${adm}`, { user_id: 'u_nurse', role: 'nurse' })).status === 409);
  const { db } = await import('../db/index.js');
  let dbBlocked = false;
  try {
    await db.execute({ sql: `INSERT INTO care_team (id, admission_id, user_id, role, assigned_at) VALUES ('x-dup', ?, 'u_nurse', 'nurse', ?)`, args: [adm, new Date().toISOString()] });
  } catch {
    dbBlocked = true;
  }
  check('قاعدة البيانات نفسها تمنع ممرضين فعّالين', dbBlocked);
  const nurseMember = (await mgr.get(`/care-team/admissions/${adm}`)).json.members.find((m: any) => m.role === 'nurse');
  check('الممرض لا يترك مريضه دون تسليم (403)', (await nurseB.post(`/care-team/admissions/${adm}/members/${nurseMember.id}/end`, {})).status === 403);
  check('الاستقبال لا يعيّن ممرضاً (403)', (await recep.post(`/care-team/admissions/${adm}`, { user_id: 'u_nurse', role: 'nurse' })).status === 403);

  // التسليم والاستلام
  check('لا يُسلَّم مريض ليس لك (403)', (await nurseA.post('/care-team/handovers', { to_user_id: 'u_nurse2', admission_ids: [adm] })).status === 403);
  const ho = await nurseA.post('/care-team/handovers', { to_user_id: 'u_nurse2', admission_ids: ['adm1', 'adm4'], note: 'نهاية المناوبة الصباحية' });
  check('الممرض يسلّم مرضاه لزميل', ho.status === 201);
  check('لا تسليم مزدوج لنفس المريض (409)', (await nurseA.post('/care-team/handovers', { to_user_id: 'u_nurse2', admission_ids: ['adm1'] })).status === 409);
  const inbox = (await nurseB.get('/care-team/handovers')).json;
  check('المستلم يرى طلب الاستلام مع المرضى', inbox.incoming.some((h: any) => h.id === ho.json.id && h.items.length === 2));
  check('المستلم يُبلَّغ بطلب الاستلام', (await nurseB.get('/notifications')).json.some((n: any) => n.kind === 'handover_request'));
  check('قبل القبول تبقى المسؤولية على المسلِّم', (await mgr.get('/care-team/admissions/adm1')).json.members.find((m: any) => m.role === 'nurse').user_id === 'u_nurse');
  check('المسلِّم لا يقبل عن المستلم (403)', (await nurseA.post(`/care-team/handovers/${ho.json.id}/accept`)).status === 403);
  const acc = await nurseB.post(`/care-team/handovers/${ho.json.id}/accept`);
  check('الاستلام ينقل المرضى للمستلم', acc.status === 200 && acc.json.moved === 2 && (await mgr.get('/care-team/admissions/adm1')).json.members.find((m: any) => m.role === 'nurse').user_id === 'u_nurse2');
  check('لا قبول مرتين (409)', (await nurseB.post(`/care-team/handovers/${ho.json.id}/accept`)).status === 409);
  check('المسلِّم يُبلَّغ بالاستلام', (await nurseA.get('/notifications')).json.some((n: any) => n.kind === 'handover_accepted'));
  const back = await nurseB.post('/care-team/handovers', { to_user_id: 'u_nurse', admission_ids: ['adm1'] });
  check('الرفض يتطلب سبباً', (await nurseA.post(`/care-team/handovers/${back.json.id}/reject`, { reason: '' })).status === 422);
  await nurseA.post(`/care-team/handovers/${back.json.id}/reject`, { reason: 'لدي 6 مرضى بالفعل' });
  check('بعد الرفض يبقى المريض مع المسلِّم', (await mgr.get('/care-team/admissions/adm1')).json.members.find((m: any) => m.role === 'nurse').user_id === 'u_nurse2');
  const mine = (await nurseB.get('/medication-rounds/vitals?mine=1')).json;
  check('«مرضاي» للممرض بعد الاستلام', mine.some((x: any) => x.admission_id === 'adm1') && !mine.some((x: any) => x.admission_id === 'adm8'));

  // الخطة العلاجية
  const plan = await doctor.put('/care-team/plans/adm1', { goals: 'ضبط الضغط', vitals_interval_hours: 1, nursing_instructions: 'قياس السكر قبل الوجبات' });
  check('الطبيب يضع الخطة العلاجية', plan.status === 200 && plan.json.vitals_interval_hours === 1);
  check('الممرض المعيَّن يُبلَّغ بتحديث الخطة', (await nurseB.get('/notifications')).json.some((n: any) => n.kind === 'care_plan_updated'));
  const np = await nurseB.put('/care-team/plans/adm1', { goals: 'تغيير من الممرض', vitals_interval_hours: 2 });
  check('الممرض يعدّل تكرار القياس فقط', np.status === 200 && np.json.vitals_interval_hours === 2 && np.json.goals === 'ضبط الضغط');
  check('الاستقبال لا يعدّل الخطة (403)', (await recep.put('/care-team/plans/adm1', { goals: 'x' })).status === 403);
  check('طبيب من خارج الفريق لا يعدّل الخطة (403)', (await client(await login('doctor2')).put('/care-team/plans/adm1', { goals: 'x' })).status === 403);
  const vit = (await nurseB.get('/medication-rounds/vitals?mine=1')).json.find((x: any) => x.admission_id === 'adm1');
  check('مواعيد العلامات الحيوية تتبع الخطة', vit.interval_hours === 2 && 'last_at' in vit);
  const { vitalsStatus, vitalsIntervalHours } = await import('@hmsi/shared');
  check('MEWS مرتفع يقصّر التكرار إلى ساعة', vitalsIntervalHours(4, 'high') === 1 && vitalsIntervalHours(null, 'low') === 4);
  check('قياس متأخر يُكتشف', vitalsStatus({ admitted_at: '2026-01-01T00:00:00Z', last_at: new Date(Date.now() - 5 * 3_600_000).toISOString(), interval_hours: 4 }).state === 'overdue');

  // الخروج ينهي الفريق ويلغي التسليمات المعلقة
  const pend = await nurseB.post('/care-team/handovers', { to_user_id: 'u_nurse', admission_ids: [adm] });
  await doctor.post(`/admissions/${adm}/discharge`, { discharge_type: 'home', summary: 'تحسن' });
  check('الخروج ينهي فريق الرعاية', (await mgr.get(`/care-team/admissions/${adm}`)).json.members.length === 0);
  check('ويلغي تسليماته المعلقة', !(await nurseA.get('/care-team/handovers')).json.incoming.some((h: any) => h.id === pend.json.id));
  check('الطبيب يبقى يرى مريضه السابق (السجل)', (await doctor.get(`/patients/${r1.json.id}/chart`)).status === 200);
}

console.log('\n— نقاط الصيانة');
check('seed بتوكن خاطئ = 404', (await api.request(`${BASE}/__staff/seed`, { method: 'POST', headers: { 'x-staff-token': 'wrong' } })).status === 404);
{
  const { env } = await import('../src/config.js');
  env.seedToken = 'staff-token-for-test';
  const wipe = await api.request(`${BASE}/__staff/seed`, { method: 'POST', headers: { 'x-staff-token': 'staff-token-for-test', 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'WIPE_ALL_DATA' }) });
  check('المسح الكامل مرفوض بوجود مستشفيات حقيقية (409)', wipe.status === 409);
  env.seedToken = '';
}

console.log('\n— تهيئة مستشفى جديد: أقسام وردهات وأسرّة');
{
  const a2 = client(await login('admin2'));
  const dep = await a2.post('/org/departments', { name_ar: 'قسم الطوارئ', name_en: 'Emergency' });
  check('مدير المستشفى يضيف قسماً', dep.status === 201, dep.json);
  const ward = await a2.post('/org/wards', { department_id: dep.json.id, name_ar: 'ردهة الطوارئ', name_en: 'ER ward', ward_type: 'mixed' });
  check('يضيف ردهة', ward.status === 201, ward.json);
  const bed = await a2.post('/org/beds', { ward_id: ward.json.id, room: 'ER-1', bed_no: 'B1' });
  check('يضيف سريراً (201)', bed.status === 201 && bed.json.status === 'free' && Boolean(bed.json.code), bed.json);
  const bed2 = await a2.post('/org/beds', { ward_id: ward.json.id, room: 'ER-1', bed_no: 'B2' });
  check('يضيف سريراً ثانياً', bed2.status === 201);
  check('السرير يظهر في الردهات', (await a2.get('/wards')).json.some((w: any) => w.id === ward.json.id && w.beds.length === 2));
  check('يعدّل السرير', (await a2.patch(`/org/beds/${bed.json.id}`, { bed_no: 'B1A' })).status === 200);
  check('يحذف السرير (إلى المحذوفات)', (await a2.del(`/org/beds/${bed2.json.id}`)).status === 204);
  check('يعدّل الردهة', (await a2.patch(`/org/wards/${ward.json.id}`, { name_ar: 'ردهة الطوارئ العامة' })).status === 200);
  check('يعدّل القسم', (await a2.patch(`/org/departments/${dep.json.id}`, { name_en: 'Emergency Dept' })).status === 200);
  const h1Ward = (await manager.get('/wards')).json[0].id;
  check('لا يضيف سريراً في ردهة مستشفى آخر', (await a2.post('/org/beds', { ward_id: h1Ward, room: 'X', bed_no: 'X' })).status === 409);
}

console.log('\n— حذف بيانات التجربة والمستشفيات (آخر الاختبارات: يمسح البيانات)');
{
  const sa = client(await login('admin'));
  const mgr = client(await login('manager'));
  const { db } = await import('../db/index.js');
  check('مدير المستشفى لا يحذف بيانات التجربة (403)', (await mgr.post('/system/purge-demo', { confirm: 'DELETE DEMO DATA' })).status === 403);
  const st = await sa.get('/system/demo-status');
  check('حالة بيانات التجربة: موجودة', st.status === 200 && st.json.present === true);
  check('عبارة تأكيد خاطئة مرفوضة', (await sa.post('/system/purge-demo', { confirm: 'delete' })).status === 422);

  // حذف مستشفى تجريبي مسجَّل ذاتياً
  const self = (await sa.get('/hospitals')).json.find((h: any) => h.signup_source === 'self');
  check('رمز مستشفى خاطئ مرفوض', (await sa.post(`/hospitals/${self.id}/purge`, { confirm_code: 'WRONG' })).status === 422);
  const ph = await sa.post(`/hospitals/${self.id}/purge`, { confirm_code: self.code });
  check('حذف مستشفى نهائياً مع نسخة احتياطية أولاً', ph.status === 200 && Boolean(ph.json.backup) && ph.json.counts.hospitals === 1);
  check('المستشفى المحذوف لم يعد موجوداً', !(await sa.get('/hospitals')).json.some((h: any) => h.id === self.id));
  check('لا يُحذف مستشفى المدير العام نفسه (409)', (await sa.post('/hospitals/h-1/purge', { confirm_code: 'MSH-001' })).status === 409);

  const pd = await sa.post('/system/purge-demo', { confirm: 'DELETE DEMO DATA' });
  check('حذف بيانات التجربة مع نسخة احتياطية', pd.status === 200 && Boolean(pd.json.backup) && pd.json.counts.patients > 0);
  const n = async (sql: string) => Number((await db.execute(sql)).rows[0]!.n);
  check('لا مرضى ولا تنويمات ولا أسرّة متبقية', (await n(`SELECT COUNT(*) AS n FROM patients`)) === 0 && (await n(`SELECT COUNT(*) AS n FROM admissions`)) === 0 && (await n(`SELECT COUNT(*) AS n FROM beds`)) === 0);
  check('لم يبق من مستشفيي التجربة إلا المدير العام', (await n(`SELECT COUNT(*) AS n FROM users WHERE role != 'super_admin' AND hospital_id IN ('h-1','h-2')`)) === 0 && (await n(`SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'`)) >= 1);
  check('لا مخالفات مفاتيح أجنبية بعد الحذف', (await db.execute('PRAGMA foreign_key_check')).rows.length === 0);
  const me = await client(await login('admin')).get('/auth/me');
  check('المدير العام يدخل بعد الحذف في «إدارة النظام»', me.json.role === 'super_admin' && me.json.hospital_name_ar === 'إدارة النظام');
  check('حالة بيانات التجربة: لا شيء', (await client(await login('admin')).get('/system/demo-status')).json.present === false);
  check('الحذف مسجّل في التدقيق', (await n(`SELECT COUNT(*) AS n FROM audit_logs WHERE action IN ('demo_purged','hospital_purged')`)) === 2);
}

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
