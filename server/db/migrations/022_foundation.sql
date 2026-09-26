-- 022 — الأساس المشترك للتوسعة (docs/PLAN_DEPARTMENTS.md، المرحلة 1)
-- 1) أدوار جديدة: طبيب أشعة، أمين مخزن، محاسب (SQLite لا يعدّل CHECK إلا بإعادة بناء الجدول)
-- 2) أنواع الزيارات: التنويم صار نوعاً من «الزيارة» (مراجع، طوارئ، فحص فقط)
-- 3) أنواع الأقسام ووحداتها (غرف وأجهزة)
-- 4) كتالوج الخدمات والأسعار لكل مستشفى
-- 5) مرفقات على القرص بدل قاعدة البيانات (storage_key يبدأ بـ fs:)

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  hospital_id   TEXT NOT NULL REFERENCES hospitals(id),
  username      TEXT UNIQUE NOT NULL,
  full_name_ar  TEXT NOT NULL,
  full_name_en  TEXT,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','admin','doctor','nurse','pharmacist','lab','radiology','radiologist','storekeeper','accountant','reception','viewer')),
  email         TEXT,
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_recovery_json TEXT,
  totp_last_step INTEGER,
  terms_version INTEGER,
  terms_accepted_at TEXT
);
INSERT INTO users_new (id, hospital_id, username, full_name_ar, full_name_en, role, email, password_hash, is_active, created_at,
                       must_change_password, totp_secret, totp_enabled, totp_recovery_json, totp_last_step, terms_version, terms_accepted_at)
  SELECT id, hospital_id, username, full_name_ar, full_name_en, role, email, password_hash, is_active, created_at,
         must_change_password, totp_secret, totp_enabled, totp_recovery_json, totp_last_step, terms_version, terms_accepted_at
  FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys = ON;

-- الزيارات: الصفوف الحالية كلها تنويم
ALTER TABLE admissions ADD COLUMN encounter_type TEXT NOT NULL DEFAULT 'inpatient' CHECK (encounter_type IN ('inpatient','outpatient','emergency','diagnostic'));
ALTER TABLE admissions ADD COLUMN referral_source TEXT;
ALTER TABLE admissions ADD COLUMN referring_doctor TEXT;
ALTER TABLE admissions ADD COLUMN referral_note TEXT;
ALTER TABLE admissions ADD COLUMN created_by_id TEXT;
CREATE INDEX IF NOT EXISTS idx_admissions_type_status ON admissions(encounter_type, status);

-- أنواع الأقسام
ALTER TABLE departments ADD COLUMN kind TEXT NOT NULL DEFAULT 'clinical' CHECK (kind IN ('clinical','radiology','lab','pharmacy','store','operating','emergency','outpatient','dialysis','physio','icu','admin','other'));

-- وحدات القسم: غرف وأجهزة (المفراس 1، الرنين 1.5T، سونار غرفة 3…)
CREATE TABLE IF NOT EXISTS department_units (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id),
  department_id  TEXT NOT NULL REFERENCES departments(id),
  kind           TEXT NOT NULL DEFAULT 'device' CHECK (kind IN ('device','room')),
  modality       TEXT,
  name_ar        TEXT NOT NULL,
  name_en        TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','out_of_service')),
  notes          TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_department_units_dept ON department_units(department_id);

-- كتالوج الخدمات والأسعار
CREATE TABLE IF NOT EXISTS services (
  id             TEXT PRIMARY KEY,
  hospital_id    TEXT NOT NULL REFERENCES hospitals(id),
  kind           TEXT NOT NULL CHECK (kind IN ('lab','imaging','procedure','consultation','bed','other')),
  code           TEXT NOT NULL,
  name_ar        TEXT NOT NULL,
  name_en        TEXT,
  modality       TEXT,
  body_part      TEXT,
  department_id  TEXT REFERENCES departments(id),
  price          INTEGER,
  prep_ar        TEXT,
  prep_en        TEXT,
  meta_json      TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (hospital_id, code)
);
CREATE INDEX IF NOT EXISTS idx_services_hospital_kind ON services(hospital_id, kind, is_active);

-- المستشفى: العملة وتفعيل الأجزاء الاختيارية (فوترة، مشتريات…) — JSON قابل للتوسعة
ALTER TABLE hospitals ADD COLUMN currency TEXT NOT NULL DEFAULT 'IQD';
ALTER TABLE hospitals ADD COLUMN sector TEXT CHECK (sector IN ('government','private'));
