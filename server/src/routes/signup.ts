import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SignupSchema } from '@hmsi/shared/validate';
import { TERMS_VERSION } from '@hmsi/shared';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { HttpConflict } from '../lib/errors.js';
import { clientIp, env } from '../config.js';
import { isWeakPassword } from '../lib/password.js';
import { db } from '../../db/index.js';
import { isBruteForced, recordLoginAttempt } from '../middleware/security.js';
import { createHospital, createHospitalAdmin } from '../repos/hospitalRepo.js';
import { getUserById } from '../repos/userRepo.js';
import { createSession } from '../lib/session.js';
import { trialEnd, TRIAL_DAYS } from '../lib/subscription.js';
import { getPaymentInfo } from './billing.js';

/**
 * تسجيل مستشفى جديد من صفحة الدخول — بدون تواصل مسبق مع المدير العام.
 * يُنشأ المستشفى بفترة تجريبية 14 يوماً ومديرٌ له، ويُسجَّل دخوله مباشرة.
 * الحماية من الإساءة:
 * - حقل مخفي (website) يملؤه البرنامج الآلي فقط
 * - رمز نموذج موقّع: يجب أن يمر 3 ثوانٍ على الأقل بين فتح النموذج وإرساله، وألا يتجاوز 3 ساعات
 * - 3 تسجيلات لكل عنوان IP خلال 15 دقيقة، و5 خلال 24 ساعة، و50 تسجيلاً لكل النظام يومياً
 */
export const signupRoutes = new Hono();

const TOKEN_MAX_AGE_MS = 3 * 3_600_000;
/** أقل مدة لملء النموذج (قابلة للضبط للاختبارات) */
const minFillMs = () => Number(process.env.SIGNUP_MIN_MS ?? 3000);
const sign = (ts: string) => createHmac('sha256', env.sessionSecret || 'hmsi-local-dev').update(`signup:${ts}`).digest('base64url');

function tokenAgeMs(token: string | undefined): number | null {
  const [ts, mac] = (token ?? '').split('.');
  if (!ts || !mac || !/^\d{10,}$/.test(ts)) return null;
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Date.now() - Number(ts);
}

async function signupsSince(sql: string, args: (string | null)[]): Promise<number> {
  return Number((await db.execute({ sql, args })).rows[0]?.n ?? 0);
}

signupRoutes.get('/signup-token', (c) => {
  const ts = String(Date.now());
  return c.json({ token: `${ts}.${sign(ts)}` }, 200, { 'Cache-Control': 'no-store' });
});

signupRoutes.get('/payment-info', async (c) => c.json({ ...(await getPaymentInfo()), trial_days: TRIAL_DAYS }, 200));

signupRoutes.post('/signup', async (c) => {
  const parsed = await parseBody(c, SignupSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof SignupSchema)['_output'];
  const ip = clientIp(c);
  // البرامج الآلية: رد عام لا يكشف سبب الرفض
  if (input.website && input.website.trim()) return c.json({ message: 'تعذّر إكمال التسجيل' }, 422);
  const age = tokenAgeMs(input.form_token);
  if (age === null || age > TOKEN_MAX_AGE_MS) return c.json({ message: 'انتهت صلاحية النموذج — أعد تحميل الصفحة وحاول مرة أخرى', code: 'form_expired' }, 422);
  if (age < minFillMs()) return c.json({ message: 'تعذّر إكمال التسجيل' }, 422);
  if (await isBruteForced('signup', ip, 3, 200)) return c.json({ message: 'محاولات تسجيل كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  const daily = await signupsSince(`SELECT COUNT(*) AS n FROM login_attempts WHERE username = 'signup' AND ip IS ? AND attempted_at > datetime('now', '-1 day')`, [ip]);
  if (daily >= 5) return c.json({ message: 'تم بلوغ الحد اليومي للتسجيل من هذا الجهاز — تواصل معنا لإنشاء حساب' }, 429);
  const global = await signupsSince(`SELECT COUNT(*) AS n FROM hospitals WHERE signup_source = 'self' AND created_at > datetime('now', '-1 day')`, []);
  if (global >= 50) return c.json({ message: 'التسجيل متوقف مؤقتاً — تواصل معنا لإنشاء حساب' }, 429);
  if (isWeakPassword(input.password, input.username)) return c.json({ message: 'كلمة المرور هذه ضعيفة أو شائعة — اختر كلمة أقوى' }, 422);

  const username = input.username.toLowerCase();
  const taken = await db.execute({ sql: `SELECT 1 FROM users WHERE lower(username) = ? LIMIT 1`, args: [username] });
  if (taken.rows.length > 0) throw new HttpConflict('اسم المستخدم مستخدم بالفعل — اختر اسماً آخر');

  // يُحسب كمحاولة لحد المعدّل (نجاح أو فشل)
  await recordLoginAttempt('signup', ip, false);
  const hospital = await createHospital({
    name_ar: input.hospital_name_ar,
    name_en: input.hospital_name_en?.trim() || input.hospital_name_ar,
    trial_ends_at: trialEnd(),
    signup_source: 'self',
    contact_name: input.full_name_ar,
    contact_phone: input.contact_phone,
    contact_email: input.email || null,
    city: input.city || null,
  });
  let adminId: string;
  try {
    adminId = (await createHospitalAdmin(hospital.id, { username, password: input.password, full_name_ar: input.full_name_ar, email: input.email || null }, { mustChangePassword: false })).id;
  } catch (e) {
    // لا يبقى مستشفى بلا مدير إن فشل إنشاء الحساب (سباق على اسم المستخدم)
    await db.execute({ sql: `DELETE FROM hospitals WHERE id = ?`, args: [hospital.id] });
    throw e;
  }
  // الموافقة على الشروط عند التسجيل: للمستشفى (من سجّله ومتى) وللمدير نفسه
  const agreed = new Date().toISOString();
  await db.execute({ sql: `UPDATE hospitals SET terms_version = ?, terms_accepted_at = ?, terms_accepted_by = ? WHERE id = ?`, args: [TERMS_VERSION, agreed, adminId, hospital.id] });
  await db.execute({ sql: `UPDATE users SET terms_version = ?, terms_accepted_at = ? WHERE id = ?`, args: [TERMS_VERSION, agreed, adminId] });
  await createSession(c, adminId, ip, c.req.header('user-agent') ?? null);
  await writeAudit({ actorId: adminId, action: 'hospital_signup', resourceType: 'hospital', resourceId: hospital.id, ip, meta: { name: input.hospital_name_ar, phone: input.contact_phone } });
  return c.json(await getUserById(adminId), 201);
});
