import { Hono } from 'hono';
import { LoginSchema, ChangePasswordSchema } from '@hmsi/shared/validate';
import { findUserByUsername, getUserById, getPasswordHash, setPassword } from '../repos/authRepo.js';
import { verifyPassword, hashPassword } from '../lib/password.js';
import { createSession, destroySession, purgeExpired } from '../lib/session.js';
import { getSession, requireAuth } from '../middleware/auth.js';
import { isBruteForced, recordLoginAttempt } from '../middleware/security.js';
import { writeAudit } from '../lib/audit.js';
import { parseBody } from '../lib/validate.js';
import { clientIp } from '../config.js';

export const authRoutes = new Hono();

// hash ثابت لمقارنة وهمية عند عدم وجود المستخدم — يمنع كشف أسماء المستخدمين عبر زمن الاستجابة
let dummyHash: Promise<string> | null = null;

authRoutes.post('/login', async (c) => {
  const parsed = await parseBody(c, LoginSchema);
  if (!parsed.ok) return parsed.json;
  const { password } = parsed.data as { username: string; password: string };
  const username = (parsed.data as { username: string }).username.trim().toLowerCase();

  const ip = clientIp(c);
  if (await isBruteForced(username, ip)) {
    return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  }

  const user = await findUserByUsername(username);
  let valid = false;
  if (user) {
    valid = await verifyPassword(password, user.hash);
  } else {
    dummyHash ??= hashPassword('dummy-password-for-timing');
    await verifyPassword(password, await dummyHash).catch(() => false);
  }
  if (!user || !valid) {
    await recordLoginAttempt(username, ip, false);
    await writeAudit({ actorId: null, action: 'login_failed', resourceType: 'user', resourceId: username, ip });
    return c.json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
  }

  await recordLoginAttempt(username, ip, true);
  const full = await getUserById(user.id);
  if (!full) return c.json({ message: 'تعذر تحميل المستخدم' }, 500);

  await purgeExpired().catch(() => undefined);
  await createSession(c, full.id, ip, c.req.header('user-agent') ?? null);
  await writeAudit({ actorId: full.id, action: 'login', resourceType: 'user', resourceId: full.id, ip });
  return c.json(full, 200);
});

authRoutes.post('/logout', requireAuth(), async (c) => {
  const session = getSession(c)!;
  await writeAudit({ actorId: session.user.id, action: 'logout', resourceType: 'user', resourceId: session.user.id, ip: clientIp(c) });
  await destroySession(c);
  return c.body(null, 204);
});

authRoutes.get('/me', (c) => c.json(getSession(c)?.user ?? null, 200));

/** تغيير كلمة المرور الخاصة — يُنهي كل الجلسات الأخرى للمستخدم */
authRoutes.post('/password', requireAuth(), async (c) => {
  const parsed = await parseBody(c, ChangePasswordSchema);
  if (!parsed.ok) return parsed.json;
  const { current_password, new_password } = parsed.data as { current_password: string; new_password: string };
  const session = getSession(c)!;
  const ip = clientIp(c);
  const key = `pw:${session.user.id}`;
  if (await isBruteForced(key, ip)) return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);

  const hash = await getPasswordHash(session.user.id);
  if (!hash || !(await verifyPassword(current_password, hash))) {
    await recordLoginAttempt(key, ip, false);
    return c.json({ message: 'كلمة المرور الحالية غير صحيحة' }, 403);
  }
  await setPassword(session.user.id, await hashPassword(new_password), session.sessionId);
  await writeAudit({ actorId: session.user.id, action: 'password_changed', resourceType: 'user', resourceId: session.user.id, ip });
  return c.body(null, 204);
});
