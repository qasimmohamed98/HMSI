-- 014 — تجاوز تحذير الحساسية عند وصف دواء: السبب والتعارضات ومن تجاوز ومتى (JSON)
ALTER TABLE medications ADD COLUMN allergy_override_json TEXT;
