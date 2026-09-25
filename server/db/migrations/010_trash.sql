-- 010 — سلة المحذوفات: لا حذف نهائي. كل سجل محذوف يُنقل كاملاً (JSON) إلى هنا،
-- ويستعيده مدير المستشفى فقط، ويمكن لبقية الطاقم طلب الاستعادة من داخل النظام.
CREATE TABLE IF NOT EXISTS trash (
  id                       TEXT PRIMARY KEY,
  hospital_id              TEXT NOT NULL,
  table_name               TEXT NOT NULL,
  record_id                TEXT NOT NULL,
  -- mode: delete = الصف حُذف ويُعاد إدخاله عند الاستعادة؛ archive = المريض مؤرشف ويُلغى الأرشفة
  mode                     TEXT NOT NULL DEFAULT 'delete' CHECK (mode IN ('delete', 'archive')),
  kind                     TEXT NOT NULL,
  label                    TEXT NOT NULL,
  patient_id               TEXT,
  admission_id             TEXT,
  data_json                TEXT NOT NULL,
  deleted_by               TEXT NOT NULL,
  deleted_by_id            TEXT,
  deleted_at               TEXT NOT NULL,
  restore_requested_by     TEXT,
  restore_requested_by_id  TEXT,
  restore_requested_at     TEXT,
  restore_request_note     TEXT,
  restored_by              TEXT,
  restored_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_trash_hospital ON trash(hospital_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_trash_record ON trash(table_name, record_id);
