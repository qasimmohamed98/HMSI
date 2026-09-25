import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config.js';

/**
 * التحقق بخطوتين (TOTP — RFC 6238): رمز من 6 أرقام يتغير كل 30 ثانية
 * (Google Authenticator / Microsoft Authenticator / Authy ...).
 * السر يُحفظ مشفّراً (AES-256-GCM) بمفتاح مشتق من TOTP_KEY أو SESSION_SECRET،
 * ورموز الاسترداد تُحفظ مجزّأة (SHA-256) وتُستخدم مرة واحدة.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const off = h[h.length - 1]! & 15;
  const code = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

/**
 * يتحقق من الرمز ضمن نافذة ±1 خطوة (فرق ساعة الهاتف)، ويرفض إعادة استخدام خطوة سابقة.
 * يعيد رقم الخطوة المطابقة أو null.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const s = currentStep(now);
  for (const step of [s, s - 1, s + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(expected, Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer = 'Q VIREXA'): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------------------------------------------------------- تشفير السر

function key(): Buffer {
  return createHash('sha256').update(`hmsi-totp:${process.env.TOTP_KEY || env.sessionSecret || 'hmsi-local-dev'}`).digest();
}

export function sealSecret(secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return `v1.${Buffer.concat([iv, c.getAuthTag(), body]).toString('base64')}`;
}

export function openSecret(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed.replace(/^v1\./, ''), 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- رموز الاسترداد

const hashCode = (code: string) => createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');

export function newRecoveryCodes(n = 8): { codes: string[]; hashes: string[] } {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const codes = Array.from({ length: n }, () => {
    const b = randomBytes(10);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join('');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}

/** يعيد قائمة الرموز المتبقية بعد استهلاك الرمز، أو null إن لم يطابق */
export function consumeRecoveryCode(hashesJson: string | null, code: string): string[] | null {
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(hashesJson ?? '[]');
  } catch {
    return null;
  }
  const h = hashCode(code);
  const i = hashes.indexOf(h);
  if (i === -1) return null;
  return hashes.filter((_, j) => j !== i);
}
