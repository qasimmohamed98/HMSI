-- 024 — من طلب الفحص (لإبلاغه عند اكتمال النتيجة) + مرفقات مرتبطة بفحص محدد (تقرير أشعة، نتيجة مختبر)
ALTER TABLE radiology_reports ADD COLUMN ordered_by_id TEXT;
ALTER TABLE lab_results ADD COLUMN ordered_by_id TEXT;
ALTER TABLE attachments ADD COLUMN record_type TEXT CHECK (record_type IN ('radiology','lab'));
ALTER TABLE attachments ADD COLUMN record_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id);
