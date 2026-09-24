import { Hono } from 'hono';
import { CreateUserSchema, UpdateUserSchema, ResetPasswordSchema } from '@hmsi/shared/validate';
import { listUsers, createUser, updateUser, UserExistsError, UserProtectedError } from '../repos/userRepo.js';
import { requireAuth, requirePermission, getSession } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { hashPassword } from '../lib/password.js';
import { setPassword } from '../repos/authRepo.js';
import { db } from '../../db/index.js';

export const userRoutes = new Hono();

userRoutes.get('/', requireAuth(), requirePermission('users.manage'), async (c) => {
  const session = getSession(c)!;
  return c.json(await listUsers(session.user.hospital_id), 200);
});

userRoutes.post('/', requireAuth(), requirePermission('users.manage'), async (c) => {
  const parsed = await parseBody(c, CreateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateUserSchema)['_output'];
  const session = getSession(c)!;
  try {
    const user = await createUser(input, session.user.hospital_id);
    await writeAudit({ actorId: session.user.id, action: 'user_created', resourceType: 'user', resourceId: user.id, meta: { username: user.username, role: input.role }, ip: clientIp(c) });
    return c.json(user, 201);
  } catch (e) {
    if (e instanceof UserExistsError) return c.json({ message: e.message }, 409);
    throw e;
  }
});

userRoutes.patch('/:id', requireAuth(), requirePermission('users.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateUserSchema)['_output'];
  const id = c.req.param('id');
  const session = getSession(c)!;

  if (id === session.user.id && (input.is_active === false || (input.role !== undefined && input.role !== session.user.role))) {
    return c.json({ message: 'لا يمكنك تعطيل حسابك أو تغيير دورك بنفسك' }, 400);
  }
  try {
    const updated = await updateUser(id, session.user.hospital_id, input);
    // جلسات المستخدم المعطّل تتوقف فوراً لأن currentSession يشترط is_active = 1
    if (!updated) return c.json({ message: 'المستخدم غير موجود' }, 404);
    await writeAudit({ actorId: session.user.id, action: 'user_updated', resourceType: 'user', resourceId: id, meta: input, ip: clientIp(c) });
    return c.json(updated, 200);
  } catch (e) {
    if (e instanceof UserProtectedError) return c.json({ message: e.message }, 403);
    throw e;
  }
});

/** إعادة تعيين كلمة مرور مستخدم في نفس المستشفى — تُنهي كل جلساته */
userRoutes.post('/:id/password', requireAuth(), requirePermission('users.manage'), async (c) => {
  const parsed = await parseBody(c, ResetPasswordSchema);
  if (!parsed.ok) return parsed.json;
  const { password } = parsed.data as { password: string };
  const id = c.req.param('id');
  const session = getSession(c)!;
  if (id === session.user.id) return c.json({ message: 'لتغيير كلمة مرورك استخدم صفحة الإعدادات' }, 400);
  const rows = await db.execute({ sql: `SELECT role FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, session.user.hospital_id] });
  if (rows.rows.length === 0) return c.json({ message: 'المستخدم غير موجود' }, 404);
  if (String((rows.rows[0] as Record<string, unknown>).role) === 'super_admin') return c.json({ message: 'لا يمكن تعديل حساب المدير العام' }, 403);
  await setPassword(id, await hashPassword(password));
  await writeAudit({ actorId: session.user.id, action: 'password_reset', resourceType: 'user', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
