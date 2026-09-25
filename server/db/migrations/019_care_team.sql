-- 019 — فريق الرعاية، تسليم واستلام التمريض، الخطة العلاجية، الوصول الطارئ

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
