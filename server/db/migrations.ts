// ⚠ ملف مُولَّد — لا تعدّله يدوياً.
// المصدر: server/db/migrations/*.sql — بعد إضافة ملف جديد شغّل: npm run db:gen -w @hmsi/api

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "001_init.sql",
    sql: `-- 001_init.sql — الحزمة الأولى: الهوية، الأقسام، السجل الطبي، النظامية

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- الهوية والصلاحيات ----------------------------------------------

CREATE TABLE IF NOT EXISTS hospitals (
  id            TEXT PRIMARY KEY,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  hospital_id   TEXT NOT NULL REFERENCES hospitals(id),
  username      TEXT UNIQUE NOT NULL,
  full_name_ar  TEXT NOT NULL,
  full_name_en  TEXT,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','admin','doctor','nurse','pharmacist','lab','radiology','reception','viewer')),
  email         TEXT,
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  token_hash   TEXT UNIQUE NOT NULL,
  csrf_token   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id          TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wards (
  id            TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  ward_type     TEXT NOT NULL CHECK (ward_type IN ('male','female','mixed'))
);

CREATE TABLE IF NOT EXISTS beds (
  id      TEXT PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES wards(id),
  room    TEXT NOT NULL,
  bed_no  TEXT NOT NULL,
  status  TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied'))
);

-- السجل الطبي ----------------------------------------------

CREATE TABLE IF NOT EXISTS patients (
  id                  TEXT PRIMARY KEY,
  hospital_id         TEXT NOT NULL REFERENCES hospitals(id),
  file_number         TEXT UNIQUE NOT NULL,
  full_name_ar        TEXT NOT NULL,
  full_name_en        TEXT,
  gender              TEXT NOT NULL CHECK (gender IN ('male','female')),
  birth_date          TEXT NOT NULL,
  phone               TEXT,
  national_id         TEXT,
  blood_type          TEXT NOT NULL DEFAULT 'Unknown',
  allergies_json      TEXT NOT NULL DEFAULT '[]',
  critical_alerts_json TEXT NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged','transferred')),
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admissions (
  id                   TEXT PRIMARY KEY,
  patient_id           TEXT NOT NULL REFERENCES patients(id),
  bed_id               TEXT REFERENCES beds(id),
  department_id        TEXT NOT NULL REFERENCES departments(id),
  attending_doctor_id  TEXT REFERENCES users(id),
  admitted_at          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged')),
  discharge_type       TEXT CHECK (discharge_type IN ('home','transfer','death','ama')),
  discharged_at        TEXT,
  reason               TEXT
);

CREATE TABLE IF NOT EXISTS vitals (
  id              TEXT PRIMARY KEY,
  admission_id    TEXT NOT NULL REFERENCES admissions(id),
  recorded_by     TEXT NOT NULL,
  recorded_at     TEXT NOT NULL,
  temperature     REAL,
  pulse           REAL,
  respiratory_rate REAL,
  bp_systolic     INTEGER,
  bp_diastolic    INTEGER,
  spo2            INTEGER,
  weight          REAL,
  glucose         REAL
);

CREATE TABLE IF NOT EXISTS medical_notes (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  kind          TEXT NOT NULL CHECK (kind IN ('doctor','nursing')),
  author_id     TEXT NOT NULL REFERENCES users(id),
  recorded_at   TEXT NOT NULL,
  content       TEXT NOT NULL,
  corrected_by  TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  icd10         TEXT,
  title_ar      TEXT NOT NULL,
  title_en      TEXT,
  status        TEXT NOT NULL DEFAULT 'suspected' CHECK (status IN ('suspected','confirmed','resolved')),
  added_by      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medications (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  name_ar       TEXT NOT NULL,
  name_en       TEXT,
  dose          TEXT,
  route         TEXT,
  frequency     TEXT,
  start_at      TEXT,
  end_at        TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discontinued','completed')),
  prescribed_by TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_results (
  id              TEXT PRIMARY KEY,
  admission_id    TEXT NOT NULL REFERENCES admissions(id),
  test_name_ar    TEXT NOT NULL,
  test_name_en    TEXT,
  category        TEXT,
  ordered_by      TEXT NOT NULL,
  ordered_at      TEXT NOT NULL,
  result          TEXT,
  unit            TEXT,
  reference_range TEXT,
  status          TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in_progress','resulted','abnormal')),
  resulted_by     TEXT,
  resulted_at     TEXT
);

CREATE TABLE IF NOT EXISTS radiology_reports (
  id             TEXT PRIMARY KEY,
  admission_id   TEXT NOT NULL REFERENCES admissions(id),
  study_type     TEXT NOT NULL,
  study_type_ar  TEXT,
  study_type_en  TEXT,
  ordered_by     TEXT NOT NULL,
  ordered_at     TEXT NOT NULL,
  report         TEXT,
  status         TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in_progress','resulted')),
  performed_by   TEXT,
  performed_at   TEXT
);

CREATE TABLE IF NOT EXISTS consultations (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  requested_by  TEXT NOT NULL,
  specialty     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  response      TEXT,
  requested_at  TEXT NOT NULL,
  responded_by  TEXT,
  responded_at  TEXT
);

CREATE TABLE IF NOT EXISTS procedures (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  name_ar       TEXT NOT NULL,
  name_en       TEXT,
  performed_by  TEXT NOT NULL,
  performed_at  TEXT NOT NULL,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id           TEXT PRIMARY KEY,
  admission_id TEXT NOT NULL REFERENCES admissions(id),
  uploaded_by  TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  storage_key  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  actor_id      TEXT REFERENCES users(id),
  actor         TEXT NOT NULL,
  type          TEXT NOT NULL,
  title_ar      TEXT NOT NULL,
  title_en      TEXT,
  created_at    TEXT NOT NULL
);

-- النظامية -------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  meta_json     TEXT NOT NULL DEFAULT '{}',
  ip            TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id          TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL DEFAULT '{}',
  UNIQUE (hospital_id, key)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  ip           TEXT,
  success      INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الفهارس ---------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_patients_file_number ON patients(file_number);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_id ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_timeline_admission_id ON timeline_events(admission_id);
CREATE INDEX IF NOT EXISTS idx_vitals_admission_id ON vitals(admission_id);
CREATE INDEX IF NOT EXISTS idx_beds_ward_id ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);`,
  },
  {
    id: "002_add_ward_id.sql",
    sql: `ALTER TABLE admissions ADD COLUMN ward_id TEXT REFERENCES wards(id);
ALTER TABLE admissions ADD COLUMN room TEXT;
ALTER TABLE admissions ADD COLUMN bed_no TEXT;`,
  },
  {
    id: "003_add_attachment_data.sql",
    sql: `ALTER TABLE attachments ADD COLUMN data TEXT;`,
  },
  {
    id: "004_patient_archive.sql",
    sql: `ALTER TABLE patients ADD COLUMN archived_at TEXT;`,
  },
  {
    id: "005_bed_code_public.sql",
    sql: `-- 005_bed_code_public.sql — كود باركود ثابت لكل سرير لصفحة التتبع العامة

ALTER TABLE beds ADD COLUMN code TEXT;

UPDATE beds
SET code = 'b' || substr(lower(hex(randomblob(8))), 1, 12)
WHERE code IS NULL OR code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_beds_code ON beds(code);`,
  },
  {
    id: "006_family_tracking_superadmin.sql",
    sql: `-- 006 — متابعة ذوي المريض (QR + رمز عائلة)، ملخص الخروج، المدير العام، إصلاح أكواد الأسرّة

ALTER TABLE admissions ADD COLUMN discharge_summary TEXT;
ALTER TABLE admissions ADD COLUMN family_pin TEXT;
ALTER TABLE sessions ADD COLUMN active_hospital_id TEXT REFERENCES hospitals(id);
ALTER TABLE hospitals ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- أسرّة زُرعت بعد 005 بدون كود
UPDATE beds
SET code = 'b' || substr(lower(hex(randomblob(8))), 1, 12)
WHERE code IS NULL OR code = '';

-- رمز عائلة لكل تنويم نشط حالي
UPDATE admissions
SET family_pin = printf('%06d', abs(random()) % 1000000)
WHERE status = 'active' AND family_pin IS NULL;

-- حالة الأسرّة يجب أن تطابق التنويمات النشطة
UPDATE beds SET status = 'free';
UPDATE beds SET status = 'occupied'
WHERE id IN (SELECT bed_id FROM admissions WHERE status = 'active' AND bed_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`,
  },
  {
    id: "007_dispense.sql",
    sql: `-- 007 — صرف الأدوية من الصيدلية
ALTER TABLE medications ADD COLUMN dispensed_by TEXT;
ALTER TABLE medications ADD COLUMN dispensed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_logs(actor_id);
`,
  },
  {
    id: "008_nursing_mar.sql",
    sql: `-- 008 — سجلات التمريض: مقياس الألم ومستوى الوعي (لحساب MEWS)، ميزان السوائل، وسجل إعطاء الأدوية (MAR)
ALTER TABLE vitals ADD COLUMN pain_score INTEGER;
-- AVPU: alert / voice / pain / unresponsive
ALTER TABLE vitals ADD COLUMN consciousness TEXT;

CREATE TABLE IF NOT EXISTS fluid_entries (
  id            TEXT PRIMARY KEY,
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  direction     TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind          TEXT NOT NULL,
  volume_ml     INTEGER NOT NULL,
  note          TEXT,
  recorded_by   TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fluid_entries_admission ON fluid_entries(admission_id, recorded_at);

CREATE TABLE IF NOT EXISTS medication_administrations (
  id               TEXT PRIMARY KEY,
  medication_id    TEXT NOT NULL REFERENCES medications(id),
  admission_id     TEXT NOT NULL REFERENCES admissions(id),
  status           TEXT NOT NULL CHECK (status IN ('given', 'held', 'refused')),
  note             TEXT,
  administered_by  TEXT NOT NULL,
  administered_by_id TEXT,
  administered_at  TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_med_admin_admission ON medication_administrations(admission_id, administered_at);
CREATE INDEX IF NOT EXISTS idx_med_admin_medication ON medication_administrations(medication_id);
`,
  },
  {
    id: "009_family_share.sql",
    sql: `-- 009 — ما يراه ذوو المريض في صفحة المتابعة يحدده الطاقم لكل تنويم
-- family_share: JSON بالفئات المسموحة، مثل {"vitals":true,"labs":true}. الافتراضي: العلامات الحيوية فقط (السلوك السابق)
ALTER TABLE admissions ADD COLUMN family_share TEXT NOT NULL DEFAULT '{"vitals":true}';
-- رسالة من الطاقم إلى ذوي المريض (نص حر)
ALTER TABLE admissions ADD COLUMN family_message TEXT;
ALTER TABLE admissions ADD COLUMN family_message_by TEXT;
ALTER TABLE admissions ADD COLUMN family_message_at TEXT;
`,
  },
  {
    id: "010_trash.sql",
    sql: `-- 010 — سلة المحذوفات: لا حذف نهائي. كل سجل محذوف يُنقل كاملاً (JSON) إلى هنا،
-- ويستعيده مدير المستشفى فقط، ويمكن لبقية الطاقم طلب الاستعادة من داخل النظام.
CREATE TABLE IF NOT EXISTS trash (
  id                       TEXT PRIMARY KEY,
  hospital_id              TEXT NOT NULL,
  table_name               TEXT NOT NULL,
  record_id                TEXT NOT NULL,
  -- mode: delete = الصف حُذف ويُعاد إدخاله عند الاستعادة؛ archive = المريض مؤرشف ويُلغى الأرشفة
  mode                     TEXT NOT NULL DEFAULT 'delete' CHECK (mode IN ('delete', 'archive')),
  kind                     TEXT NOT NULL,
  label                    TEXT NOT NULL,
  patient_id               TEXT,
  admission_id             TEXT,
  data_json                TEXT NOT NULL,
  deleted_by               TEXT NOT NULL,
  deleted_by_id            TEXT,
  deleted_at               TEXT NOT NULL,
  restore_requested_by     TEXT,
  restore_requested_by_id  TEXT,
  restore_requested_at     TEXT,
  restore_request_note     TEXT,
  restored_by              TEXT,
  restored_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_trash_hospital ON trash(hospital_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_trash_record ON trash(table_name, record_id);
`,
  },
  {
    id: "011_hospital_logo.sql",
    sql: `-- 011 — شعار المستشفى (يُخزَّن في القاعدة كباقي الملفات، بحد 300KB، PNG/JPEG/WEBP)
ALTER TABLE hospitals ADD COLUMN logo_data TEXT;
ALTER TABLE hospitals ADD COLUMN logo_mime TEXT;
ALTER TABLE hospitals ADD COLUMN logo_updated_at TEXT;
`,
  },
  {
    id: "012_signup_subscription.sql",
    sql: `-- 012 — التسجيل الذاتي للمستشفيات، الفترة التجريبية (14 يوماً)، الاشتراك، ومعلومات الدفع
-- المستشفيات الحالية: الحقلان NULL = وصول غير محدود (لا يتغير عليها شيء)
ALTER TABLE hospitals ADD COLUMN trial_ends_at TEXT;
ALTER TABLE hospitals ADD COLUMN subscription_ends_at TEXT;
ALTER TABLE hospitals ADD COLUMN signup_source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE hospitals ADD COLUMN contact_name TEXT;
ALTER TABLE hospitals ADD COLUMN contact_phone TEXT;
ALTER TABLE hospitals ADD COLUMN contact_email TEXT;
ALTER TABLE hospitals ADD COLUMN city TEXT;

-- إعدادات عامة للنظام (مثل معلومات الدفع) يضبطها المدير العام
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT
);

-- إشعارات الدفع التي يرسلها مدير المستشفى بعد التحويل، ويراجعها المدير العام
CREATE TABLE IF NOT EXISTS payment_notices (
  id            TEXT PRIMARY KEY,
  hospital_id   TEXT NOT NULL REFERENCES hospitals(id),
  amount        TEXT NOT NULL,
  method        TEXT NOT NULL,
  reference     TEXT,
  note          TEXT,
  submitted_by  TEXT NOT NULL,
  submitted_at  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   TEXT,
  reviewed_at   TEXT,
  review_note   TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_notices_status ON payment_notices(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_payment_notices_hospital ON payment_notices(hospital_id, submitted_at);
`,
  },
  {
    id: "013_security.sql",
    sql: `-- 013 — أمان الحسابات والجلسات
-- تغيير إجباري لكلمة المرور: كلمة مرور مؤقتة (أنشأها/أعادها المدير) أو ضعيفة/معروفة (مثل password123)
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
-- التحقق بخطوتين (TOTP): السر مشفّر بمفتاح الخادم، ورموز الاسترداد مجزّأة (hash)
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_recovery_json TEXT;
-- الخروج التلقائي عند الخمول: آخر نشاط للجلسة
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;

-- الخطوة الثانية من الدخول: تذكرة قصيرة العمر بعد صحة كلمة المرور
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT UNIQUE NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    id: "014_allergy_override.sql",
    sql: `-- 014 — تجاوز تحذير الحساسية عند وصف دواء: السبب والتعارضات ومن تجاوز ومتى (JSON)
ALTER TABLE medications ADD COLUMN allergy_override_json TEXT;
`,
  },
  {
    id: "015_monitoring.sql",
    sql: `-- 015 — مراقبة الأخطاء: أخطاء الخادم والواجهة (منقّحة من الأسرار والأرقام الطويلة)
-- الخطأ المتكرر يُجمع في صف واحد (fingerprint) مع عدّاد وآخر ظهور
CREATE TABLE IF NOT EXISTS error_events (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL CHECK (source IN ('server','client','job')),
  fingerprint  TEXT NOT NULL,
  message      TEXT NOT NULL,
  detail       TEXT,
  path         TEXT,
  hospital_id  TEXT,
  user_id      TEXT,
  user_agent   TEXT,
  count        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_events_fp ON error_events(fingerprint, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_error_events_seen ON error_events(last_seen_at);
`,
  },
  {
    id: "016_totp_replay.sql",
    sql: `-- 016 — التحقق بخطوتين: آخر خطوة زمنية مستخدمة (يمنع إعادة استخدام نفس الرمز خلال نافذته)
ALTER TABLE users ADD COLUMN totp_last_step INTEGER;
`,
  },
  {
    id: "017_notifications.sql",
    sql: `-- 017 — الإشعارات داخل النظام (الجرس): نتائج غير طبيعية، MEWS مرتفع، طلبات جديدة، طلبات استعادة
-- الهدف: مستخدم محدد (target_user_id) أو أدوار في المستشفى (target_roles: قائمة مفصولة بفواصل)
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id),
  target_user_id TEXT REFERENCES users(id),
  target_roles   TEXT,
  kind           TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title_ar       TEXT NOT NULL,
  title_en       TEXT,
  body_ar        TEXT,
  body_en        TEXT,
  link           TEXT,
  admission_id   TEXT,
  created_by_id  TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_hospital ON notifications(hospital_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(target_user_id, created_at);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL REFERENCES notifications(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  read_at         TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);
`,
  },
  {
    id: "018_handover.sql",
    sql: `-- 018 — تسليم المناوبة: ملاحظات SBAR لكل مريض منوّم
-- (الوضع الحالي، الخلفية، التقييم، التوصيات للمناوبة القادمة)
CREATE TABLE IF NOT EXISTS handover_notes (
  id             TEXT PRIMARY KEY,
  admission_id   TEXT NOT NULL REFERENCES admissions(id),
  situation      TEXT NOT NULL,
  background     TEXT,
  assessment     TEXT,
  recommendation TEXT,
  author         TEXT NOT NULL,
  author_id      TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_handover_admission ON handover_notes(admission_id, created_at);
`,
  },
  {
    id: "019_care_team.sql",
    sql: `-- 019 — فريق الرعاية، تسليم واستلام التمريض، الخطة العلاجية، الوصول الطارئ

-- فريق رعاية التنويم: أكثر من طبيب (تخصصات متعددة) وممرض واحد فعّال فقط لكل مريض
CREATE TABLE IF NOT EXISTS care_team (
  id              TEXT PRIMARY KEY,
  admission_id    TEXT NOT NULL REFERENCES admissions(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  role            TEXT NOT NULL CHECK (role IN ('doctor','nurse')),
  specialty       TEXT,
  is_primary      INTEGER NOT NULL DEFAULT 0,
  assigned_by_id  TEXT,
  assigned_at     TEXT NOT NULL,
  ended_at        TEXT,
  end_reason      TEXT
);
CREATE INDEX IF NOT EXISTS idx_care_team_user ON care_team(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_care_team_admission ON care_team(admission_id, ended_at);
-- لا يُعيَّن ممرضان على نفس المريض في الوقت نفسه
CREATE UNIQUE INDEX IF NOT EXISTS ux_care_team_one_nurse ON care_team(admission_id) WHERE role = 'nurse' AND ended_at IS NULL;
-- لا يتكرر نفس الشخص فعّالاً في الفريق
CREATE UNIQUE INDEX IF NOT EXISTS ux_care_team_member ON care_team(admission_id, user_id) WHERE ended_at IS NULL;

-- الطبيب المعالج الحالي لكل تنويم نشط يصبح الطبيب الرئيسي في الفريق
INSERT INTO care_team (id, admission_id, user_id, role, is_primary, assigned_at)
  SELECT 'ct-' || a.id, a.id, a.attending_doctor_id, 'doctor', 1, a.admitted_at
  FROM admissions a WHERE a.attending_doctor_id IS NOT NULL;

-- تسليم واستلام المرضى بين الممرضين: لا ينتقل المريض حتى يقبل المستلم
CREATE TABLE IF NOT EXISTS nurse_handovers (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id),
  from_user_id   TEXT NOT NULL REFERENCES users(id),
  to_user_id     TEXT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  note           TEXT,
  response_note  TEXT,
  created_at     TEXT NOT NULL,
  responded_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_nurse_handovers_to ON nurse_handovers(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_nurse_handovers_from ON nurse_handovers(from_user_id, status);

CREATE TABLE IF NOT EXISTS nurse_handover_items (
  handover_id   TEXT NOT NULL REFERENCES nurse_handovers(id),
  admission_id  TEXT NOT NULL REFERENCES admissions(id),
  PRIMARY KEY (handover_id, admission_id)
);

-- الخطة العلاجية لكل تنويم (نسخة حالية واحدة؛ التغييرات في الخط الزمني والتدقيق)
CREATE TABLE IF NOT EXISTS care_plans (
  admission_id          TEXT PRIMARY KEY REFERENCES admissions(id),
  goals                 TEXT,
  diet                  TEXT,
  activity              TEXT,
  monitoring            TEXT,
  nursing_instructions  TEXT,
  vitals_interval_hours INTEGER,
  review_at             TEXT,
  updated_by            TEXT NOT NULL,
  updated_by_id         TEXT,
  updated_at            TEXT NOT NULL
);

-- الوصول الطارئ: طبيب يفتح ملف مريض ليس من مرضاه بسبب مكتوب، لمدة محدودة ومع تدقيق
CREATE TABLE IF NOT EXISTS access_grants (
  id          TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  reason      TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_grants_user ON access_grants(user_id, patient_id, expires_at);
`,
  },
];
