import type { Context, MiddlewareHandler } from 'hono';
import { hasPermission, type Permission } from '@hmsi/shared';
import { currentSession, type SessionUser } from '../lib/session.js';

export type { SessionUser };

export const setUser: MiddlewareHandler = async (c, next) => {
  const session = await currentSession(c);
  c.set('session', session);
  await next();
};

export function getSession(c: Context): SessionUser | null {
  return (c.get('session') as SessionUser | null) ?? null;
}

export function sessionHas(c: Context, permission: Permission): boolean {
  return hasPermission(getSession(c)?.user.role, permission);
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const session = getSession(c);
    if (!session) return c.json({ message: 'غير مصرح — سجّل الدخول أولاً' }, 401);
    return next();
  };
}

/** يتطلب صلاحية واحدة على الأقل من القائمة */
export function requirePermission(...permissions: Permission[]): MiddlewareHandler {
  return async (c, next) => {
    const session = getSession(c);
    if (!session) return c.json({ message: 'غير مصرح — سجّل الدخول أولاً' }, 401);
    if (!permissions.some((p) => hasPermission(session.user.role, p))) {
      return c.json({ message: 'لا تملك صلاحية لهذا الإجراء' }, 403);
    }
    return next();
  };
}
