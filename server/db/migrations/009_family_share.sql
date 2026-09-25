-- 009 — ما يراه ذوو المريض في صفحة المتابعة يحدده الطاقم لكل تنويم
-- family_share: JSON بالفئات المسموحة، مثل {"vitals":true,"labs":true}. الافتراضي: العلامات الحيوية فقط (السلوك السابق)
ALTER TABLE admissions ADD COLUMN family_share TEXT NOT NULL DEFAULT '{"vitals":true}';
-- رسالة من الطاقم إلى ذوي المريض (نص حر)
ALTER TABLE admissions ADD COLUMN family_message TEXT;
ALTER TABLE admissions ADD COLUMN family_message_by TEXT;
ALTER TABLE admissions ADD COLUMN family_message_at TEXT;
