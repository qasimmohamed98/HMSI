-- 008 — سجلات التمريض: مقياس الألم ومستوى الوعي (لحساب MEWS)، ميزان السوائل، وسجل إعطاء الأدوية (MAR)
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
