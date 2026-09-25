-- 013 — أمان الحسابات والجلسات
-- تغيير إجباري لكلمة المرور: كلمة مرور مؤقتة (أنشأها/أعادها المدير) أو ضعيفة/معروفة (مثل password123)
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
-- التحقق بخطوتين (TOTP): السر مشفّر بمفتاح الخادم، ورموز الاسترداد مجزّأة (hash)
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_recovery_json TEXT;
-- الخروج التلقائي عند الخمول: آخر نشاط للجلسة
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;

-- الخطوة الثانية من الدخول: تذكرة قصيرة العمر بعد صحة كلمة المرور
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT UNIQUE NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
