import type { Context, Config } from '@netlify/functions';
import { handle } from 'hono/netlify';

type Handler = (request: Request, ctx: { context: Context }) => Response | Promise<Response>;
let handler: Handler | null = null;

export default async function hmsi(request: Request, context: Context): Promise<Response> {
  // بدون TURSO_URL يحاول الخادم فتح ملف local.db غير الموجود على Netlify ويعرض خطأً خاماً —
  // نعيد بدلاً من ذلك رسالة واضحة تشير إلى متغيرات البيئة الناقصة.
  const missing = ['TURSO_URL', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[hmsi] missing environment variables: ${missing.join(', ')}`);
    return Response.json(
      { message: `إعداد الخادم غير مكتمل — اضبط متغيرات البيئة في Netlify ثم أعد النشر: ${missing.join('، ')}` },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // الاستيراد بعد التحقق حتى لا يُنشأ اتصال قاعدة البيانات بإعدادات ناقصة
  handler ??= handle((await import('../../server/src/app.js')).api) as Handler;
  return handler(request, { context });
}

export const config: Config = {
  path: ['/api/*'],
};
