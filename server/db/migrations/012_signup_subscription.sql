-- 012 — التسجيل الذاتي للمستشفيات، الفترة التجريبية (14 يوماً)، الاشتراك، ومعلومات الدفع
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
