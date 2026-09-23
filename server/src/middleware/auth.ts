import type { Context, MiddlewareHandler } from 'hono';
import { ROLE_PERMISSIONS, type User } from '@hmsi/shared';
import { currentSession } from '../lib/session.js';

export interface AppContext {
  session: SessionUser | null;
}

export interface SessionUser {
  sessionId: string;
  csrf: string;
  user: User;
}

export const setUser: MiddlewareHandler = async (c, next) => {
  const session = await currentSession(c);
  c.set('session', session);
  await next();
};

export function getSession(c: Context): SessionUser | null {
  return (c.get('session') as SessionUser | null) ?? null;
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const session = getSession(c);
    if (!session) return c.json({ message: 'غير مصرح — سجّل الدخول أولاً' }, 401);
    return next();
  };
}

export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const session = getSession(c);
    if (!session) return c.json({ message: 'غير مصرح — سجّل الدخول أولاً' }, 401);
    const perms: readonly string[] = ROLE_PERMISSIONS[session.user.role] ?? [];
    if (!perms.includes(permission)) return c.json({ message: 'لا تملك صلاحية لهذا الإجراء' }, 403);
    return next();
  };
}