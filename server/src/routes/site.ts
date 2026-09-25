import { Hono } from 'hono';
import { z } from 'zod';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { db } from '../../db/index.js';

/**
 * محتوى صفحة «من نحن» — عام للزوار، ويعدّله المدير العام من الإعدادات دون تعديل الكود.
 * الحقول الفارغة لا تظهر في الصفحة.
 */
export const siteRoutes = new Hono();
export const publicSiteRoutes = new Hono();

const AboutSchema = z.object({
  name: z.string().max(120).default(''),
  tagline: z.string().max(200).default(''),
  intro: z.string().max(3000).default(''),
  mission: z.string().max(1500).default(''),
  vision: z.string().max(1500).default(''),
  values: z.string().max(1500).default(''),
  phone: z.string().max(60).default(''),
  email: z.string().max(120).default(''),
  address: z.string().max(300).default(''),
  website: z.string().max(200).default(''),
});
export type AboutContent = z.infer<typeof AboutSchema>;

/** محتوى مبدئي يُعرض حتى يعدّله المدير العام */
export const DEFAULT_ABOUT: AboutContent = {
  name: 'HMSI — تطوير قاسم محمد',
  tagline: 'نبني أدوات رقمية تخدم المستشفيات والمرضى في العراق',
  intro:
    'نحن فريق من المطورين والمتخصصين في الأنظمة الصحية، نعمل على تحويل العمل الورقي في المستشفيات إلى ملف طبي إلكتروني آمن وسهل، يعمل على الحاسوب والهاتف، ويختصر وقت الطاقم الطبي ليتفرغ لرعاية المرضى.',
  mission: 'تمكين كل مستشفى — كبيراً كان أو صغيراً — من إدارة مرضاه وملفاتهم الطبية رقمياً بتكلفة مناسبة ودون تعقيد.',
  vision: 'أن يكون لكل مريض ملف طبي رقمي متكامل وآمن، وأن تتابع كل عائلة حالة مريضها بشفافية واطمئنان.',
  values: 'خصوصية المريض أولاً\nالبساطة في الاستخدام\nالدقة والموثوقية\nالدعم القريب من المستخدم',
  phone: '+964 774 477 7950',
  email: 'qasimmohamed14@gmail.com',
  address: 'العراق',
  website: '',
};

export async function getAbout(): Promise<AboutContent> {
  const rows = await db.execute({ sql: `SELECT value FROM system_settings WHERE key = 'about_us' LIMIT 1`, args: [] });
  if (rows.rows.length === 0) return DEFAULT_ABOUT;
  try {
    return { ...DEFAULT_ABOUT, ...(JSON.parse(String((rows.rows[0] as Record<string, unknown>).value)) as Partial<AboutContent>) };
  } catch {
    return DEFAULT_ABOUT;
  }
}

publicSiteRoutes.get('/about', async (c) => c.json(await getAbout(), 200));

siteRoutes.put('/about', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, AboutSchema);
  if (!parsed.ok) return parsed.json;
  const content = parsed.data as AboutContent;
  const session = getSession(c)!;
  await db.execute({
    sql: `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES ('about_us', ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    args: [JSON.stringify(content), session.user.full_name_ar, new Date().toISOString()],
  });
  await writeAudit({ actorId: session.user.id, action: 'about_updated', resourceType: 'system', resourceId: 'about_us', ip: clientIp(c) });
  return c.json(content, 200);
});
