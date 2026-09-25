import { serve } from '@hono/node-server';
import { api } from './app.js';

/**
 * تشغيل الإنتاج على خادم خاص (Hostinger VPS): يستمع على 127.0.0.1 فقط،
 * وnginx أمامه يتولى HTTPS والملفات الثابتة ورؤوس الأمان (deploy/nginx).
 */
const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? '127.0.0.1';

if (!process.env.SESSION_SECRET) {
  console.error('[hmsi] SESSION_SECRET غير مضبوط — راجع /etc/hmsi/hmsi.env');
  process.exit(1);
}

serve({ fetch: api.fetch, port, hostname }, (info) => {
  console.log(`[hmsi] listening on http://${hostname}:${info.port}`);
});
