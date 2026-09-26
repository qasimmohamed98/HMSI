-- 025 — طلب الأشعة كطلب حقيقي (docs/PLAN_DEPARTMENTS.md، المرحلة 2): فحص من الكتالوج، أولوية، استطباب،
-- أسئلة الأمان، مراحل التنفيذ. الأعمدة القديمة تبقى (status: ordered/in_progress/resulted، performed_by = كاتب التقرير).
ALTER TABLE radiology_reports ADD COLUMN service_id TEXT;
ALTER TABLE radiology_reports ADD COLUMN modality TEXT;
ALTER TABLE radiology_reports ADD COLUMN priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat'));
ALTER TABLE radiology_reports ADD COLUMN indication TEXT;
ALTER TABLE radiology_reports ADD COLUMN safety_json TEXT;
ALTER TABLE radiology_reports ADD COLUMN stage TEXT NOT NULL DEFAULT 'ordered' CHECK (stage IN ('ordered','scheduled','performed','reported','verified','cancelled'));
ALTER TABLE radiology_reports ADD COLUMN unit_id TEXT;
ALTER TABLE radiology_reports ADD COLUMN scheduled_at TEXT;
ALTER TABLE radiology_reports ADD COLUMN exam_done_by TEXT;
ALTER TABLE radiology_reports ADD COLUMN exam_done_by_id TEXT;
ALTER TABLE radiology_reports ADD COLUMN exam_done_at TEXT;
ALTER TABLE radiology_reports ADD COLUMN exam_note TEXT;
ALTER TABLE radiology_reports ADD COLUMN verified_by TEXT;
ALTER TABLE radiology_reports ADD COLUMN verified_at TEXT;
-- السجلات الحالية: المنتهية = معتمدة (لم تكن هناك مرحلة اعتماد)، وقيد التنفيذ = نُفّذت
UPDATE radiology_reports SET stage = 'verified' WHERE status = 'resulted';
UPDATE radiology_reports SET stage = 'performed' WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_radiology_stage ON radiology_reports(stage, priority, ordered_at);
