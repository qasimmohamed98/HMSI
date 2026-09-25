-- 017 — الإشعارات داخل النظام (الجرس): نتائج غير طبيعية، MEWS مرتفع، طلبات جديدة، طلبات استعادة
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
