-- 021 — الموافقة على شروط الاستخدام وسياسة الخصوصية
-- كل موظف يوافق عند أول دخول (وعند كل تغيير جوهري: رقم الإصدار TERMS_VERSION في packages/shared)
ALTER TABLE users ADD COLUMN terms_version INTEGER;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
-- المستشفى المسجَّل ذاتياً: موافقة من سجّله نيابة عنه
ALTER TABLE hospitals ADD COLUMN terms_version INTEGER;
ALTER TABLE hospitals ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE hospitals ADD COLUMN terms_accepted_by TEXT;
