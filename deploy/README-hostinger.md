# تشغيل Q VIREXA على Hostinger VPS — دليل خطوة بخطوة

الإعداد النهائي (كله على خادم Hostinger واحد، Ubuntu 24.04):

| العنوان | ما يعمل عليه |
|---|---|
| `qproductshub.tech` / `www` | الموقع الرئيسي Q Products (ملفات ثابتة في `/var/www/qproducts`) |
| `virexa.qproductshub.tech` | نظام المستشفيات: الواجهة من `web/dist` + الخادم Node على `127.0.0.1:8787` |

| المسار على الخادم | المحتوى |
|---|---|
| `/opt/hmsi/app` | الكود (نسخة من GitHub عبر مفتاح نشر للقراءة فقط) |
| `/var/lib/hmsi/hmsi.db` | قاعدة البيانات (SQLite محلية) |
| `/var/lib/hmsi/backups` | النسخ الاحتياطية اليومية (آخر 30) |
| `/etc/hmsi/hmsi.env` | الأسرار (صلاحيات 600) |

> ⚠ لا تُرسل كلمة مرور root ولا محتوى `hmsi.env` لأحد. الأوامر كلها تُنفَّذ على جهازك أو على الخادم.

---

## 1. الاتصال بالخادم

من **PowerShell** على جهازك:

```powershell
ssh root@IP_الخادم
```

- أول مرة يسأل `Are you sure you want to continue connecting` → اكتب `yes`.
- اكتب كلمة مرور root (لا تظهر أثناء الكتابة — هذا طبيعي) ثم Enter.
- للخروج: `exit`.

## 2. ربط النطاق بالخادم (DNS)

في **hPanel ← Domains ← qproductshub.tech ← DNS / Nameservers**:

1. تأكد أن النطاق يستخدم **خوادم أسماء Hostinger** (الافتراضي).
2. احذف أي سجل **A** قديم للاسم `@` أو `www` يشير إلى عنوان غير عنوان خادمك.
3. أضف السجلات:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `@` | IP الخادم | افتراضي |
| A | `www` | IP الخادم | افتراضي |
| A | `virexa` | IP الخادم | افتراضي |

الانتشار يأخذ من دقائق إلى ساعات. للتحقق من PowerShell: `nslookup virexa.qproductshub.tech` يجب أن يُظهر IP خادمك.

## 3. إعداد الخادم (مرة واحدة)

من **PowerShell** على جهازك، داخل مجلد المشروع:

```powershell
scp deploy/setup-server.sh deploy/deploy.sh root@IP_الخادم:/root/
```

ثم على الخادم:

```bash
bash /root/setup-server.sh
```

يثبّت: nginx، Node.js 22، جدار الحماية (SSH وHTTP/HTTPS فقط)، fail2ban، التحديثات الأمنية التلقائية، certbot، ويُنشئ مستخدم الخدمة والمجلدات. في النهاية يطبع **مفتاح نشر** يبدأ بـ `ssh-ed25519`.

## 4. مفتاح النشر في GitHub

في GitHub: المستودع **HMSI ← Settings ← Deploy keys ← Add deploy key**:
- Title: `hostinger`
- Key: الصق المفتاح الذي طبعه السكربت
- **لا** تفعّل `Allow write access` (قراءة فقط)

## 5. الأسرار

على الخادم:

```bash
nano /etc/hmsi/hmsi.env
```

الصق محتوى `deploy/hmsi.env.example` واملأ:
- `SESSION_SECRET`: **نفس القيمة** الموجودة في Netlify (Site configuration ← Environment variables). تغييرها يعطّل رموز التحقق بخطوتين للجميع.
- `BACKUP_KEY`: نفس القيمة إن كانت مضبوطة في Netlify، وإلا ضع نصاً عشوائياً طويلاً **واحفظه عندك** (بدونه لا تُفك النسخ المشفّرة).

للحفظ في nano: `Ctrl+O` ثم Enter، وللخروج `Ctrl+X`. ثم:

```bash
chmod 600 /etc/hmsi/hmsi.env
```

لتوليد قيمة عشوائية قوية: `openssl rand -base64 48`

## 6. أول نشر

```bash
bash /root/deploy.sh
```

يسحب الكود، يبني، يشغّل الخدمة، ويفحص الصحة. النجاح = `✓ النشر ناجح`.

## 7. HTTPS

بعد أن يشير النطاق إلى الخادم (الخطوة 2):

```bash
certbot --nginx -d qproductshub.tech -d www.qproductshub.tech -d virexa.qproductshub.tech --redirect --agree-tos -m بريدك@example.com
```

الشهادة تتجدد تلقائياً.

## 8. نقل البيانات من النظام الحالي (Netlify/Turso)

1. أبلغ المستخدمين بتوقف قصير.
2. على الموقع الحالي: **صحة النظام ← نسخة احتياطية الآن ← تنزيل**.
3. من PowerShell: `scp اسم-الملف.bak root@IP_الخادم:/var/lib/hmsi/import.bak`
4. على الخادم:

```bash
systemctl stop hmsi
chown hmsi:hmsi /var/lib/hmsi/import.bak
cd /opt/hmsi/app/server
set -a; . /etc/hmsi/hmsi.env; set +a
sudo --preserve-env=NODE_ENV,LOCAL_DB_URL,SESSION_SECRET,BACKUP_KEY,BACKUP_DIR -u hmsi node dist/scripts/restore-drill.js /var/lib/hmsi/import.bak file:/var/lib/hmsi/hmsi.db
systemctl start hmsi
```

يجب أن ينتهي بـ `✓ الاستعادة سليمة` (كل جدول يطابق عدده). ثم ادخل إلى `https://virexa.qproductshub.tech` وتحقق.

> ⚠ `restore-drill` **يستبدل** القاعدة الموجودة. استخدمه فقط عند النقل الأول.

## 8ب. تثبيت جديد بلا بيانات سابقة: أول مدير عام

```bash
cd /opt/hmsi/app/server
set -a; . /etc/hmsi/hmsi.env; set +a
sudo --preserve-env=NODE_ENV,LOCAL_DB_URL,SESSION_SECRET,BACKUP_KEY,BACKUP_DIR -u hmsi node dist/scripts/create-super-admin.js admin
```

يطبع كلمة مرور مؤقتة، ويُجبَر المدير على تغييرها عند أول دخول. نسيت كلمة المرور؟ الأمر نفسه مع `--reset` في آخره.

> ملف الأسرار يقرؤه root فقط (مقصود)، لذلك تُقرأ القيم بصلاحية root وتُمرَّر إلى مستخدم الخدمة `hmsi`.

## 9. بعد الانتقال

- **النسخ الاحتياطي:** يومياً 01:00 على الخادم (آخر 30 نسخة). للتحقق: `systemctl list-timers hmsi-backup.timer`. فعّل أيضاً **Daily auto-backup** من Hostinger عند دخول أول مستشفى حقيقي (نسخة خارج خادمك)، ونزّل نسخة دورياً من صحة النظام إلى جهازك.
- **التحديثات:** `bash /opt/hmsi/app/deploy/deploy.sh`
- **السجلات:** `journalctl -u hmsi -n 100 --no-pager`
- **الحالة:** `systemctl status hmsi`
- **إعادة التشغيل:** `systemctl restart hmsi`
