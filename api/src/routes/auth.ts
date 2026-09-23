import { Hono } from 'hono';
import { LoginSchema } from '@hmsi/shared/validate';
import { findUserByUsername, getUserById } from '../repos/authRepo.js';
import { verifyPassword } from '../lib/password.js';
import { createSession, destroySession, currentSession } from '../lib/session.js';
import { getSession, requireAuth } from '../middleware/auth.js';
import { isBruteForced, recordLoginAttempt } from '../middleware/security.js';
import { writeAudit } from '../lib/audit.js';
import { parseBody } from '../lib/validate.js';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const parsed = await parseBody(c, LoginSchema);
  if (!parsed.ok) return parsed.json;
  const { username, password } = parsed.data as { username: string; password: string };

  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (await isBruteForced(username, ip)) {
    return c.json({ message: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' }, 429);
  }

  const user = await findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.hash))) {
    await recordLoginAttempt(username, ip, false);
    await writeAudit({ actorId: null, action: 'login_failed', resourceType: 'user', resourceId: username, ip });
    return c.json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
  }

  await recordLoginAttempt(username, ip, true);
  const full = await getUserById(user.id);
  if (!full) return c.json({ message: 'تعذر تحميل المستخدم' }, 500);

  await createSession(c, full.id, ip, c.req.header('user-agent') ?? null);
  await writeAudit({ actorId: full.id, action: 'login', resourceType: 'user', resourceId: full.id, ip });
  return c.json(full, 200);
});

authRoutes.post('/logout', requireAuth(), async (c) => {
  const session = getSession(c)!;
  await writeAudit({ actorId: session.user.id, action: 'logout', resourceType: 'user', resourceId: session.user.id });
  await destroySession(c);
  return c.body(null, 204);
});

authRoutes.get('/me', async (c) => {
  return c.json(await currentSession(c).then((s) => s?.user ?? null), 200);
});