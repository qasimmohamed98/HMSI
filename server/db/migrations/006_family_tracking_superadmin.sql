-- 006 — متابعة ذوي المريض (QR + رمز عائلة)، ملخص الخروج، المدير العام، إصلاح أكواد الأسرّة

ALTER TABLE admissions ADD COLUMN discharge_summary TEXT;
ALTER TABLE admissions ADD COLUMN family_pin TEXT;
ALTER TABLE sessions ADD COLUMN active_hospital_id TEXT REFERENCES hospitals(id);
ALTER TABLE hospitals ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- أسرّة زُرعت بعد 005 بدون كود
UPDATE beds
SET code = 'b' || substr(lower(hex(randomblob(8))), 1, 12)
WHERE code IS NULL OR code = '';

-- رمز عائلة لكل تنويم نشط حالي
UPDATE admissions
SET family_pin = printf('%06d', abs(random()) % 1000000)
WHERE status = 'active' AND family_pin IS NULL;

-- حالة الأسرّة يجب أن تطابق التنويمات النشطة
UPDATE beds SET status = 'free';
UPDATE beds SET status = 'occupied'
WHERE id IN (SELECT bed_id FROM admissions WHERE status = 'active' AND bed_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
