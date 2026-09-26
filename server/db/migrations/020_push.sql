-- 020 — إشعارات الدفع (Web Push): تصل للجهاز حتى والنظام مغلق

-- اشتراك كل جهاز (متصفح/تطبيق مثبت) لمستخدم؛ الجهاز الواحد لمستخدم واحد فقط في كل وقت
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  hospital_id      TEXT NOT NULL REFERENCES hospitals(id),
  endpoint         TEXT NOT NULL UNIQUE,
  p256dh           TEXT NOT NULL,
  auth             TEXT NOT NULL,
  lang             TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en')),
  -- all: كل التنبيهات، important: التحذيرات والحرجة، critical: الحرجة فقط
  level            TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all','important','critical')),
  device           TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_success_at  TEXT,
  fail_count       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- مفاتيح VAPID للخادم (تُولَّد تلقائياً مرة واحدة؛ متغيرات البيئة VAPID_* تتقدم عليها إن وُجدت)
CREATE TABLE IF NOT EXISTS push_keys (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  public_key  TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- تنبيهات المواعيد (جرعات/علامات حيوية) التي أُرسلت للأجهزة — حتى لا تتكرر
CREATE TABLE IF NOT EXISTS schedule_alerts_sent (
  key      TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL,
  sent_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_alerts_sent_at ON schedule_alerts_sent(sent_at);
