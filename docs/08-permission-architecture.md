# 8. Permission Architecture

## النموذج
RBAC + Scope. دور المستخدم يحدد Qaction ممكن؛ Scope يحدد نطاق الوصول (مستشفى/قسم/ردهة/مريض).

## تعريف الصلاحيات (Permissions)
| الصلاحية | الأدوار التي تملكها |
|---|---|
| `users.manage` | super_admin, admin |
| `patients.create/update/view` | الجميع وفق الدور (view للكل) |
| `chart.view` | doctor, nurse, lab, radiology, admin |
| `notes.write.doctor` | doctor |
| `notes.write.nursing` | nurse |
| `medications.manage` | doctor, pharmacist |
| `lab.add_result` | lab |
| `radiology.add_report` | radiology |
| `admissions.manage` | reception, doctor, nurse, admin |
| `discharge.approve` | doctor |
| `settings.manage` | admin |
| `audit.view` | admin |
| `reports.view` | doctor, admin |

## التحقق Server-Side (إلزامي)
لا اعتماد على إخفاء أزرار أو فحص من طرف الـ Frontend وحده. كل Endpoint يشغّل:

```
authenticate(session) → load user → requirePermission(P) →
                        scope: hospital == session.user.hospital →
                        (إن وُجد patient) patient.hospital == user.hospital →
                        Authorization → تنفيذ → audit log
```

- **Cross-Hospital** ممنوع تلقائياً (فلترة بعدة شروط في SQL).
- **Patient Scope**: لا يمكن حتى `GET /patients/:id` لمريض من مستشفى آخر.
- السلوك على الـ UI: الضبط الرقمي `usePermissions()` يحجب/يعرض عناصر، لكنه تعديل تجربة فقط لا حماية.

## الجلسات والإبطال
- عند تغيير الصلاحيات تُبطَل الجلسات القديمة للمستخدم الصريح.
- `users.is_active=false` يمنع الدخول فوراً.

## السجلات
كل تغيير صلاحية يُسجّل في `audit_logs` + `timeline_events` عند تعلقها بمريض.