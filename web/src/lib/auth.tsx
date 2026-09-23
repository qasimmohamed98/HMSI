import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@hmsi/shared';
import { API } from './api';

type AuthStatus = 'loading' | 'authed' | 'guest';

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

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
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await API.login(username, password);
    setUser(u);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await API.logout();
    } catch {
      /* best effort */
    }
    setUser(null);
    setStatus('guest');
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}