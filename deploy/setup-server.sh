#!/usr/bin/env bash
# إعداد خادم Ubuntu 24.04 جديد لـ Q VIREXA — يُشغَّل مرة واحدة بصلاحية root:
#   bash setup-server.sh
# آمن لإعادة التشغيل (لا يكرر ما تم).
set -euo pipefail

echo "==> تحديث النظام"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> الحزم الأساسية: nginx، جدار الحماية، الحماية من التخمين، شهادات HTTPS، git"
apt-get install -y nginx ufw fail2ban unattended-upgrades certbot python3-certbot-nginx git curl ca-certificates sqlite3

echo "==> Node.js 22 LTS"
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> التحديثات الأمنية التلقائية"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> جدار الحماية: SSH و HTTP/HTTPS فقط"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> fail2ban لحماية SSH من التخمين"
systemctl enable --now fail2ban

echo "==> مستخدم الخدمة والمجلدات"
id hmsi >/dev/null 2>&1 || useradd --system --home /opt/hmsi --shell /usr/sbin/nologin hmsi
mkdir -p /opt/hmsi /var/lib/hmsi/backups /etc/hmsi /var/www/qproducts
chown -R hmsi:hmsi /var/lib/hmsi
chmod 700 /var/lib/hmsi /var/lib/hmsi/backups
chmod 700 /etc/hmsi

echo "==> صفحة مؤقتة للموقع الرئيسي (إلى أن يُنقل موقع Q Products)"
if [ ! -f /var/www/qproducts/index.html ]; then
  cat > /var/www/qproducts/index.html <<'HTML'
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Q Products</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,Segoe UI,Tahoma,sans-serif;background:#f5f7f6;color:#13204A}
main{text-align:center;padding:24px}h1{font-size:2.2rem;margin:0 0 8px}p{color:#4b5563}a{color:#0A9E88;font-weight:700}</style></head>
<body><main><h1>Q Products</h1><p>الموقع قيد الإنشاء — Website under construction</p>
<p><a href="https://virexa.qproductshub.com">Q VIREXA — نظام إدارة المستشفيات</a></p></main></body></html>
HTML
fi

echo "==> مفتاح النشر (قراءة فقط) لسحب الكود من GitHub"
if [ ! -f /root/.ssh/hmsi_deploy ]; then
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  ssh-keygen -t ed25519 -N "" -C "hostinger-deploy" -f /root/.ssh/hmsi_deploy
  cat >> /root/.ssh/config <<'CFG'
Host github-hmsi
  HostName github.com
  User git
  IdentityFile /root/.ssh/hmsi_deploy
  IdentitiesOnly yes
CFG
  chmod 600 /root/.ssh/config
fi
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null
sort -u /root/.ssh/known_hosts -o /root/.ssh/known_hosts

echo
echo "================ انتهى الإعداد ================"
echo "أضف هذا المفتاح في GitHub: المستودع ← Settings ← Deploy keys ← Add deploy key (بدون Allow write access):"
echo
cat /root/.ssh/hmsi_deploy.pub
echo
