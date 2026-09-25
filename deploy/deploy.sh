#!/usr/bin/env bash
# نشر/تحديث Q VIREXA على الخادم — بصلاحية root:
#   bash /opt/hmsi/app/deploy/deploy.sh
# يسحب آخر نسخة من main، يبني، ويعيد تشغيل الخدمة، ثم يفحص الصحة.
set -euo pipefail
APP=/opt/hmsi/app

if [ ! -d "$APP/.git" ]; then
  echo "==> أول نشر: سحب الكود"
  git clone github-hmsi:qasimmohamed98/HMSI.git "$APP"
fi

cd "$APP"
echo "==> سحب آخر نسخة"
git fetch origin main
git reset --hard origin/main

echo "==> تثبيت الحزم"
npm ci --no-audit --no-fund

echo "==> البناء"
npm run build -w packages/shared
npm run build -w @hmsi/api
VITE_API_MODE=live npm run build -w @hmsi/web

echo "==> خدمات systemd و nginx"
cp deploy/systemd/hmsi.service deploy/systemd/hmsi-backup.service deploy/systemd/hmsi-backup.timer /etc/systemd/system/
# إعداد nginx يُنسخ أول مرة فقط: certbot يضيف إليه HTTPS، والنسخ في كل تحديث يمسح ذلك
[ -f /etc/nginx/sites-available/virexa.conf ] || cp deploy/nginx/virexa.conf /etc/nginx/sites-available/virexa.conf
[ -f /etc/nginx/sites-available/main-site.conf ] || cp deploy/nginx/main-site.conf /etc/nginx/sites-available/main-site.conf
ln -sf /etc/nginx/sites-available/virexa.conf /etc/nginx/sites-enabled/virexa.conf
ln -sf /etc/nginx/sites-available/main-site.conf /etc/nginx/sites-enabled/main-site.conf
rm -f /etc/nginx/sites-enabled/default
# nginx يقرأ ملفات الواجهة فقط
chmod -R o+rX "$APP/web/dist"
chmod o+x /opt/hmsi /opt/hmsi/app /opt/hmsi/app/web
nginx -t
systemctl daemon-reload
systemctl enable --now hmsi hmsi-backup.timer
systemctl restart hmsi
systemctl reload nginx

echo "==> فحص الصحة"
sleep 3
curl -fsS http://127.0.0.1:8787/api/health && echo && echo "✓ النشر ناجح"
