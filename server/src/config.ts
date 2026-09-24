import type { Context } from 'hono';

export const env = {
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

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function hostnameOf(host: string): string {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host;
  }
}

/** هل الطلب يصل إلى خادم محلي (تطوير/اختبار)؟ */
export function isLocalRequest(c: Context): boolean {
  const host = c.req.header('Host') ?? new URL(c.req.url).host;
  return isLocalHostname(hostnameOf(host));
}

/** HTTPS خلف Netlify يُعرف من x-forwarded-proto */
export function isHttps(c: Context): boolean {
  const proto = c.req.header('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  return new URL(c.req.url).protocol === 'https:';
}

/**
 * عنوان العميل الحقيقي. Netlify يضع x-nf-client-connection-ip ولا يمكن للعميل تزويره؛
 * x-forwarded-for يُستخدم فقط كاحتياط (قد يكون مزوّراً خارج Netlify).
 */
export function clientIp(c: Context): string | null {
  const nf = c.req.header('x-nf-client-connection-ip');
  if (nf) return nf.trim();
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return null;
}

export function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true; // بعض العملاء (curl) بلا Origin؛ القرار عبر SameSite
  if (env.allowedOrigins.includes(origin)) return true;
  if (!host) return false;
  try {
    const u = new URL(origin);
    if (u.host === host) return true;
    // التطوير المحلي: vite (5173) يمرّر إلى الـ API (8787) — كلاهما localhost
    if (isLocalHostname(u.hostname) && isLocalHostname(hostnameOf(host))) return true;
    return false;
  } catch {
    return false;
  }
}
