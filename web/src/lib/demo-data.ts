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
  Attachment,
  TimelineEvent,
  Ward,
  Bed,
  AdmissionSummary,
  Department,
} from '@hmsi/shared';

export interface AdmissionRecord {
  admission: AdmissionSummary;
  vitals: Vitals[];
  notes: MedicalNote[];
  diagnoses: Diagnosis[];
  medications: Medication[];
  labs: LabResult[];
  radiology: RadiologyReport[];
  consultations: Consultation[];
  procedures: Procedure[];
  attachments: Attachment[];
  timeline: TimelineEvent[];
}

export interface DemoStore {
  users: (User & { password: string })[];
  patients: Record<string, { patient: Patient; record: AdmissionRecord | null }>;
  departments: Department[];
  wards: Ward[];
  hospital: {
    id: string;
    name_ar: string;
    name_en: string;
    code: string;
    created_at: string;
  };
  activity: TimelineEvent[];
  currentUser: User | null;
  sideEffects: number;
}

export class DemoDepartmentNotFound extends Error {}

export const DEMO_DEPARTMENTS: { id: string; name_ar: string; name_en: string }[] = [
  { id: 'd-1', name_ar: 'الباطنية', name_en: 'Internal Medicine' },
  { id: 'd-2', name_ar: 'الجراحة', name_en: 'Surgery' },
  { id: 'd-3', name_ar: 'الطوارئ', name_en: 'Emergency' },
  { id: 'd-4', name_ar: 'طب الأطفال', name_en: 'Pediatrics' },
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const hoursAgo = (h: number) => {
  const d = new Date(Date.now() - h * 3600_000);
  return d.toISOString();
};
const iso = (d: Date) => d.toISOString();

let uid = 0;
const id = (p: string) => `${p}-${(++uid).toString(36).padStart(4, '0')}`;

export function createDemoStore(): DemoStore {
  const doctors = [
    { id: 'usr-dr-ahmad', nameAr: 'د. أحمد المنصور', nameEn: 'Dr. Ahmad Almansour' },
    { id: 'usr-dr-laila', nameAr: 'د. ليلى حسن', nameEn: 'Dr. Laila Hasan' },
    { id: 'usr-dr-omar', nameAr: 'د. عمر النجار', nameEn: 'Dr. Omar Alnajjar' },
  ];
  const nurses = [
    { id: 'usr-ns-fatima', nameAr: 'م. فاطمة سعيد', nameEn: 'F. Saeed' },
    { id: 'usr-ns-khalid', nameAr: 'م. خالد عيد', nameEn: 'K. Eid' },
  ];

  const users: (User & { password: string })[] = [
    { id: 'usr-super', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'admin', full_name_ar: 'مدير النظام', full_name_en: 'System Admin', email: 'admin@hms.local', role: 'super_admin', is_active: true, created_at: daysAgo(400), password: 'password123' },
    { id: doctors[0].id, hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'doctor', full_name_ar: doctors[0].nameAr, full_name_en: doctors[0].nameEn, email: 'doctor@hms.local', role: 'doctor', is_active: true, created_at: daysAgo(300), password: 'password123' },
    { id: nurses[0].id, hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'nurse', full_name_ar: nurses[0].nameAr, full_name_en: nurses[0].nameEn, email: 'nurse@hms.local', role: 'nurse', is_active: true, created_at: daysAgo(280), password: 'password123' },
    { id: 'usr-doc2', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'doctor2', full_name_ar: doctors[1].nameAr, full_name_en: doctors[1].nameEn, email: 'doctor2@hms.local', role: 'doctor', is_active: true, created_at: daysAgo(250), password: 'password123' },
    { id: 'usr-doc3', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'doctor3', full_name_ar: doctors[2].nameAr, full_name_en: doctors[2].nameEn, email: 'doctor3@hms.local', role: 'doctor', is_active: true, created_at: daysAgo(200), password: 'password123' },
    { id: nurses[1].id, hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'nurse2', full_name_ar: nurses[1].nameAr, full_name_en: nurses[1].nameEn, email: 'nurse2@hms.local', role: 'nurse', is_active: true, created_at: daysAgo(180), password: 'password123' },
    { id: 'usr-ph', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'pharmacist', full_name_ar: 'ص. سامي عودة', full_name_en: 'Sami Awdah', email: 'ph@hms.local', role: 'pharmacist', is_active: true, created_at: daysAgo(150), password: 'password123' },
    { id: 'usr-lab', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'lab', full_name_ar: 'ف. تركي الجبر', full_name_en: 'Turki Aljabr', email: 'lab@hms.local', role: 'lab', is_active: true, created_at: daysAgo(140), password: 'password123' },
    { id: 'usr-rad', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'radiology', full_name_ar: 'ف. إبراهيم حسن', full_name_en: 'Ibrahim Hasan', email: 'rad@hms.local', role: 'radiology', is_active: true, created_at: daysAgo(120), password: 'password123' },
    { id: 'usr-rec', hospital_id: 'h-1', hospital_name_ar: 'مستشفى المدينة الجامعي', hospital_name_en: 'City University Hospital', username: 'reception', full_name_ar: 'استقبال. نورة العلي', full_name_en: 'Noura Alali', email: 'rec@hms.local', role: 'reception', is_active: true, created_at: daysAgo(100), password: 'password123' },
  ];

  const wards: Ward[] = [
    {
      id: 'w-1',
      department_id: 'd-1',
      department_name_ar: 'الباطنية',
      department_name_en: 'Internal Medicine',
      name_ar: 'ردهة الرجال – الباطنية',
      name_en: 'Internal – Male Ward',
      type: 'male',
      beds: makeBeds('w-1', 12, 'R1'),
    },
    {
      id: 'w-2',
      department_id: 'd-1',
      department_name_ar: 'الباطنية',
      department_name_en: 'Internal Medicine',
      name_ar: 'ردهة النساء – الباطنية',
      name_en: 'Internal – Female Ward',
      type: 'female',
      beds: makeBeds('w-2', 10, 'R2'),
    },
    {
      id: 'w-3',
      department_id: 'd-2',
      department_name_ar: 'الجراحة',
      department_name_en: 'Surgery',
      name_ar: 'ردهة الجراحة',
      name_en: 'Surgery Ward',
      type: 'mixed',
      beds: makeBeds('w-3', 8, 'S1'),
    },
    {
      id: 'w-4',
      department_id: 'd-3',
      department_name_ar: 'الطوارئ',
      department_name_en: 'Emergency',
      name_ar: 'ردهة الأطفال',
      name_en: 'Pediatrics Ward',
      type: 'mixed',
      beds: makeBeds('w-4', 6, 'P1'),
    },
  ];

  const mkAdm = (
    adm: Omit<AdmissionSummary, 'id'>,
    vitals: Vitals[] = [],
    notes: MedicalNote[] = [],
    diagnoses: Diagnosis[] = [],
    medications: Medication[] = [],
    labs: LabResult[] = [],
    radiology: RadiologyReport[] = [],
    consultations: Consultation[] = [],
    procedures: Procedure[] = [],
    attachments: Attachment[] = [],
  ): AdmissionRecord => {
    const admissionId = id('adm');
    const admFull: AdmissionSummary = { id: admissionId, ...adm };
    const timeline: TimelineEvent[] = [];
    timeline.push({
      id: id('tl'),
      admission_id: admissionId,
      actor: 'استقبال (نورة العلي)',
      type: 'admission',
      title_ar: 'إدخال المريض إلى المستشفى',
      title_en: 'Patient admitted',
      created_at: adm.admitted_at,
    });
    vitals.forEach((v) =>
      timeline.push({ id: id('tl'), admission_id: admissionId, actor: v.recorded_by, type: 'vitals', title_ar: 'تسجيل علامات حيوية', title_en: 'Vitals recorded', created_at: v.recorded_at }),
    );
    notes.forEach((n) =>
      timeline.push({ id: id('tl'), admission_id: admissionId, actor: n.author, type: 'note', title_ar: n.kind === 'doctor' ? 'ملاحظة طبية' : 'ملاحظة تمريض', title_en: n.kind === 'doctor' ? 'Doctor note' : 'Nursing note', created_at: n.recorded_at }),
    );
    diagnoses.forEach((dg) =>
      timeline.push({ id: id('tl'), admission_id: admissionId, actor: dg.added_by, type: 'diagnosis', title_ar: 'إضافة تشخيص: ' + dg.title_ar, title_en: 'Diagnosis added: ' + (dg.title_en ?? dg.title_ar), created_at: adm.admitted_at }),
    );
    labs.forEach((l) =>
      timeline.push({ id: id('tl'), admission_id: admissionId, actor: l.ordered_by, type: 'lab', title_ar: 'طلب مختبر: ' + l.test_name_ar, title_en: 'Lab ordered: ' + l.test_name_ar, created_at: l.ordered_at }),
    );
    medications.forEach((m) =>
      timeline.push({ id: id('tl'), admission_id: admissionId, actor: m.prescribed_by, type: 'medication', title_ar: 'وصف دواء: ' + m.name_ar, title_en: 'Medication: ' + m.name_ar, created_at: adm.admitted_at }),
    );
    return { admission: admFull, vitals, notes, diagnoses, medications, labs, radiology, consultations, procedures, attachments, timeline };
  };

  const maleP = (i: number, nameAr: string, nameEn: string, age: number, allergies: string[] = [], alerts: string[] = []) =>
    mkPatient('male', i, nameAr, nameEn, age, allergies, alerts);
  const femaleP = (i: number, nameAr: string, nameEn: string, age: number, allergies: string[] = [], alerts: string[] = []) =>
    mkPatient('female', i, nameAr, nameEn, age, allergies, alerts);

  function mkPatient(gender: 'male' | 'female', i: number, nameAr: string, nameEn: string, age: number, allergies: string[], alerts: string[]) {
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - age);
    return {
      id: id('pat'),
      hospital_id: 'h-1',
      file_number: `FM-${24500 + i}`,
      full_name_ar: nameAr,
      full_name_en: nameEn,
      gender,
      birth_date: birth.toISOString().slice(0, 10),
      phone: `05${String(10000000 + i * 137913).slice(-8)}`,
      national_id: `${i}${String(1042367510 + i * 113).slice(-9)}`,
      blood_type: (['A+', 'O+', 'B+', 'AB-', 'O-', 'A-'] as const)[i % 6],
      allergies_json: JSON.stringify(allergies),
      critical_alerts_json: JSON.stringify(alerts),
      status: 'active',
      created_at: daysAgo(30 + i * 3),
    } as Patient;
  }

  function makeBeds(wardId: string, count: number, prefix: string) {
    const beds: Bed[] = [];
    for (let i = 1; i <= count; i++) {
      beds.push({ id: id('bed'), ward_id: wardId, room: `${prefix}-${Math.ceil(i / 2)}`, bed_no: `B${i}`, status: 'free', code: 'b' + Math.random().toString(36).slice(2, 14) });
    }
    return beds;
  }

  const patients: DemoStore['patients'] = {};

  const p1 = maleP(1, 'محمد علي كريم', 'Mohammed Ali Karim', 54, ['بنسلين (Penicillin)'], ['حساسية بنسلين مسجلة']);
  patients[p1.id] = {
    patient: p1,
    record: mkAdm(
      {
        department_id: 'd-1',
        department_name_ar: 'الباطنية',
        department_name_en: 'Internal Medicine',
        ward_id: 'w-1',
        ward_name_ar: 'ردهة الرجال – الباطنية',
        ward_name_en: 'Internal – Male Ward',
        room: 'R1-1',
        bed_no: 'B1',
        attending_doctor: doctors[0].nameAr,
        admitted_at: daysAgo(3) + 'T08:30:00.000Z',
        status: 'active',
      },
      [
        mkVitals('w-1', doctors[0], daysAgo(3) + 'T09:00:00.000Z', 38.6, 96, 22, 158, 96, 94, 82),
        mkVitals('w-1', doctors[0], daysAgo(2) + 'T07:45:00.000Z', 37.9, 88, 20, 142, 88, 96, 81.5),
        mkVitals('w-1', doctors[0], hoursAgo(4), 37.2, 84, 18, 134, 84, 97, 81),
      ],
      [
        mkn('doctor', 'w-1', doctors[0], daysAgo(3) + 'T09:30:00.000Z', 'مريض يشتكي من ألم صدري متوسط الشدة منذ يومين مع ضيق تنفس عند المجهود. تم الطلب على تخطيط قلب ورسم صدر، وبدء علاج مضاد للالتهاب. متابعة العلامات الحيوية كل 6 ساعات.'),
        mkn('doctor', 'w-1', doctors[1], daysAgo(2) + 'T10:00:00.000Z', 'تحسنت الحالة العامة، انخفضت الحرارة، الألم الصدري أقل حدة. يتحمل الغذاء. نتابع خطة العلاج الحالية.'),
        mkn('nursing', 'w-1', doctors[0], daysAgo(3) + 'T18:00:00.000Z', 'تم قياس العلامات الحيوية، المريض مستيقظ ومستقر. لا توجد شكاوى جديدة.'),
      ],
      [mkDiag('w-1', doctors[0], 'I10', 'فرط ضغط الدم الأساسي', 'Essential hypertension', 'confirmed')],
      [
        mkMed('w-1', doctors[0], 'أموكسيسيلين/حمض الكلافولانيك', 'Amoxicillin/Clavulanic acid', '625 مغ', 'فموي PO', 'كل 8 ساعات', daysAgo(3), daysAgo(1), 'discontinued'),
        mkMed('w-1', doctors[0], 'سيروتيد', 'Seretide', '250/25 مكغ', 'استنشاق', 'مرتين يومياً', daysAgo(2), null, 'active'),
      ],
      [
        mkLab('w-1', doctors[0], 'تعداد الدم الكامل CBC', 'CBC', 'دم كامل', '4000؛ Hb 13.2؛ صفائح 220,000', 'خلايا/ميكرولتر', '4000-11000', daysAgo(1) + 'T11:00:00.000Z'),
        mkLab('w-1', doctors[0], 'بروتين سي التفاعلي CRP', 'CRP', 'سيروم', '8.4', 'مغ/ل', '<5', hoursAgo(6)),
      ],
      [mkRad('w-1', doctors[0], 'أشعة سينية للصدر', 'Chest X-Ray', 'لا يوجد ارتشاح رئوي، القلب بمعدل طبيعي', hoursAgo(30))],
      [mkCons('w-1', doctors[0], 'طب القلب', 'تقييم ألم الصدر وعدم انتظام الضغط', 'الفحص القلبي ضمن الحدود الطبيعية، ننصح بمتابعة الضغط يومياً.', hoursAgo(24))],
      [mkProc('w-1', doctors[0], 'قسطرة وريدية', 'IV Cannulation', 'تم بنجاح', hoursAgo(70))],
    ),
  };

  const p2 = femaleP(2, 'سارة أحمد يوسف', 'Sara Ahmad Yousef', 32, [], []);
  patients[p2.id] = {
    patient: p2,
    record: mkAdm(
      {
        department_id: 'd-1',
        department_name_ar: 'الباطنية',
        department_name_en: 'Internal Medicine',
        ward_id: 'w-2',
        ward_name_ar: 'ردهة النساء – الباطنية',
        ward_name_en: 'Internal – Female Ward',
        room: 'R2-1',
        bed_no: 'B1',
        attending_doctor: doctors[1].nameAr,
        admitted_at: daysAgo(1) + 'T11:00:00.000Z',
        status: 'active',
      },
      [mkVitals('w-2', doctors[1], hoursAgo(2), 36.9, 76, 16, 118, 74, 98, 60)],
      [mkn('doctor', 'w-2', doctors[1], hoursAgo(3), 'قدمت بعش رجفان أذني انتيابي. تم عمل مخطط كهربية القلب، وتعديل جرعة مميع الدم. استجابة جيدة.')],
      [mkDiag('w-2', doctors[1], 'I48', 'الرجفان الأذيني', 'Atrial fibrillation', 'confirmed')],
      [mkMed('w-2', doctors[1], 'وارفارين', 'Warfarin', '5 مغ', 'فموي PO', 'مساءً', daysAgo(1), null, 'active')],
      [mkLab('w-2', doctors[1], 'الهرمونات والوظائف الكبدية', 'LFT', 'سيروم', 'طبيعية ضمن المدى الطبيعي', '', '', hoursAgo(8))],
      [],
      [],
      [],
      [],
    ),
  };

  const p3 = maleP(3, 'خالد محمد العتيبي', 'Khalid Mohammed Alotaibi', 61, [], ['السكري النوع 2']);
  patients[p3.id] = {
    patient: p3,
    record: mkAdm(
      {
        department_id: 'd-2',
        department_name_ar: 'الجراحة',
        department_name_en: 'Surgery',
        ward_id: 'w-3',
        ward_name_ar: 'ردهة الجراحة',
        ward_name_en: 'Surgery Ward',
        room: 'S1-1',
        bed_no: 'B1',
        attending_doctor: doctors[2].nameAr,
        admitted_at: daysAgo(5) + 'T07:00:00.000Z',
        status: 'active',
      },
      [
        mkVitals('w-3', doctors[2], daysAgo(5) + 'T08:00:00.000Z', 37.1, 90, 18, 138, 84, 96, 88),
        mkVitals('w-3', doctors[2], daysAgo(4) + 'T09:00:00.000Z', 36.8, 82, 17, 130, 80, 97, 87),
        mkVitals('w-3', doctors[2], hoursAgo(5), 36.7, 80, 16, 126, 78, 98, 86.4),
      ],
      [
        mkn('doctor', 'w-3', doctors[2], daysAgo(4) + 'T10:00:00.000Z', 'تم استئصال الزائدة الدودية الالتهابية. عملية ناجحة، مريض مستقر بعد العملية مع ضبط سكر الدم.'),
        mkn('nursing', 'w-3', doctors[2], hoursAgo(6), 'جرح العملية نظيف بدون إفرازات، خياطة سليمة.'),
      ],
      [mkDiag('w-3', doctors[2], 'K35', 'التهاب الزائدة الدودية الحاد', 'Acute appendicitis', 'confirmed')],
      [
        mkMed('w-3', doctors[2], 'باراسيتامول', 'Paracetamol', '1000 مغ', 'فموي PO', 'عند الحاجة', daysAgo(4), null, 'active'),
        mkMed('w-3', doctors[2], 'إنسولين جارجين', 'Insulin glargine', '20 وحدة', 'تحت الجلد SC', 'مساءً', daysAgo(4), null, 'active'),
      ],
      [mkLab('w-3', doctors[2], 'تعداد الدم الكامل CBC', 'CBC', 'دم كامل', 'WBC 11,200', 'خلايا/ميكرولتر', '4000-11000', daysAgo(4) + 'T10:30:00.000Z')],
      [],
      [],
      [mkProc('w-3', doctors[2], 'استئصال الزائدة الدودية', 'Appendectomy', 'بنج عام، بدون مضاعفات', daysAgo(4) + 'T06:30:00.000Z')],
    ),
  };

  const p4 = femaleP(4, 'فاطمة عبدالله السالم', 'Fatimah Abdullah Alsalem', 45, ['سيفالوسبورين'], []);
  patients[p4.id] = {
    patient: p4,
    record: mkAdm(
      {
        department_id: 'd-1',
        department_name_ar: 'الباطنية',
        department_name_en: 'Internal Medicine',
        ward_id: 'w-2',
        ward_name_ar: 'ردهة النساء – الباطنية',
        ward_name_en: 'Internal – Female Ward',
        room: 'R2-2',
        bed_no: 'B2',
        attending_doctor: doctors[0].nameAr,
        admitted_at: daysAgo(2) + 'T14:00:00.000Z',
        status: 'active',
      },
      [mkVitals('w-2', doctors[0], hoursAgo(3), 38.2, 102, 24, 150, 92, 93, 70)],
      [mkn('doctor', 'w-2', doctors[0], hoursAgo(4), 'التهاب رئوي مكتسب، بدء مضاد حيوي بديل عن السيفالوسبورين (حساسية مسجلة). متابعة قريبة.')],
      [mkDiag('w-2', doctors[0], 'J18', 'الالتهاب الرئوي', 'Pneumonia', 'confirmed')],
      [mkMed('w-2', doctors[0], 'ليفوفلوكساسين', 'Levofloxacin', '500 مغ', 'فموي PO', 'يومياً', daysAgo(2), null, 'active')],
      [mkLab('w-2', doctors[0], 'مزرعة بلغم', 'Sputum culture', 'بلغم', 'تحت القراءة', '', '', daysAgo(1) + 'T12:00:00.000Z')],
      [],
      [],
      [],
      [],
    ),
  };

  const p5 = maleP(5, 'عمر ناصر الحربي', 'Omar Nasser Alharbi', 28);
  patients[p5.id] = {
    patient: p5,
    record: mkAdm(
      {
        department_id: 'd-3',
        department_name_ar: 'الطوارئ',
        department_name_en: 'Emergency',
        ward_id: 'w-3',
        ward_name_ar: 'ردهة الجراحة',
        ward_name_en: 'Surgery Ward',
        room: 'S1-2',
        bed_no: 'B2',
        attending_doctor: doctors[2].nameAr,
        admitted_at: daysAgo(1) + 'T02:00:00.000Z',
        status: 'active',
      },
      [mkVitals('w-3', doctors[2], hoursAgo(1), 36.6, 72, 15, 120, 76, 98)],
      [mkn('doctor', 'w-3', doctors[2], hoursAgo(2), 'رشة سير على الركبة، تم تضميد الجرح، مراقبة علامات الالتهاب.')],
      [mkDiag('w-3', doctors[2], 'S80', 'سحجة/جرح سطحي بالركبة', 'Superficial knee abrasion', 'confirmed')],
      [mkMed('w-3', doctors[2], 'إيبوبروفين', 'Ibuprofen', '400 مغ', 'فموي PO', 'عند الحاجة', daysAgo(1), null, 'active')],
      [],
      [],
      [],
      [],
      [],
    ),
  };

  // Discharged patient (for discharge section demo)
  const p6 = femaleP(6, 'نوره سعد القحطاني', 'Noura Saad Alqahtani', 38);
  const p6adm: AdmissionRecord = mkAdm(
    {
      department_id: 'd-1',
      department_name_ar: 'الباطنية',
      department_name_en: 'Internal Medicine',
      ward_id: 'w-2',
      ward_name_ar: 'ردهة النساء – الباطنية',
      ward_name_en: 'Internal – Female Ward',
      room: 'R2-3',
      bed_no: 'B3',
      attending_doctor: doctors[1].nameAr,
      admitted_at: daysAgo(10) + 'T09:00:00.000Z',
      status: 'discharged',
    },
    [
      mkVitals('w-2', doctors[1], daysAgo(9) + 'T09:00:00.000Z', 37.2, 78, 16, 122, 78, 97),
      mkVitals('w-2', doctors[1], daysAgo(8) + 'T09:00:00.000Z', 36.9, 74, 15, 118, 76, 98),
    ],
    [mkn('doctor', 'w-2', doctors[1], daysAgo(9) + 'T10:00:00.000Z', 'التهاب المسالك البولية، استجابت للمضاد الحيوي، الحالة استقرت.')],
    [mkDiag('w-2', doctors[1], 'N39', 'التهاب المسالك البولية', 'UTI', 'resolved')],
    [mkMed('w-2', doctors[1], 'سيفوروكسيم', 'Cefuroxime', '500 مغ', 'فموي PO', 'مرتين يومياً', daysAgo(10), daysAgo(8), 'completed')],
    [mkLab('w-2', doctors[1], 'تحليل بول', 'Urinalysis', 'بول', 'طبيعي', '', '', daysAgo(9) + 'T10:30:00.000Z')],
    [],
    [],
    [],
    [],
  );
  p6adm.timeline.push({
    id: id('tl'),
    admission_id: p6adm.admission.id,
    actor: doctors[1].nameAr,
    type: 'discharge',
    title_ar: 'خروج المريضة إلى المنزل',
    title_en: 'Discharged home',
    created_at: daysAgo(8) + 'T12:00:00.000Z',
  });
  p6.status = 'discharged';
  patients[p6.id] = { patient: p6, record: p6adm };

  // Two more active for numbers
  const p7 = maleP(7, 'يوسف إبراهيم الشمري', 'Yousef Ibrahim Alshammari', 9, [], ['قصر نفس']);
  patients[p7.id] = {
    patient: p7,
    record: mkAdm(
      {
        department_id: 'd-3',
        department_name_ar: 'طب الأطفال',
        department_name_en: 'Pediatrics',
        ward_id: 'w-4',
        ward_name_ar: 'ردهة الأطفال',
        ward_name_en: 'Pediatrics Ward',
        room: 'P1-1',
        bed_no: 'B1',
        attending_doctor: doctors[1].nameAr,
        admitted_at: daysAgo(1) + 'T20:00:00.000Z',
        status: 'active',
      },
      [mkVitals('w-4', doctors[1], hoursAgo(2), 38.1, 110, 26, null, null, 95)],
      [mkn('doctor', 'w-4', doctors[1], hoursAgo(3), 'نوبة ربو، بحاجة لمراقبة وملاحظة الرذاذ الموسع للقصبات.')],
      [mkDiag('w-4', doctors[1], 'J45', 'الربو القصبي', 'Bronchial asthma', 'confirmed')],
      [mkMed('w-4', doctors[1], 'فنتولين', 'Ventolin', '100 مكغ', 'استنشاق', 'عند الحاجة', daysAgo(1), null, 'active')],
      [],
      [],
      [],
      [],
      [],
    ),
  };

  const p8 = femaleP(8, 'هند فهد الدوسري', 'Hind Fahad Aldosari', 70, [], ['فشل كلوي مزمن']);
  patients[p8.id] = {
    patient: p8,
    record: mkAdm(
      {
        department_id: 'd-1',
        department_name_ar: 'الباطنية',
        department_name_en: 'Internal Medicine',
        ward_id: 'w-2',
        ward_name_ar: 'ردهة النساء – الباطنية',
        ward_name_en: 'Internal – Female Ward',
        room: 'R2-4',
        bed_no: 'B4',
        attending_doctor: doctors[0].nameAr,
        admitted_at: daysAgo(6) + 'T06:00:00.000Z',
        status: 'active',
      },
      [
        mkVitals('w-2', doctors[0], daysAgo(6) + 'T07:00:00.000Z', 37.0, 88, 18, 165, 100, 94),
        mkVitals('w-2', doctors[0], daysAgo(1) + 'T07:00:00.000Z', 36.8, 80, 16, 150, 88, 95),
      ],
      [mkn('doctor', 'w-2', doctors[0], daysAgo(1) + 'T09:00:00.000Z', 'مراقبة وظائف الكلى وسوائل الجسم، تعديل جرعة الدواء حسب الكرياتينين.')],
      [mkDiag('w-2', doctors[0], 'N18', 'الفشل الكلوي المزمن', 'Chronic kidney disease', 'confirmed')],
      [mkMed('w-2', doctors[0], 'فوروسيمايد', 'Furosemide', '40 مغ', 'فموي PO', 'صباحاً', daysAgo(6), null, 'active')],
      [mkLab('w-2', doctors[0], 'وظائف الكلى', 'Renal panel', 'سيروم', 'كرياتينين 2.1', 'مغ/دل', '0.6-1.2', daysAgo(1) + 'T08:00:00.000Z')],
      [],
      [],
      [],
      [],
    ),
  };

  const activity: TimelineEvent[] = [];
  Object.values(patients).forEach(({ record }) => {
    if (record) activity.push(...record.timeline);
  });
  activity.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    users,
    patients,
    departments: DEMO_DEPARTMENTS.map((d) => ({ ...d, hospital_id: 'h-1' })),
    wards,
    hospital: { id: 'h-1', name_ar: 'مستشفى المدينة الجامعي', name_en: 'City University Hospital', code: 'H-1', created_at: daysAgo(400) },
    activity,
    currentUser: null,
    sideEffects: 0,
  };
}

function mkVitals(
  ward: string,
  _author: { nameAr: string },
  at: string,
  temperature = 37,
  pulse = 80,
  respiratoryRate = 16,
  bpSystolic: number | null = 120,
  bpDiastolic: number | null = 80,
  spo2 = 98,
  weight = 70,
  glucose: number | null = null,
): Vitals {
  void ward;
  return {
    id: id('vit'),
    admission_id: '',
    recorded_at: at,
    temperature,
    pulse,
    respiratory_rate: respiratoryRate,
    bp_systolic: bpSystolic,
    bp_diastolic: bpDiastolic,
    spo2,
    weight,
    glucose,
    recorded_by: _author.nameAr,
  };
}

function mkn(kind: 'doctor' | 'nursing', ward: string, author: { nameAr: string }, at: string, content: string): MedicalNote {
  void ward;
  return { id: id('note'), admission_id: '', kind, author: author.nameAr, recorded_at: at, content, corrected_by: null };
}

function mkDiag(ward: string, author: { nameAr: string }, icd10: string, titleAr: string, titleEn: string, status: 'suspected' | 'confirmed' | 'resolved'): Diagnosis {
  void ward;
  return { id: id('diag'), admission_id: '', icd10, title_ar: titleAr, title_en: titleEn, status, added_by: author.nameAr };
}

function mkMed(ward: string, author: { nameAr: string }, nameAr: string, nameEn: string, dose: string, route: string, frequency: string, startAt: string, endAt: string | null, status: 'active' | 'discontinued' | 'completed'): Medication {
  void ward;
  return { id: id('med'), admission_id: '', name_ar: nameAr, name_en: nameEn, dose, route, frequency, start_at: startAt, end_at: endAt, status, prescribed_by: author.nameAr };
}

function mkLab(ward: string, author: { nameAr: string }, nameAr: string, nameEn: string, category: string, result: string, unit: string, reference: string, at: string): LabResult {
  void ward;
  return {
    id: id('lab'),
    admission_id: '',
    test_name_ar: nameAr,
    test_name_en: nameEn,
    category,
    ordered_by: author.nameAr,
    ordered_at: at,
    result,
    unit,
    reference_range: reference,
    status: result && !result.includes('تحت') ? 'resulted' : 'in_progress',
    resulted_by: 'ف. تركي الجبر',
    resulted_at: result && !result.includes('تحت') ? at : null,
  };
}

function mkRad(ward: string, author: { nameAr: string }, studyAr: string, studyEn: string, report: string, at: string): RadiologyReport {
  void ward;
  return { id: id('rad'), admission_id: '', study_type_ar: studyAr, study_type_en: studyEn, ordered_by: author.nameAr, ordered_at: at, report, status: 'resulted', performed_by: 'ف. إبراهيم حسن' };
}

function mkCons(ward: string, author: { nameAr: string }, specialty: string, reason: string, response: string, at: string): Consultation {
  void ward;
  return { id: id('cons'), admission_id: '', specialty, reason, response, requested_by: author.nameAr, requested_at: at, responded_by: author.nameAr, responded_at: at };
}

function mkProc(ward: string, author: { nameAr: string }, nameAr: string, nameEn: string, notes: string, at: string): Procedure {
  void ward;
  return { id: id('proc'), admission_id: '', name_ar: nameAr, name_en: nameEn, notes, performed_by: author.nameAr, performed_at: at };
}

export const jsonParse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export { iso };