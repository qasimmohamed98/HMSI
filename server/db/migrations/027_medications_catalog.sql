-- 027 — المرحلة 3: قائمة الأدوية المعتمدة (Formulary). لا تُلغي الاسم الحر — تقترحه وتوثّقه.
CREATE TABLE IF NOT EXISTS medications_catalog (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  generic_name_ar TEXT NOT NULL,
  generic_name_en TEXT,
  brand_name_ar TEXT,
  brand_name_en TEXT,
  form TEXT NOT NULL,
  strength TEXT,
  route TEXT,
  /** مخدرة أو مؤثرات عقلية — سجل ومراقبة إضافية لاحقاً (المرحلة 3ب) */
  controlled INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medcat_hosp ON medications_catalog(hospital_id, generic_name_ar);

-- الدواء الموصوف يحمل مرجع القائمة (إن اختير منها) ونسخة من علم «خاضع للرقابة» وقت الوصف
ALTER TABLE medications ADD COLUMN catalog_id TEXT;
ALTER TABLE medications ADD COLUMN controlled INTEGER NOT NULL DEFAULT 0;
