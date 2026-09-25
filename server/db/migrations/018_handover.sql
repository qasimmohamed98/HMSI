-- 018 — تسليم المناوبة: ملاحظات SBAR لكل مريض منوّم
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
