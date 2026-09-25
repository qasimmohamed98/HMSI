import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@hmsi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { API } from './api';

type AuthStatus = 'loading' | 'authed' | 'guest';

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** إعادة تحميل بيانات المستخدم (مثلاً بعد تبديل المستشفى) */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    API.me()
      .then((u) => {
        if (!alive) return;
        if (u) {
          setUser(u);
          setStatus('authed');
        } else {
          setStatus('guest');
        }
      })
      .catch(() => alive && setStatus('guest'));
    // انتهاء الجلسة أثناء الاستخدام (401 من أي طلب)
    const onUnauthorized = () => {
      qc.clear();
      setUser(null);
      setStatus('guest');
    };
    window.addEventListener('hmsi:unauthorized', onUnauthorized);
    // انتهاء الاشتراك أثناء الاستخدام: إعادة تحميل المستخدم لتظهر صفحة الدفع
    const onExpired = () => {
      void API.me().then((u) => u && setUser(u)).catch(() => undefined);
    };
    window.addEventListener('hmsi:subscription-expired', onExpired);
    return () => {
      alive = false;
      window.removeEventListener('hmsi:unauthorized', onUnauthorized);
      window.removeEventListener('hmsi:subscription-expired', onExpired);
    };
  }, [qc]);

  const refresh = useCallback(async () => {
    const u = await API.me();
    setUser(u);
    setStatus(u ? 'authed' : 'guest');
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await API.login(username, password);
    qc.clear(); // لا تبقى بيانات مستخدم سابق في الذاكرة
    setUser(u);
    setStatus('authed');
  }, [qc]);

  const logout = useCallback(async () => {
    try {
      await API.logout();
    } catch {
      /* best effort */
    }
    qc.clear();
    setUser(null);
    setStatus('guest');
  }, [qc]);

  const value = useMemo(() => ({ status, user, login, logout, refresh }), [status, user, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}