-- 028 — التدرج الوظيفي: لكل قسم مدير (مدير الصيدلة، مدير الأشعة، مدير المختبر...) يتبع نظام المستشفيات العراقي.
-- المرحلة الحالية (أ): تعيين مدير القسم + إلحاق الموظفين بقسم، ومنح مدير القسم صلاحية إدارة موظفي قسمه فقط
-- (تعيين/تعديل/تعطيل/إعادة تعيين كلمة مرور) دون منحه صلاحية «users.manage» الشاملة على كل المستشفى.
ALTER TABLE departments ADD COLUMN head_user_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_user_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
