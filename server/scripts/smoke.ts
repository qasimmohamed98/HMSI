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

async function login(username: string, password = 'password123'): Promise<Sess> {
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
check('super_admin لا يكتب ملاحظات طبية (403)', (await superA.post('/patients/adm2/notes', { admission_id: 'adm2', kind: 'doctor', content: 'test' })).status === 403);
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
check('مدير مستشفى آخر لا يصدر رمز عائلة لتنويم خارجي (409)', (await admin2.post('/admissions/adm1/family-pin')).status === 409);
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
const admit = await reception.post('/admissions', { patient_id: p1.json.id, bed_id: free[0].bed.id, department_id: free[0].dept, reason: 'ألم بطن' });
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
const hadmin = await superA.post(`/hospitals/${hosp.json.id}/admins`, { username: 'TestAdmin', password: 'password123', full_name_ar: 'مدير الاختبار' });
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
  check('الطبيب يعتمد الخروج', (await doctor.post('/admissions/adm5/discharge', { discharge_type: 'home', summary: 'تحسن' })).status === 204);
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

console.log('\n— كلمات المرور');
{
  const nurse2 = client(await login('nurse2'));
  check('كلمة مرور ضعيفة مرفوضة (422)', (await nurse2.post('/auth/password', { current_password: 'password123', new_password: 'abcdefgh' })).status === 422);
  check('كلمة مرور حالية خاطئة (403)', (await nurse2.post('/auth/password', { current_password: 'wrongpass1', new_password: 'newPass2026' })).status === 403);
  check('تغيير كلمة المرور', (await nurse2.post('/auth/password', { current_password: 'password123', new_password: 'newPass2026' })).status === 204);
  check('الدخول بكلمة المرور الجديدة', await login('nurse2', 'newPass2026').then(() => true).catch(() => false));
  check('المدير يعيد تعيين كلمة مرور موظف', (await manager.post('/users/u_nurse2/password', { password: 'reset2026x' })).status === 204);
  check('الجلسة القديمة تنتهي بعد إعادة التعيين', (await nurse2.get('/auth/me')).json === null);
  check('المدير لا يعيد تعيين كلمة مرور المدير العام (403)', (await manager.post('/users/u_admin/password', { password: 'reset2026x' })).status === 403);
}

console.log('\n— نقاط الصيانة');
check('seed بتوكن خاطئ = 404', (await api.request(`${BASE}/__staff/seed`, { method: 'POST', headers: { 'x-staff-token': 'wrong' } })).status === 404);

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
