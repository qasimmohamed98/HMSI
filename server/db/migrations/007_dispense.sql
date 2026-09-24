-- 007 — صرف الأدوية من الصيدلية
ALTER TABLE medications ADD COLUMN dispensed_by TEXT;
ALTER TABLE medications ADD COLUMN dispensed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_logs(actor_id);
