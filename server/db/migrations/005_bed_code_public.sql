-- 005_bed_code_public.sql — كود باركود ثابت لكل سرير لصفحة التتبع العامة

ALTER TABLE beds ADD COLUMN code TEXT;

UPDATE beds
SET code = 'b' || substr(lower(hex(randomblob(8))), 1, 12)
WHERE code IS NULL OR code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_beds_code ON beds(code);