import type { Context, Config } from '@netlify/functions';
import { handle } from 'hono/netlify';

type Handler = (request: Request, ctx: { context: Context }) => Response | Promise<Response>;
let handler: Handler | null = null;

const configError = (detail: string) =>
  Response.json(
    { message: `إعداد الخادم غير مكتمل — ${detail}` },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );

export default async function hmsi(request: Request, context: Context): Promise<Response> {
  // بدون TURSO_URL يحاول الخادم فتح ملف local.db غير الموجود على Netlify —
  // نعيد بدلاً من ذلك رسالة واضحة تشير إلى متغيرات البيئة الناقصة.
  const missing = ['TURSO_URL', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[hmsi] missing environment variables: ${missing.join(', ')}`);
    return configError(`اضبط متغيرات البيئة في Netlify ثم أعد النشر: ${missing.join('، ')}`);
  }
  // قيمة خاطئة (مثل لصق ملف .env كاملاً) — لا نذكر القيمة أبداً
  if (!/^(libsql|https|wss?):\/\/[^\s=]+$/.test(process.env.TURSO_URL!.trim())) {
    console.error('[hmsi] TURSO_URL has an invalid format');
    return configError('قيمة TURSO_URL غير صالحة: يجب أن تكون الرابط وحده (libsql://...)');
  }
  try {
    // الاستيراد بعد التحقق حتى لا يُنشأ اتصال قاعدة البيانات بإعدادات ناقصة
    handler ??= handle((await import('../../server/src/app.js')).api) as Handler;
    return await handler(request, { context });
  } catch (err) {
    // أي خطأ غير معالج يعرضه Netlify للزائر كما هو (قد يتضمن أسراراً) — نسجله فقط
    console.error('[hmsi] fatal', err instanceof Error ? err.name : 'error');
    handler = null;
    return Response.json({ message: 'حدث خطأ غير متوقع في الخادم' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const config: Config = {
  path: ['/api/*'],
};
