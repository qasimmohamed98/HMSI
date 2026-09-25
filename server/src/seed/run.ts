import { hash } from '@node-rs/argon2';
import { db, uuid, generateFamilyPin } from '../../db/index.js';
import { generateBedCode } from '../repos/orgRepo.js';

// كلمة مرور بيانات التجربة المحلية فقط — ليست ضمن قائمة الكلمات الضعيفة حتى لا يُفرض تغييرها في الاختبارات
const PASSWORD = 'HmsiDemo2026';
const H = 'h-1';
const H2 = 'h-2';

async function pw(): Promise<string> {
  return hash(PASSWORD, { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

function daysAgo(n: number, h = 0): string {
  const d = new Date(Date.now() - n * 86400000);
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

type DBRows = Record<string, unknown>[];

async function insert(table: string, rows: DBRows): Promise<void> {
  for (const row of rows) {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    await db.execute({
      sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
      args: keys.map((k) => row[k] as string | number | null),
    });
  }
}

export async function runSeed(): Promise<{ users: number; patients: number }> {
  const passwordHash = await pw();

  const clearOrder = [
    'timeline_events', 'procedures', 'consultations', 'radiology_reports', 'lab_results',
    'access_grants', 'care_plans', 'nurse_handover_items', 'nurse_handovers', 'care_team', 'handover_notes', 'notification_reads', 'notifications', 'error_events', 'mfa_challenges', 'trash', 'payment_notices', 'system_settings', 'medication_administrations', 'fluid_entries', 'medications', 'diagnoses', 'medical_notes', 'vitals', 'attachments', 'audit_logs',
    'sessions', 'login_attempts', 'admissions', 'patients', 'beds', 'wards', 'departments',
    'users', 'settings', 'hospitals',
  ];
  for (const t of clearOrder) await db.execute({ sql: `DELETE FROM ${t}`, args: [] });

  // تعريفات ثابتة --------------------------------------------------
  const users: DBRows = [
    { id: 'u_admin', hospital_id: H, username: 'admin', full_name_ar: 'مدير النظام', full_name_en: 'System Admin', role: 'super_admin', email: 'admin@hms.local', password_hash: passwordHash },
    { id: 'u_manager', hospital_id: H, username: 'manager', full_name_ar: 'مدير المستشفى', full_name_en: 'Hospital Manager', role: 'admin', email: 'manager@hms.local', password_hash: passwordHash },
    { id: 'u_admin2', hospital_id: H2, username: 'admin2', full_name_ar: 'مدير مستشفى النور', full_name_en: 'Alnoor Manager', role: 'admin', email: null, password_hash: passwordHash },
    { id: 'u_doctor', hospital_id: H, username: 'doctor', full_name_ar: 'أحمد المنصور', full_name_en: 'Ahmad Almansour', role: 'doctor', email: 'ahmad@hms.local', password_hash: passwordHash },
    { id: 'u_doctor2', hospital_id: H, username: 'doctor2', full_name_ar: 'ليلى حسن', full_name_en: 'Laila Hasan', role: 'doctor', email: 'laila@hms.local', password_hash: passwordHash },
    { id: 'u_doctor3', hospital_id: H, username: 'doctor3', full_name_ar: 'عمر النجار', full_name_en: 'Omar Alnajjar', role: 'doctor', email: 'omar@hms.local', password_hash: passwordHash },
    { id: 'u_nurse', hospital_id: H, username: 'nurse', full_name_ar: 'فاطمة سعيد', full_name_en: 'Fatima Saeed', role: 'nurse', email: null, password_hash: passwordHash },
    { id: 'u_nurse2', hospital_id: H, username: 'nurse2', full_name_ar: 'خالد عيد', full_name_en: 'Khaled Eid', role: 'nurse', email: null, password_hash: passwordHash },
    { id: 'u_pharmacist', hospital_id: H, username: 'pharmacist', full_name_ar: 'سامي عودة', full_name_en: 'Sami Awdah', role: 'pharmacist', email: null, password_hash: passwordHash },
    { id: 'u_lab', hospital_id: H, username: 'lab', full_name_ar: 'تركي الجبر', full_name_en: 'Turki Aljabr', role: 'lab', email: null, password_hash: passwordHash },
    { id: 'u_radiology', hospital_id: H, username: 'radiology', full_name_ar: 'إبراهيم حسن', full_name_en: 'Ibrahim Hasan', role: 'radiology', email: null, password_hash: passwordHash },
    { id: 'u_reception', hospital_id: H, username: 'reception', full_name_ar: 'نورة العلي', full_name_en: 'Noura Alali', role: 'reception', email: null, password_hash: passwordHash },
    { id: 'u_viewer', hospital_id: H, username: 'viewer', full_name_ar: 'زائر مطّلع', full_name_en: 'Audit Viewer', role: 'viewer', email: null, password_hash: passwordHash },
  ];

  const departments: DBRows = [
    { id: 'd-1', hospital_id: H, name_ar: 'الباطنية', name_en: 'Internal Medicine' },
    { id: 'd-2', hospital_id: H, name_ar: 'الجراحة', name_en: 'Surgery' },
    { id: 'd-3', hospital_id: H, name_ar: 'الطوارئ', name_en: 'Emergency' },
    { id: 'd-4', hospital_id: H, name_ar: 'طب الأطفال', name_en: 'Pediatrics' },
    { id: 'd-h2-1', hospital_id: H2, name_ar: 'الباطنية', name_en: 'Internal Medicine' },
  ];

  const wards: DBRows = [
    { id: 'w-1', department_id: 'd-1', name_ar: 'ردهة الرجال – الباطنية', name_en: 'Internal – Male Ward', ward_type: 'male' },
    { id: 'w-2', department_id: 'd-1', name_ar: 'ردهة النساء – الباطنية', name_en: 'Internal – Female Ward', ward_type: 'female' },
    { id: 'w-3', department_id: 'd-2', name_ar: 'ردهة الجراحة', name_en: 'Surgery Ward', ward_type: 'mixed' },
    { id: 'w-4', department_id: 'd-4', name_ar: 'ردهة الأطفال', name_en: 'Pediatrics Ward', ward_type: 'mixed' },
    { id: 'w-h2-1', department_id: 'd-h2-1', name_ar: 'ردهة الباطنية', name_en: 'Internal Ward', ward_type: 'mixed' },
  ];

  const beds: DBRows = [];
  {
    let i = 1;
    for (const w of ['w-1', 'w-2', 'w-3', 'w-4', 'w-h2-1']) {
      const count = w === 'w-4' ? 2 : 4;
      for (let k = 1; k <= count; k++) {
        // الحالة تُحسب لاحقاً من التنويمات النشطة
        beds.push({ id: `bed-${i}`, ward_id: w, room: `${w.toUpperCase().replace(/-/g, '')}-${Math.ceil(k / 2)}`, bed_no: `B${k}`, status: 'free', code: generateBedCode() });
        i++;
      }
    }
  }

  await insert('hospitals', [
    { id: H, name_ar: 'مستشفى المدينة التخصصي', name_en: 'Madinah Specialized Hospital', code: 'MSH-001', settings_json: '{"timezone":"Asia/Riyadh"}' },
    { id: H2, name_ar: 'مستشفى النور العام', name_en: 'Alnoor General Hospital', code: 'ANH-002', settings_json: '{}' },
  ]);
  await insert('users', users);
  await insert('departments', departments);
  await insert('wards', wards);
  await insert('beds', beds);
  await insert('settings', [{ id: uuid('st'), hospital_id: H, key: 'hospital', value_json: JSON.stringify({ lang: 'ar' }) }]);

  // سجل مرضى -------------------------------------------------
  const patients: DBRows = [
    { id: 'p1', hospital_id: H, file_number: 'FM-24501', full_name_ar: 'محمد علي كريم', full_name_en: 'Mohammed Ali Karim', gender: 'male', birth_date: '1972-04-10', phone: '0501111111', national_id: '1012312341', blood_type: 'O+', allergies_json: JSON.stringify(['بنسلين (Penicillin)']), critical_alerts_json: JSON.stringify(['حساسية بنسلين مسجلة']), status: 'active', created_by: 'u_reception' },
    { id: 'p2', hospital_id: H, file_number: 'FM-24502', full_name_ar: 'سارة أحمد يوسف', full_name_en: 'Sara Ahmad Yousef', gender: 'female', birth_date: '1994-06-22', phone: '0502222222', national_id: '1012312342', blood_type: 'A+', allergies_json: '[]', critical_alerts_json: '[]', status: 'active', created_by: 'u_reception' },
    { id: 'p3', hospital_id: H, file_number: 'FM-24503', full_name_ar: 'خالد محمد العتيبي', full_name_en: 'Khalid Mohammed Alotaibi', gender: 'male', birth_date: '1965-01-05', phone: '0503333333', national_id: '1012312343', blood_type: 'B+', allergies_json: '[]', critical_alerts_json: JSON.stringify(['السكري النوع 2']), status: 'active', created_by: 'u_reception' },
    { id: 'p4', hospital_id: H, file_number: 'FM-24504', full_name_ar: 'فاطمة عبدالله السالم', full_name_en: 'Fatimah Abdullah Alsalem', gender: 'female', birth_date: '1981-11-17', phone: '0504444444', national_id: '1012312344', blood_type: 'AB-', allergies_json: JSON.stringify(['سيفالوسبورين']), critical_alerts_json: '[]', status: 'active', created_by: 'u_reception' },
    { id: 'p5', hospital_id: H, file_number: 'FM-24505', full_name_ar: 'عمر ناصر الحربي', full_name_en: 'Omar Nasser Alharbi', gender: 'male', birth_date: '1998-03-30', phone: '0505555555', national_id: '1012312345', blood_type: 'O-', allergies_json: '[]', critical_alerts_json: '[]', status: 'active', created_by: 'u_reception' },
    { id: 'p6', hospital_id: H, file_number: 'FM-24506', full_name_ar: 'نوره سعد القحطاني', full_name_en: 'Noura Saad Alqahtani', gender: 'female', birth_date: '1988-09-09', phone: '0506666666', national_id: '1012312346', blood_type: 'A-', allergies_json: '[]', critical_alerts_json: '[]', status: 'discharged', created_by: 'u_reception' },
    { id: 'p7', hospital_id: H, file_number: 'FM-24507', full_name_ar: 'يوسف إبراهيم الشمري', full_name_en: 'Yousef Ibrahim Alshammari', gender: 'male', birth_date: '2017-12-01', phone: '0507777777', national_id: '1012312347', blood_type: 'B-', allergies_json: '[]', critical_alerts_json: JSON.stringify(['قصر نفس']), status: 'active', created_by: 'u_reception' },
    { id: 'p8', hospital_id: H, file_number: 'FM-24508', full_name_ar: 'هند فهد الدوسري', full_name_en: 'Hind Fahad Aldosari', gender: 'female', birth_date: '1956-02-14', phone: '0508888888', national_id: '1012312348', blood_type: 'O+', allergies_json: '[]', critical_alerts_json: JSON.stringify(['فشل كلوي مزمن']), status: 'active', created_by: 'u_reception' },
  ];

  const admissions: DBRows = [
    { id: 'adm1', patient_id: 'p1', bed_id: 'bed-1', ward_id: 'w-1', room: 'W1-1', bed_no: 'B1', department_id: 'd-1', attending_doctor_id: 'u_doctor', admitted_at: daysAgo(3, 8), status: 'active', reason: 'ألم صدري مع ضيق تنفس' },
    { id: 'adm2', patient_id: 'p2', bed_id: 'bed-5', ward_id: 'w-2', room: 'W2-1', bed_no: 'B1', department_id: 'd-1', attending_doctor_id: 'u_doctor2', admitted_at: daysAgo(1, 11), status: 'active', reason: 'رجفان أذني انتيابي' },
    { id: 'adm3', patient_id: 'p3', bed_id: 'bed-9', ward_id: 'w-3', room: 'W3-1', bed_no: 'B1', department_id: 'd-2', attending_doctor_id: 'u_doctor3', admitted_at: daysAgo(5, 7), status: 'active', reason: 'التهاب زائدة دودية حاد' },
    { id: 'adm4', patient_id: 'p4', bed_id: 'bed-6', ward_id: 'w-2', room: 'W2-1', bed_no: 'B2', department_id: 'd-1', attending_doctor_id: 'u_doctor', admitted_at: daysAgo(2, 14), status: 'active', reason: 'التهاب رئوي' },
    { id: 'adm5', patient_id: 'p5', bed_id: 'bed-10', ward_id: 'w-3', room: 'W3-1', bed_no: 'B2', department_id: 'd-2', attending_doctor_id: 'u_doctor3', admitted_at: daysAgo(1, 2), status: 'active', reason: 'سحجة بالركبة بعد سقوط' },
    { id: 'adm6', patient_id: 'p6', bed_id: 'bed-7', ward_id: 'w-2', room: 'W2-2', bed_no: 'B3', department_id: 'd-1', attending_doctor_id: 'u_doctor2', admitted_at: daysAgo(10, 9), status: 'discharged', discharge_type: 'home', discharged_at: daysAgo(8, 12), reason: 'التهاب المسالك البولية' },
    { id: 'adm7', patient_id: 'p7', bed_id: 'bed-13', ward_id: 'w-4', room: 'W4-1', bed_no: 'B1', department_id: 'd-4', attending_doctor_id: 'u_doctor2', admitted_at: daysAgo(1, 20), status: 'active', reason: 'نوبة ربو' },
    { id: 'adm8', patient_id: 'p8', bed_id: 'bed-8', ward_id: 'w-2', room: 'W2-2', bed_no: 'B4', department_id: 'd-1', attending_doctor_id: 'u_doctor', admitted_at: daysAgo(6, 6), status: 'active', reason: 'متابعة فشل كلوي مزمن' },
  ];

  for (const a of admissions) {
    if (a.status === 'active') a.family_pin = generateFamilyPin();
    // سرير التنويم المنتهي لا يبقى مرتبطاً به
    if (a.status !== 'active') a.bed_id = null;
  }
  await insert('patients', patients);
  await insert('admissions', admissions);

  // فريق الرعاية: الطبيب المعالج رئيسي، وطبيب ثانٍ بتخصص آخر لمريضة، وممرض واحد لكل مريض
  const careTeam: DBRows = admissions
    .filter((a) => a.attending_doctor_id)
    .map((a) => ({
      id: `ct-${a.id}`,
      admission_id: a.id,
      user_id: a.attending_doctor_id,
      role: 'doctor',
      is_primary: 1,
      assigned_at: a.admitted_at,
      ended_at: a.status === 'discharged' ? a.discharged_at : null,
      end_reason: a.status === 'discharged' ? 'discharge' : null,
    }));
  careTeam.push({ id: 'ct-adm4-chest', admission_id: 'adm4', user_id: 'u_doctor2', role: 'doctor', specialty: 'أمراض صدرية', is_primary: 0, assigned_at: daysAgo(1, 10) });
  const nurseOf: Record<string, string> = { adm1: 'u_nurse', adm4: 'u_nurse', adm8: 'u_nurse', adm2: 'u_nurse2', adm3: 'u_nurse2', adm7: 'u_nurse2' };
  for (const [adm, user] of Object.entries(nurseOf)) careTeam.push({ id: `ct-${adm}-n`, admission_id: adm, user_id: user, role: 'nurse', is_primary: 0, assigned_at: daysAgo(0, 7) });
  await insert('care_team', careTeam);
  await insert('care_plans', [
    {
      admission_id: 'adm1',
      goals: 'استقرار العلامات الحيوية واستبعاد متلازمة الشريان التاجي الحادة',
      diet: 'قليل الملح',
      activity: 'راحة في السرير أول 24 ساعة',
      monitoring: 'تخطيط قلب كل 12 ساعة، تروبونين كل 6 ساعات',
      nursing_instructions: 'إبلاغ الطبيب فوراً عند ألم صدري أو ضغط انقباضي أقل من 90',
      vitals_interval_hours: 2,
      review_at: daysAgo(-1, 9).slice(0, 10),
      updated_by: 'أحمد المنصور',
      updated_by_id: 'u_doctor',
      updated_at: daysAgo(0, 8),
    },
    {
      admission_id: 'adm4',
      goals: 'علاج الالتهاب الرئوي وتحسن التشبع فوق 94%',
      diet: 'عادي مع سوائل كافية',
      activity: 'المشي بمساعدة',
      monitoring: 'تشبع الأكسجين المستمر',
      nursing_instructions: 'تمارين التنفس كل ساعتين أثناء الاستيقاظ',
      vitals_interval_hours: 4,
      updated_by: 'أحمد المنصور',
      updated_by_id: 'u_doctor',
      updated_at: daysAgo(1, 9),
    },
  ]);
  await db.execute({
    sql: `UPDATE beds SET status = 'occupied' WHERE id IN (SELECT bed_id FROM admissions WHERE status = 'active' AND bed_id IS NOT NULL)`,
    args: [],
  });

  // عناصر السجل الطبقي (إلى جانب timeline) ----------------
  const vitals: DBRows = [];
  const notes: DBRows = [];
  const diagnoses: DBRows = [];
  const medications: DBRows = [];
  const labs: DBRows = [];
  const radiology: DBRows = [];
  const consultations: DBRows = [];
  const procedures: DBRows = [];
  const timeline: DBRows = [];

  const tl = (admissionId: string, actor: string, actorId: string | null, type: string, title_ar: string, title_en: string, created_at: string) => timeline.push({ id: uuid('tl'), admission_id: admissionId, actor, actor_id: actorId, type, title_ar, title_en, created_at });

  const D1 = daysAgo(3, 8);
  tl('adm1', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريض إلى المستشفى', 'Patient admitted', D1);
  vitals.push(
    { id: uuid('vt'), admission_id: 'adm1', recorded_by: 'أحمد المنصور', recorded_at: daysAgo(3, 9), temperature: 38.6, pulse: 96, respiratory_rate: 22, bp_systolic: 158, bp_diastolic: 96, spo2: 94, weight: 82, glucose: null },
    { id: uuid('vt'), admission_id: 'adm1', recorded_by: 'أحمد المنصور', recorded_at: daysAgo(2, 7), temperature: 37.9, pulse: 88, respiratory_rate: 20, bp_systolic: 142, bp_diastolic: 88, spo2: 96, weight: 81.5, glucose: null },
    { id: uuid('vt'), admission_id: 'adm1', recorded_by: 'فاطمة سعيد', recorded_at: iso(-4 * 3600000), temperature: 37.2, pulse: 84, respiratory_rate: 18, bp_systolic: 134, bp_diastolic: 84, spo2: 97, weight: 81, glucose: null },
  );
  notes.push(
    { id: uuid('nt'), admission_id: 'adm1', kind: 'doctor', author_id: 'u_doctor', recorded_at: daysAgo(3, 9), content: 'مريض يشتكي من ألم صدري متوسط الشدة منذ يومين مع ضيق تنفس عند المجهود. تم الطلب على تخطيط قلب ورسم صدر، وبدء علاج مضاد للالتهاب.', corrected_by: null },
    { id: uuid('nt'), admission_id: 'adm1', kind: 'doctor', author_id: 'u_doctor2', recorded_at: daysAgo(2, 10), content: 'تحسنت الحالة العامة، انخفضت الحرارة، الألم الصدري أقل حدة. نتابع خطة العلاج الحالية.', corrected_by: null },
    { id: uuid('nt'), admission_id: 'adm1', kind: 'nursing', author_id: 'u_nurse', recorded_at: daysAgo(3, 18), content: 'تم قياس العلامات الحيوية، المريض مستيقظ ومستقر.', corrected_by: null },
  );
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm1', icd10: 'I10', title_ar: 'فرط ضغط الدم الأساسي', title_en: 'Essential hypertension', status: 'confirmed', added_by: 'أحمد المنصور', created_at: D1 });
  medications.push(
    { id: uuid('md'), admission_id: 'adm1', name_ar: 'أموكسيسيلين/حمض الكلافولانيك', name_en: 'Amoxicillin/Clavulanic acid', dose: '625 مغ', route: 'فموي PO', frequency: 'كل 8 ساعات', start_at: daysAgo(3, 0), end_at: daysAgo(1, 0), status: 'discontinued', prescribed_by: 'أحمد المنصور' },
    { id: uuid('md'), admission_id: 'adm1', name_ar: 'سيروتيد', name_en: 'Seretide', dose: '250/25 مكغ', route: 'استنشاق', frequency: 'مرتين يومياً', start_at: daysAgo(2, 0), end_at: null, status: 'active', prescribed_by: 'أحمد المنصور' },
  );
  labs.push(
    { id: uuid('lb'), admission_id: 'adm1', test_name_ar: 'تعداد الدم الكامل CBC', test_name_en: 'CBC', category: 'دم كامل', ordered_by: 'أحمد المنصور', ordered_at: daysAgo(1, 11), result: '4000؛ Hb 13.2؛ صفائح 220,000', unit: 'خلايا/ميكرولتر', reference_range: '4000-11000', status: 'resulted', resulted_by: 'تركي الجبر', resulted_at: daysAgo(1, 12) },
    { id: uuid('lb'), admission_id: 'adm1', test_name_ar: 'بروتين سي التفاعلي CRP', test_name_en: 'CRP', category: 'سيروم', ordered_by: 'أحمد المنصور', ordered_at: iso(-6 * 3600000), result: '8.4', unit: 'مغ/ل', reference_range: '<5', status: 'resulted', resulted_by: 'تركي الجبر', resulted_at: iso(-5 * 3600000) },
  );
  radiology.push({ id: uuid('rd'), admission_id: 'adm1', study_type: 'X-Ray', study_type_ar: 'أشعة سينية للصدر', study_type_en: 'Chest X-Ray', ordered_by: 'أحمد المنصور', ordered_at: iso(-30 * 3600000), report: 'لا يوجد ارتشاح رئوي، القلب بمعدل طبيعي', status: 'resulted', performed_by: 'إبراهيم حسن', performed_at: iso(-28 * 3600000) });
  consultations.push({ id: uuid('cn'), admission_id: 'adm1', requested_by: 'أحمد المنصور', specialty: 'طب القلب', reason: 'تقييم ألم الصدر وعدم انتظام الضغط', response: 'الفحص القلبي ضمن الحدود الطبيعية، ننصح بمتابعة الضغط يومياً.', requested_at: iso(-24 * 3600000), responded_by: 'عمر النجار', responded_at: iso(-23 * 3600000) });
  procedures.push({ id: uuid('pc'), admission_id: 'adm1', name_ar: 'قسطرة وريدية', name_en: 'IV Cannulation', performed_by: 'فاطمة سعيد', performed_at: iso(-70 * 3600000), notes: 'تم بنجاح' });
  for (const v of vitals) tl('adm1', v.recorded_by as string, null, 'vitals', 'تسجيل علامات حيوية', 'Vitals recorded', v.recorded_at as string);
  tl('adm1', 'أحمد المنصور', 'u_doctor', 'diagnosis', 'إضافة تشخيص: فرط ضغط الدم الأساسي', 'Diagnosis added: Essential hypertension', D1);
  tl('adm1', 'أحمد المنصور', 'u_doctor', 'lab', 'طلب مختبر: CRP', 'Lab ordered: CRP', iso(-6 * 3600000));
  tl('adm1', 'أحمد المنصور', 'u_doctor', 'medication', 'وصف دواء: سيروتيد', 'Medication: Seretide', daysAgo(2, 0));

  // p2 — سجل خفيف
  tl('adm2', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريضة إلى المستشفى', 'Patient admitted', daysAgo(1, 11));
  vitals.push({ id: uuid('vt'), admission_id: 'adm2', recorded_by: 'ليلى حسن', recorded_at: iso(-2 * 3600000), temperature: 36.9, pulse: 76, respiratory_rate: 16, bp_systolic: 118, bp_diastolic: 74, spo2: 98, weight: 60, glucose: null });
  notes.push({ id: uuid('nt'), admission_id: 'adm2', kind: 'doctor', author_id: 'u_doctor2', recorded_at: iso(-3 * 3600000), content: 'قدمت بعش رجفان أذني انتيابي. تم عمل مخطط كهربية القلب وتعديل جرعة مميع الدم.', corrected_by: null });
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm2', icd10: 'I48', title_ar: 'الرجفان الأذيني', title_en: 'Atrial fibrillation', status: 'confirmed', added_by: 'ليلى حسن', created_at: daysAgo(1, 11) });
  medications.push({ id: uuid('md'), admission_id: 'adm2', name_ar: 'وارفارين', name_en: 'Warfarin', dose: '5 مغ', route: 'فموي PO', frequency: 'مساءً', start_at: daysAgo(1, 0), end_at: null, status: 'active', prescribed_by: 'ليلى حسن' });
  labs.push({ id: uuid('lb'), admission_id: 'adm2', test_name_ar: 'الهرمونات والوظائف الكبدية', test_name_en: 'LFT', category: 'سيروم', ordered_by: 'ليلى حسن', ordered_at: iso(-8 * 3600000), result: 'طبيعية ضمن المدى الطبيعي', unit: null, reference_range: null, status: 'resulted', resulted_by: 'تركي الجبر', resulted_at: iso(-7 * 3600000) });

  // p3
  tl('adm3', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريض إلى المستشفى', 'Patient admitted', daysAgo(5, 7));
  vitals.push({ id: uuid('vt'), admission_id: 'adm3', recorded_by: 'عمر النجار', recorded_at: daysAgo(5, 8), temperature: 37.1, pulse: 90, respiratory_rate: 18, bp_systolic: 138, bp_diastolic: 84, spo2: 96, weight: 88, glucose: null });
  notes.push({ id: uuid('nt'), admission_id: 'adm3', kind: 'doctor', author_id: 'u_doctor3', recorded_at: daysAgo(4, 10), content: 'تم استئصال الزائدة الدودية الالتهابية. عملية ناجحة مع ضبط سكر الدم.', corrected_by: null });
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm3', icd10: 'K35', title_ar: 'التهاب الزائدة الدودية الحاد', title_en: 'Acute appendicitis', status: 'confirmed', added_by: 'عمر النجار', created_at: daysAgo(5, 7) });
  medications.push({ id: uuid('md'), admission_id: 'adm3', name_ar: 'باراسيتامول', name_en: 'Paracetamol', dose: '1000 مغ', route: 'فموي PO', frequency: 'عند الحاجة', start_at: daysAgo(4, 0), end_at: null, status: 'active', prescribed_by: 'عمر النجار' });
  procedures.push({ id: uuid('pc'), admission_id: 'adm3', name_ar: 'استئصال الزائدة الدودية', name_en: 'Appendectomy', performed_by: 'عمر النجار', performed_at: daysAgo(4, 6), notes: 'بنج عام، بدون مضاعفات' });

  // p4
  tl('adm4', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريضة إلى المستشفى', 'Patient admitted', daysAgo(2, 14));
  vitals.push({ id: uuid('vt'), admission_id: 'adm4', recorded_by: 'أحمد المنصور', recorded_at: iso(-3 * 3600000), temperature: 38.2, pulse: 102, respiratory_rate: 24, bp_systolic: 150, bp_diastolic: 92, spo2: 93, weight: 70, glucose: null });
  notes.push({ id: uuid('nt'), admission_id: 'adm4', kind: 'doctor', author_id: 'u_doctor', recorded_at: iso(-4 * 3600000), content: 'التهاب رئوي مكتسب، بدء مضاد حيوي بديل عن السيفالوسبورين (حساسية مسجلة).', corrected_by: null });
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm4', icd10: 'J18', title_ar: 'الالتهاب الرئوي', title_en: 'Pneumonia', status: 'confirmed', added_by: 'أحمد المنصور', created_at: daysAgo(2, 14) });
  medications.push({ id: uuid('md'), admission_id: 'adm4', name_ar: 'ليفوفلوكساسين', name_en: 'Levofloxacin', dose: '500 مغ', route: 'فموي PO', frequency: 'يومياً', start_at: daysAgo(2, 0), end_at: null, status: 'active', prescribed_by: 'أحمد المنصور' });
  labs.push({ id: uuid('lb'), admission_id: 'adm4', test_name_ar: 'مزرعة بلغم', test_name_en: 'Sputum culture', category: 'بلغم', ordered_by: 'أحمد المنصور', ordered_at: daysAgo(1, 12), result: null, unit: null, reference_range: null, status: 'in_progress', resulted_by: null, resulted_at: null });

  // p5
  tl('adm5', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريض إلى المستشفى', 'Patient admitted', daysAgo(1, 2));
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm5', icd10: 'S80', title_ar: 'سحجة/جرح سطحي بالركبة', title_en: 'Superficial knee abrasion', status: 'confirmed', added_by: 'عمر النجار', created_at: daysAgo(1, 2) });
  medications.push({ id: uuid('md'), admission_id: 'adm5', name_ar: 'إيبوبروفين', name_en: 'Ibuprofen', dose: '400 مغ', route: 'فموي PO', frequency: 'عند الحاجة', start_at: daysAgo(1, 0), end_at: null, status: 'active', prescribed_by: 'عمر النجار' });

  // p6 — خروج
  tl('adm6', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريضة إلى المستشفى', 'Patient admitted', daysAgo(10, 9));
  tl('adm6', 'ليلى حسن', 'u_doctor2', 'discharge', 'خروج المريضة إلى المنزل', 'Discharged home', daysAgo(8, 12));
  vitals.push(
    { id: uuid('vt'), admission_id: 'adm6', recorded_by: 'ليلى حسن', recorded_at: daysAgo(9, 9), temperature: 37.2, pulse: 78, respiratory_rate: 16, bp_systolic: 122, bp_diastolic: 78, spo2: 97, weight: 65, glucose: null },
    { id: uuid('vt'), admission_id: 'adm6', recorded_by: 'خالد عيد', recorded_at: daysAgo(8, 9), temperature: 36.9, pulse: 74, respiratory_rate: 15, bp_systolic: 118, bp_diastolic: 76, spo2: 98, weight: 65, glucose: null },
  );
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm6', icd10: 'N39', title_ar: 'التهاب المسالك البولية', title_en: 'UTI', status: 'resolved', added_by: 'ليلى حسن', created_at: daysAgo(10, 9) });
  medications.push({ id: uuid('md'), admission_id: 'adm6', name_ar: 'سيفوروكسيم', name_en: 'Cefuroxime', dose: '500 مغ', route: 'فموي PO', frequency: 'مرتين يومياً', start_at: daysAgo(10, 0), end_at: daysAgo(8, 0), status: 'completed', prescribed_by: 'ليلى حسن' });
  labs.push({ id: uuid('lb'), admission_id: 'adm6', test_name_ar: 'تحليل بول', test_name_en: 'Urinalysis', category: 'بول', ordered_by: 'ليلى حسن', ordered_at: daysAgo(9, 10), result: 'طبيعي', unit: null, reference_range: null, status: 'resulted', resulted_by: 'تركي الجبر', resulted_at: daysAgo(9, 12) });

  // p7
  tl('adm7', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريض إلى المستشفى', 'Patient admitted', daysAgo(1, 20));
  vitals.push({ id: uuid('vt'), admission_id: 'adm7', recorded_by: 'ليلى حسن', recorded_at: iso(-2 * 3600000), temperature: 38.1, pulse: 110, respiratory_rate: 26, bp_systolic: null, bp_diastolic: null, spo2: 95, weight: 28, glucose: null });
  notes.push({ id: uuid('nt'), admission_id: 'adm7', kind: 'doctor', author_id: 'u_doctor2', recorded_at: iso(-3 * 3600000), content: 'نوبة ربو، بحاجة لمراقبة وملاحظة موسع القصبات.', corrected_by: null });
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm7', icd10: 'J45', title_ar: 'الربو القصبي', title_en: 'Bronchial asthma', status: 'confirmed', added_by: 'ليلى حسن', created_at: daysAgo(1, 20) });

  // p8
  tl('adm8', 'نورة العلي', 'u_reception', 'admission', 'إدخال المريضة إلى المستشفى', 'Patient admitted', daysAgo(6, 6));
  vitals.push(
    { id: uuid('vt'), admission_id: 'adm8', recorded_by: 'أحمد المنصور', recorded_at: daysAgo(6, 7), temperature: 37.0, pulse: 88, respiratory_rate: 18, bp_systolic: 165, bp_diastolic: 100, spo2: 94, weight: 71, glucose: null },
    { id: uuid('vt'), admission_id: 'adm8', recorded_by: 'فاطمة سعيد', recorded_at: daysAgo(1, 7), temperature: 36.8, pulse: 80, respiratory_rate: 16, bp_systolic: 150, bp_diastolic: 88, spo2: 95, weight: 71, glucose: null },
  );
  diagnoses.push({ id: uuid('dg'), admission_id: 'adm8', icd10: 'N18', title_ar: 'الفشل الكلوي المزمن', title_en: 'Chronic kidney disease', status: 'confirmed', added_by: 'أحمد المنصور', created_at: daysAgo(6, 6) });
  medications.push({ id: uuid('md'), admission_id: 'adm8', name_ar: 'فوروسيمايد', name_en: 'Furosemide', dose: '40 مغ', route: 'فموي PO', frequency: 'صباحاً', start_at: daysAgo(6, 0), end_at: null, status: 'active', prescribed_by: 'أحمد المنصور' });
  labs.push({ id: uuid('lb'), admission_id: 'adm8', test_name_ar: 'وظائف الكلى', test_name_en: 'Renal panel', category: 'سيروم', ordered_by: 'أحمد المنصور', ordered_at: daysAgo(1, 8), result: 'كرياتينين 2.1', unit: 'مغ/دل', reference_range: '0.6-1.2', status: 'abnormal', resulted_by: 'تركي الجبر', resulted_at: daysAgo(1, 9) });

  await insert('vitals', vitals);
  await insert('medical_notes', notes);
  await insert('diagnoses', diagnoses);
  await insert('medications', medications);
  await insert('lab_results', labs);
  await insert('radiology_reports', radiology);
  await insert('consultations', consultations);
  await insert('procedures', procedures);
  await insert('timeline_events', timeline);

  return { users: users.length, patients: patients.length };
}