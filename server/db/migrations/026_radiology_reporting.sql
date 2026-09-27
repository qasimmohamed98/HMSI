-- 026 — المرحلة 2ج: قوالب تقارير جاهزة، ملحق (Addendum) على التقرير المعتمد بدل تعديله، وعلم النتيجة الحرجة
ALTER TABLE radiology_reports ADD COLUMN critical INTEGER NOT NULL DEFAULT 0;
ALTER TABLE radiology_reports ADD COLUMN addendum TEXT;
ALTER TABLE radiology_reports ADD COLUMN addendum_by TEXT;
ALTER TABLE radiology_reports ADD COLUMN addendum_by_id TEXT;
ALTER TABLE radiology_reports ADD COLUMN addendum_at TEXT;

CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  modality TEXT,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  body_ar TEXT NOT NULL,
  body_en TEXT,
  created_by TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_templates_hosp ON report_templates(hospital_id, modality);
