import { Hono } from 'hono';
import { CreateUserSchema, UpdateUserSchema } from '@hmsi/shared/validate';
import { listUsers, createUser, updateUser, UserExistsError } from '../repos/userRepo.js';
import { requireAuth, requirePermission, getSession } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';

export const userRoutes = new Hono();

userRoutes.get('/', requireAuth(), requirePermission('users.manage'), async (c) => {
  const session = getSession(c)!;
  const users = await listUsers(session.user.hospital_id);
  await writeAudit({ actorId: session.user.id, action: 'users.list', resourceType: 'user' });
  return c.json(users, 200);
});

userRoutes.post('/', requireAuth(), requirePermission('users.manage'), async (c) => {
  const parsed = await parseBody(c, CreateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateUserSchema)['_output'];
  const session = getSession(c)!;
  let user;
  try {
    user = await createUser(input, session.user.hospital_id);
  } catch (e) {
    if (e instanceof UserExistsError) return c.json({ message: e.message }, 409);
    throw e;
  }
  await writeAudit({ actorId: session.user.id, action: 'user_created', resourceType: 'user', resourceId: user.id, meta: { username: input.username, role: input.role }, ip: c.req.header('x-forwarded-for') });
  return c.json(user, 201);
});

userRoutes.patch('/:id', requireAuth(), requirePermission('users.manage'), async (c) => {
  const parsed = await parseBody(c, UpdateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateUserSchema)['_output'];
  const id = c.req.param('id')!;
  const session = getSession(c)!;

  if (id === session.user.id && input.is_active === false) {
    return c.json({ message: 'لا يمكنك تعطيل حسابك الخاص' }, 400);
  }
  const updated = await updateUser(id, session.user.hospital_id, input);
  if (!updated) return c.json({ message: 'المستخدم غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'user_updated', resourceType: 'user', resourceId: id, meta: input, ip: c.req.header('x-forwarded-for') });
  return c.json(updated, 200);
});