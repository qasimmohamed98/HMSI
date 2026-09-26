-- 023 — «تذكّر هذا الجهاز»: بعد رمز التحقق بخطوتين لا يُطلب الرمز على الجهاز نفسه 30 يوماً
-- الرمز في ملف ارتباط HttpOnly على الجهاز، والقاعدة تحفظ بصمته فقط. يُلغى بتغيير كلمة المرور أو إيقاف التحقق أو إعادة ضبطه.
CREATE TABLE IF NOT EXISTS trusted_devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  token_hash    TEXT NOT NULL UNIQUE,
  label         TEXT,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  last_used_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
