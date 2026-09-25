-- 011 — شعار المستشفى (يُخزَّن في القاعدة كباقي الملفات، بحد 300KB، PNG/JPEG/WEBP)
ALTER TABLE hospitals ADD COLUMN logo_data TEXT;
ALTER TABLE hospitals ADD COLUMN logo_mime TEXT;
ALTER TABLE hospitals ADD COLUMN logo_updated_at TEXT;
