-- 001_init.sql — الحزمة الأولى: الهوية، الأقسام، السجل الطبي، النظامية

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
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);