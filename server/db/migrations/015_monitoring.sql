-- 015 — مراقبة الأخطاء: أخطاء الخادم والواجهة (منقّحة من الأسرار والأرقام الطويلة)
-- الخطأ المتكرر يُجمع في صف واحد (fingerprint) مع عدّاد وآخر ظهور
CREATE TABLE IF NOT EXISTS error_events (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL CHECK (source IN ('server','client','job')),
  fingerprint  TEXT NOT NULL,
  message      TEXT NOT NULL,
  detail       TEXT,
  path         TEXT,
  hospital_id  TEXT,
  user_id      TEXT,
  user_agent   TEXT,
  count        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_events_fp ON error_events(fingerprint, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_error_events_seen ON error_events(last_seen_at);
