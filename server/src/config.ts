export const env = {
  production: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET ?? '',
  seedToken: process.env.SEED_TOKEN ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export const COOKIE_SESSION = 'hmsi_session';
export const COOKIE_CSRF = 'hmsi_csrf';
export const HEADER_CSRF = 'X-CSRF-Token';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

export const DEFAULT_HOSPITAL_ID = 'h-1';

export function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true; // بعض العملاء (curl) بلا Origin؛ القرار عبر SameSite
  if (env.allowedOrigins.length > 0) return env.allowedOrigins.includes(origin);
  if (!host) return false;
  try {
    const u = new URL(origin);
    if (u.host === host) return true;
    if (!env.production && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}