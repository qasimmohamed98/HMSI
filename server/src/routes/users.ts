import { Hono } from 'hono';
import type { Context } from 'hono';
import { CreateUserSchema, UpdateUserSchema, ResetPasswordSchema } from '@hmsi/shared/validate';
import { hasPermission } from '@hmsi/shared';
import { listUsers, createUser, updateUser, getUserAccessInfo, UserExistsError, UserProtectedError, UserDepartmentError } from '../repos/userRepo.js';
import { requireAuth, getSession } from '../middleware/auth.js';
import { getHeadedDepartmentIds } from '../lib/orgAccess.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { hashPassword } from '../lib/password.js';
import { setPassword } from '../repos/authRepo.js';
import { db } from '../../db/index.js';
import { forgetAllDevices } from '../lib/trustedDevice.js';

export const userRoutes = new Hono();

/**
 * التدرج الوظيفي العراقي: مدير القسم (مدير الصيادلة، مدير الأشعة...) يدير موظفي قسمه فقط، دون
 * صلاحية «users.manage» الشاملة. كل مسار هنا يتحقق أولاً من الصلاحية الشاملة، وإن غابت يبحث عن
 * الأقسام التي يترأسها المستخدم الحالي؛ فراغ القائمتين معاً يعني رفض الوصول.
 */
async function actorScope(c: Context): Promise<{ full: true } | { full: false; departmentIds: string[] } | null> {
  const session = getSession(c)!;
  if (hasPermission(session.user.role, 'users.manage')) return { full: true };
  const departmentIds = await getHeadedDepartmentIds(session.user.id, session.user.hospital_id);
  if (departmentIds.length === 0) return null;
  return { full: false, departmentIds };
}

const FORBIDDEN = { message: 'لا تملك صلاحية لهذا الإجراء' } as const;

userRoutes.get('/', requireAuth(), async (c) => {
  const scope = await actorScope(c);
  if (!scope) return c.json(FORBIDDEN, 403);
  const session = getSession(c)!;
  return c.json(await listUsers(session.user.hospital_id, scope.full ? undefined : scope.departmentIds), 200);
});

userRoutes.post('/', requireAuth(), async (c) => {
  const scope = await actorScope(c);
  if (!scope) return c.json(FORBIDDEN, 403);
  const parsed = await parseBody(c, CreateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof CreateUserSchema)['_output'];
  const session = getSession(c)!;

  if (!scope.full) {
    // مدير القسم يعيّن موظفين ضمن قسمه فقط، ولا يمنح دور «مدير المستشفى»
    if (input.role === 'admin') return c.json(FORBIDDEN, 403);
    if (!input.department_id || !scope.departmentIds.includes(input.department_id)) {
      return c.json({ message: 'اختر أحد الأقسام التي تديرها' }, 400);
    }
  }
  try {
    const user = await createUser(input, session.user.hospital_id);
    await writeAudit({ actorId: session.user.id, action: 'user_created', resourceType: 'user', resourceId: user.id, meta: { username: user.username, role: input.role }, ip: clientIp(c) });
    return c.json(user, 201);
  } catch (e) {
    if (e instanceof UserExistsError) return c.json({ message: e.message }, 409);
    if (e instanceof UserDepartmentError) return c.json({ message: e.message }, 400);
    throw e;
  }
});

userRoutes.patch('/:id', requireAuth(), async (c) => {
  const scope = await actorScope(c);
  if (!scope) return c.json(FORBIDDEN, 403);
  const parsed = await parseBody(c, UpdateUserSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof UpdateUserSchema)['_output'];
  const id = c.req.param('id');
  const session = getSession(c)!;

  if (id === session.user.id && (input.is_active === false || (input.role !== undefined && input.role !== session.user.role))) {
    return c.json({ message: 'لا يمكنك تعطيل حسابك أو تغيير دورك بنفسك' }, 400);
  }

  if (!scope.full) {
    const target = await getUserAccessInfo(id, session.user.hospital_id);
    if (!target) return c.json({ message: 'المستخدم غير موجود' }, 404);
    // مدير القسم لا يلمس موظفاً خارج قسمه، ولا يرقّي أحداً لدور «مدير المستشفى»
    if (!target.department_id || !scope.departmentIds.includes(target.department_id)) return c.json(FORBIDDEN, 403);
    if (input.role === 'admin') return c.json(FORBIDDEN, 403);
    if (input.department_id !== undefined && (!input.department_id || !scope.departmentIds.includes(input.department_id))) {
      return c.json({ message: 'اختر أحد الأقسام التي تديرها' }, 400);
    }
  }

  try {
    const updated = await updateUser(id, session.user.hospital_id, input);
    // جلسات المستخدم المعطّل تتوقف فوراً لأن currentSession يشترط is_active = 1
    if (!updated) return c.json({ message: 'المستخدم غير موجود' }, 404);
    await writeAudit({ actorId: session.user.id, action: 'user_updated', resourceType: 'user', resourceId: id, meta: input, ip: clientIp(c) });
    return c.json(updated, 200);
  } catch (e) {
    if (e instanceof UserProtectedError) return c.json({ message: e.message }, 403);
    if (e instanceof UserDepartmentError) return c.json({ message: e.message }, 400);
    throw e;
  }
});

/** إعادة تعيين كلمة مرور مستخدم في نفس المستشفى — تُنهي كل جلساته */
userRoutes.post('/:id/password', requireAuth(), async (c) => {
  const scope = await actorScope(c);
  if (!scope) return c.json(FORBIDDEN, 403);
  const parsed = await parseBody(c, ResetPasswordSchema);
  if (!parsed.ok) return parsed.json;
  const { password } = parsed.data as { password: string };
  const id = c.req.param('id');
  const session = getSession(c)!;
  if (id === session.user.id) return c.json({ message: 'لتغيير كلمة مرورك استخدم صفحة الإعدادات' }, 400);
  const rows = await db.execute({ sql: `SELECT role, department_id FROM users WHERE id = ? AND hospital_id = ? LIMIT 1`, args: [id, session.user.hospital_id] });
  if (rows.rows.length === 0) return c.json({ message: 'المستخدم غير موجود' }, 404);
  const target = rows.rows[0] as Record<string, unknown>;
  if (String(target.role) === 'super_admin') return c.json({ message: 'لا يمكن تعديل حساب المدير العام' }, 403);
  if (!scope.full) {
    const deptId = target.department_id == null ? null : String(target.department_id);
    if (String(target.role) === 'admin' || !deptId || !scope.departmentIds.includes(deptId)) return c.json(FORBIDDEN, 403);
  }
  // كلمة مؤقتة: يغيّرها الموظف عند أول دخول
  await setPassword(id, await hashPassword(password), null, true);
  await forgetAllDevices(id);
  await writeAudit({ actorId: session.user.id, action: 'password_reset', resourceType: 'user', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
