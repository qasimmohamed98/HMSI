import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@hmsi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { API } from './api';
import { disablePush } from './push-client';

type AuthStatus = 'loading' | 'authed' | 'guest';

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  /** يعيد تذكرة الخطوة الثانية إن كان التحقق بخطوتين مفعّلاً، وإلا null بعد إتمام الدخول */
  login: (username: string, password: string) => Promise<{ mfaToken: string } | null>;
  completeMfa: (mfaToken: string, code: string) => Promise<void>;
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
    const r = await API.login(username, password);
    if ('mfa_required' in r) return { mfaToken: r.mfa_token };
    qc.clear(); // لا تبقى بيانات مستخدم سابق في الذاكرة
    setUser(r);
    setStatus('authed');
    return null;
  }, [qc]);

  const completeMfa = useCallback(async (mfaToken: string, code: string) => {
    const u = await API.loginMfa(mfaToken, code);
    qc.clear();
    setUser(u);
    setStatus('authed');
  }, [qc]);

  const logout = useCallback(async () => {
    // الجهاز قد يستخدمه موظف آخر بعد الخروج: لا تصله إشعارات صاحب الجلسة السابقة
    await disablePush().catch(() => undefined);
    try {
      await API.logout();
    } catch {
      /* best effort */
    }
    qc.clear();
    setUser(null);
    setStatus('guest');
  }, [qc]);

  const value = useMemo(() => ({ status, user, login, completeMfa, logout, refresh }), [status, user, login, completeMfa, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}