# 4. Database Architecture

## المحرك
**Turso (libsql)** — قاعدة SQLite موزّعة، Server-Side فقط. التوكن لا يصل للـ Frontend أبداً.
الوصول عبر `@libsql/client` بـ Parameterized Queries.

## المخطط (Schema)

### الهوية والصلاحيات
| Table | أبرز الأعمدة |
|---|---|
| `hospitals` | id, name_ar, name_en, code, settings_json |
| `users` | id, hospital_id, username, full_name_ar, full_name_en, role, email, **password_hash(Argon2id)**, is_active, created_at |
| `sessions` | id, user_id, token_hash, csrf_token, expires_at, created_at, ip, user_agent |
| `departments` | id, hospital_id, name_ar, name_en |
| `wards` | id, department_id, name_ar, name_en, type ('male'/'female'/'mixed') |
| `beds` | id, ward_id, room, bed_no, status |

### السجل الطبي
| Table | أبرز الأعمدة |
|---|---|
| `patients` | id, hospital_id, file_number, full_name_ar, full_name_en, gender, birth_date, phone, national_id, blood_type, allergies_json, critical_alerts_json, status, created_by |
| `admissions` | id, patient_id, bed_id, department_id, attending_doctor_id, admitted_at, status ('active'/'discharged'), discharge_type, discharged_at, reason |
| `vitals` | id, admission_id, recorded_by, recorded_at, temperature, pulse, respiratory_rate, bp_systolic, bp_diastolic, spo2, weight, glucose |
| `medical_notes` | id, admission_id, kind ('doctor'/'nursing'), author_id, recorded_at, content, corrected_by (nullable → **Correction Event**) |
| `diagnoses` | id, admission_id, icd10, title_ar, title_en, status ('suspected'/'confirmed'/'resolved'), added_by |
| `medications` | id, admission_id, name_ar, name_en, dose, route, frequency, start_at, end_at, status, prescribed_by |
| `lab_results` | id, admission_id, test_name_ar/en, category, ordered_by, ordered_at, result, unit, reference_range, status, resulted_by, resulted_at |
| `radiology_reports` | id, admission_id, study_type, ordered_by, report, status, performed_by |
| `consultations` | id, admission_id, requested_by, specialty, reason, response, requested_at, responded_by |
| `procedures` | id, admission_id, name_ar/en, performed_by, performed_at, notes |
| `attachments` | id, admission_id, uploaded_by, file_name, mime, size, storage_key, created_at |
| `timeline_events` | id, admission_id, actor_id, type, title_ar/en, payload_json, created_at | (إضافي للجدول الزمني)

### نظامية
| Table | أعمدة |
|---|---|
| `audit_logs` | id, actor_id, action, resource_type, resource_id, meta_json, ip, created_at |
| `settings` | id, hospital_id, key, value_json |
| `login_attempts` | id, username, ip, success, attempted_at |

## نُهج
- كل Query عبر أدوات معدة مسبقاً (repositories) ومنعزلة بمستشفى/مريض.
- العلاقات دون FK إجبارية SQLite إلا عند الحاجة؛ تُفرَض منطقياً في الطبقة الوسطى.
- فهرسة: `patients.file_number`, `admissions.patient_id`, `sessions.token_hash`, `timeline.admission_id`.
- Migrations في `api/db/migrations/*.sql` تُدار بترتيب زمني + دالة seed للمعاينة.