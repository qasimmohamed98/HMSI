import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * تخزين الملفات على قرص الخادم بدل قاعدة البيانات (docs/PLAN_DEPARTMENTS.md، الأساس 1.5).
 * FILES_DIR مضبوط (الإنتاج: /var/lib/hmsi/files) → الملف على القرص وstorage_key = "fs:<مستشفى>/<سنة-شهر>/<معرّف>".
 * غير مضبوط → الطريقة القديمة (داخل قاعدة البيانات، حد 4 ميغابايت).
 * القرص محمي بصلاحيات مستخدم الخدمة فقط، ويُنسخ احتياطياً مشفّراً مع القاعدة (scripts/backup-cron.ts).
 */

export function filesDir(): string | null {
  if (process.env.FILES_DIR) return process.env.FILES_DIR;
  // الإنتاج: بجانب ملف القاعدة (/var/lib/hmsi/files) — لا يحتاج ضبطاً إضافياً
  const url = process.env.LOCAL_DB_URL ?? '';
  if (process.env.NODE_ENV === 'production' && url.startsWith('file:/')) return join(dirname(url.slice('file:'.length)), 'files');
  return null;
}

/** الحد: 18 ميغابايت على القرص (nginx يسمح بـ 20)، و4 داخل القاعدة */
export const maxFileSize = (): number => (filesDir() ? 18 : 4) * 1024 * 1024;

const KEY_RE = /^fs:([A-Za-z0-9_-]+)\/(\d{4}-\d{2})\/([0-9a-f-]{36})$/;

export async function saveFile(hospitalId: string, bytes: Uint8Array): Promise<string> {
  const dir = filesDir();
  if (!dir) throw new Error('FILES_DIR غير مضبوط');
  const safeHospital = hospitalId.replace(/[^A-Za-z0-9_-]/g, '_');
  const month = new Date().toISOString().slice(0, 7);
  const id = randomUUID();
  const folder = join(dir, safeHospital, month);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await writeFile(join(folder, id), bytes, { mode: 0o600, flag: 'wx' });
  return `fs:${safeHospital}/${month}/${id}`;
}

export function isFileKey(key: string | null | undefined): key is string {
  return Boolean(key && KEY_RE.test(key));
}

export async function loadFile(key: string): Promise<Buffer | null> {
  const dir = filesDir();
  const m = KEY_RE.exec(key);
  if (!dir || !m) return null;
  const path = normalize(join(dir, m[1]!, m[2]!, m[3]!));
  // حماية إضافية من الخروج من المجلد (المعرّف مولَّد عندنا ومطابق للنمط أصلاً)
  if (!path.startsWith(normalize(dir) + sep)) return null;
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}
