import { Hono } from 'hono';
import { SignupSchema } from '@hmsi/shared/validate';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { HttpConflict } from '../lib/errors.js';
import { clientIp } from '../config.js';
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
 * الحد: 3 تسجيلات لكل عنوان IP خلال 15 دقيقة.
 */
export const signupRoutes = new Hono();

signupRoutes.get('/payment-info', async (c) => c.json({ ...(await getPaymentInfo()), trial_days: TRIAL_DAYS }, 200));

signupRoutes.post('/signup', async (c) => {
  const parsed = await parseBody(c, SignupSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof SignupSchema)['_output'];
  const ip = clientIp(c);
  if (await isBruteForced('signup', ip, 3, 200)) return c.json({ message: 'محاولات تسجيل كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);

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
    adminId = (await createHospitalAdmin(hospital.id, { username, password: input.password, full_name_ar: input.full_name_ar, email: input.email || null })).id;
  } catch (e) {
    // لا يبقى مستشفى بلا مدير إن فشل إنشاء الحساب (سباق على اسم المستخدم)
    await db.execute({ sql: `DELETE FROM hospitals WHERE id = ?`, args: [hospital.id] });
    throw e;
  }
  await createSession(c, adminId, ip, c.req.header('user-agent') ?? null);
  await writeAudit({ actorId: adminId, action: 'hospital_signup', resourceType: 'hospital', resourceId: hospital.id, ip, meta: { name: input.hospital_name_ar, phone: input.contact_phone } });
  return c.json(await getUserById(adminId), 201);
});
