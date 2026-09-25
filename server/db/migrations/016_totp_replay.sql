-- 016 — التحقق بخطوتين: آخر خطوة زمنية مستخدمة (يمنع إعادة استخدام نفس الرمز خلال نافذته)
ALTER TABLE users ADD COLUMN totp_last_step INTEGER;
