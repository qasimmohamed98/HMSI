import { hash, verify } from '@node-rs/argon2';

const OPTIONS = { algorithm: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password);
}

/**
 * كلمات مرور معروفة/ضعيفة: الدخول بها يفرض تغييرها فوراً (يغطي الحسابات التجريبية في أي قاعدة).
 * لا تُقبل أيضاً ككلمة مرور جديدة.
 */
const WEAK = new Set([
  'password123', 'password1', 'password', '12345678', '123456789', '1234567890', 'qwerty123', 'qwerty12',
  'admin123', 'admin1234', 'hmsi1234', 'hmsi2026', 'hospital1', 'hospital123', 'abc12345', '11111111', '00000000',
  'iloveyou1', 'welcome1', 'welcome123', 'letmein1', 'passw0rd', 'p@ssw0rd', 'test1234', 'user1234', 'doctor123',
  'nurse123', 'manager123', 'virexa123',
]);

export function isWeakPassword(password: string, username?: string): boolean {
  const p = password.trim().toLowerCase();
  if (WEAK.has(p)) return true;
  if (username && p.includes(username.trim().toLowerCase())) return true;
  if (/^(.)\1+$/.test(p)) return true; // حرف واحد مكرر
  return false;
}

