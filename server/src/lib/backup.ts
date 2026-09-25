import { gzipSync, gunzipSync } from 'node:zlib';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '../../db/index.js';

/**
 * النسخ الاحتياطي المنطقي: كل الجداول كـ JSON مضغوط (ومشفّر إن وُجد BACKUP_KEY).
 * - يومياً عبر الدالة المجدولة netlify/functions/backup-daily.ts
 * - يدوياً من صفحة "صحة النظام" للمدير العام
 * يكمل النسخ الاحتياطي الذي يوفره Turso نفسه (استعادة نقطة زمنية) ولا يغني عنه.
 */

type Row = Record<string, unknown>;

export interface BackupFile {
  format: 'hmsi-backup';
  version: 1;
  created_at: string;
  scope: 'full' | 'hospital';
  hospital_id?: string;
  migrations: string[];
  counts: Record<string, number>;
  tables: Record<string, Row[]>;
}

/** جداول مؤقتة أو أسرار جلسات: لا تُنسخ */
const EPHEMERAL = new Set(['sessions', 'login_attempts', 'mfa_challenges']);
/** الإبقاء على آخر 30 نسخة يومية */
export const RETENTION = 30;
const PAGE = 500;

/** قيم BLOB تُحفظ base64 لتبقى JSON صالحاً */
function encodeValue(v: unknown): unknown {
  if (v instanceof ArrayBuffer) return { $b64: Buffer.from(v).toString('base64') };
  if (ArrayBuffer.isView(v)) return { $b64: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') };
  if (typeof v === 'bigint') return Number(v);
  return v;
}
export function decodeValue(v: unknown): unknown {
  if (v && typeof v === 'object' && '$b64' in (v as Record<string, unknown>)) return Buffer.from(String((v as { $b64: string }).$b64), 'base64');
  return v;
}

async function listTables(): Promise<string[]> {
  const r = await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
  return r.rows.map((x) => String(x.name)).filter((n) => !EPHEMERAL.has(n));
}

async function dumpQuery(sql: string, args: string[] = []): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const r = await db.execute({ sql: `${sql} LIMIT ${PAGE} OFFSET ${offset}`, args });
    for (const row of r.rows) {
      const o: Row = {};
      for (const col of r.columns) o[col] = encodeValue((row as unknown as Row)[col]);
      out.push(o);
    }
    if (r.rows.length < PAGE) return out;
  }
}

async function migrationsList(): Promise<string[]> {
  try {
    const r = await db.execute(`SELECT * FROM schema_migrations`);
    return r.rows.map((x) => String(Object.values(x as unknown as Row)[0]));
  } catch {
    return [];
  }
}

function finish(scope: BackupFile['scope'], tables: Record<string, Row[]>, migrations: string[], hospitalId?: string): BackupFile {
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  return { format: 'hmsi-backup', version: 1, created_at: new Date().toISOString(), scope, ...(hospitalId ? { hospital_id: hospitalId } : {}), migrations, counts, tables };
}

/** نسخة كاملة لكل المستشفيات (للمدير العام والنسخ المجدول) */
export async function buildFullBackup(): Promise<BackupFile> {
  const tables: Record<string, Row[]> = {};
  for (const t of await listTables()) tables[t] = await dumpQuery(`SELECT * FROM ${t} ORDER BY rowid`);
  return finish('full', tables, await migrationsList());
}

const ADMISSION_TABLES = ['vitals', 'medical_notes', 'diagnoses', 'medications', 'medication_administrations', 'lab_results', 'radiology_reports', 'consultations', 'procedures', 'fluid_entries', 'timeline_events'];

/**
 * تصدير بيانات مستشفى واحد (لمدير المستشفى): بلا كلمات مرور أو أسرار تحقق،
 * والمرفقات بياناتها الوصفية فقط (الملفات تُنزّل من ملف المريض).
 */
export async function buildHospitalExport(hospitalId: string): Promise<BackupFile> {
  const h = [hospitalId];
  const admissionIds = `SELECT a.id FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = ?`;
  const tables: Record<string, Row[]> = {
    hospitals: await dumpQuery(`SELECT * FROM hospitals WHERE id = ? ORDER BY rowid`, h),
    settings: await dumpQuery(`SELECT * FROM settings WHERE hospital_id = ? ORDER BY rowid`, h),
    departments: await dumpQuery(`SELECT * FROM departments WHERE hospital_id = ? ORDER BY rowid`, h),
    wards: await dumpQuery(`SELECT * FROM wards WHERE department_id IN (SELECT id FROM departments WHERE hospital_id = ?) ORDER BY rowid`, h),
    beds: await dumpQuery(
      `SELECT * FROM beds WHERE ward_id IN (SELECT w.id FROM wards w JOIN departments d ON d.id = w.department_id WHERE d.hospital_id = ?) ORDER BY rowid`,
      h,
    ),
    users: await dumpQuery(
      `SELECT id, hospital_id, username, full_name_ar, full_name_en, email, role, is_active, created_at FROM users WHERE hospital_id = ? ORDER BY rowid`,
      h,
    ),
    patients: await dumpQuery(`SELECT * FROM patients WHERE hospital_id = ? ORDER BY rowid`, h),
    admissions: await dumpQuery(`SELECT * FROM admissions WHERE patient_id IN (SELECT id FROM patients WHERE hospital_id = ?) ORDER BY rowid`, h),
    attachments: await dumpQuery(
      `SELECT id, admission_id, uploaded_by, file_name, mime, size, created_at FROM attachments WHERE admission_id IN (${admissionIds}) ORDER BY rowid`,
      h,
    ),
    trash: await dumpQuery(`SELECT * FROM trash WHERE hospital_id = ? ORDER BY rowid`, h),
    payment_notices: await dumpQuery(`SELECT * FROM payment_notices WHERE hospital_id = ? ORDER BY rowid`, h),
    audit_logs: await dumpQuery(`SELECT * FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE hospital_id = ?) ORDER BY rowid`, h),
  };
  for (const t of ADMISSION_TABLES) tables[t] = await dumpQuery(`SELECT * FROM ${t} WHERE admission_id IN (${admissionIds}) ORDER BY rowid`, h);
  return finish('hospital', tables, await migrationsList(), hospitalId);
}

// ---------------------------------------------------------------- الترميز والتشفير

const MAGIC_PLAIN = Buffer.from('HMSIBK0\n');
const MAGIC_ENC = Buffer.from('HMSIBK1\n');

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** gzip ثم AES-256-GCM إن وُجد مفتاح (BACKUP_KEY) */
export function encodeBackup(b: BackupFile, secret = process.env.BACKUP_KEY): { bytes: Buffer; encrypted: boolean } {
  const gz = gzipSync(Buffer.from(JSON.stringify(b), 'utf8'), { level: 9 });
  if (!secret) return { bytes: Buffer.concat([MAGIC_PLAIN, gz]), encrypted: false };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(gz), cipher.final()]);
  return { bytes: Buffer.concat([MAGIC_ENC, iv, cipher.getAuthTag(), body]), encrypted: true };
}

export function decodeBackup(bytes: Buffer, secret = process.env.BACKUP_KEY): BackupFile {
  const head = bytes.subarray(0, 8);
  let gz: Buffer;
  if (head.equals(MAGIC_PLAIN)) gz = bytes.subarray(8);
  else if (head.equals(MAGIC_ENC)) {
    if (!secret) throw new Error('النسخة مشفّرة: اضبط BACKUP_KEY');
    const iv = bytes.subarray(8, 20);
    const tag = bytes.subarray(20, 36);
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    gz = Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]);
  } else throw new Error('ملف ليس نسخة احتياطية لهذا النظام');
  const b = JSON.parse(gunzipSync(gz).toString('utf8')) as BackupFile;
  if (b.format !== 'hmsi-backup') throw new Error('صيغة نسخة غير معروفة');
  return b;
}

// ---------------------------------------------------------------- التخزين

export interface StoredBackup {
  key: string;
  size: number;
  created_at: string;
}

interface BackupStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  list(): Promise<StoredBackup[]>;
  remove(key: string): Promise<void>;
}

/** على Netlify: Netlify Blobs (خاص بالموقع). محلياً: مجلد server/backups */
async function store(): Promise<BackupStore> {
  const onNetlify = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_BLOBS_CONTEXT) && !process.env.BACKUP_DIR;
  if (onNetlify) {
    const { getStore } = await import('@netlify/blobs');
    const s = getStore({ name: 'hmsi-backups', consistency: 'strong' });
    return {
      put: async (key, data) => {
        await s.set(key, new Uint8Array(data).buffer as ArrayBuffer, { metadata: { size: data.length, created_at: new Date().toISOString() } });
      },
      get: async (key) => {
        const v = await s.get(key, { type: 'arrayBuffer' });
        return v ? Buffer.from(v) : null;
      },
      list: async () => {
        const { blobs } = await s.list();
        const out: StoredBackup[] = [];
        for (const b of blobs) {
          const m = await s.getMetadata(b.key);
          out.push({ key: b.key, size: Number(m?.metadata.size ?? 0), created_at: String(m?.metadata.created_at ?? '') });
        }
        return out;
      },
      remove: async (key) => {
        await s.delete(key);
      },
    };
  }
  const dir = process.env.BACKUP_DIR || join(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  return {
    put: (key, data) => writeFile(join(dir, key), data),
    get: async (key) => readFile(join(dir, key)).catch(() => null),
    list: async () =>
      Promise.all(
        (await readdir(dir)).filter((f) => f.startsWith('hmsi-')).map(async (f) => {
          const st = await stat(join(dir, f));
          return { key: f, size: st.size, created_at: st.mtime.toISOString() };
        }),
      ),
    remove: (key) => rm(join(dir, key), { force: true }),
  };
}

export const isBackupKey = (k: string) => /^hmsi-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-(scheduled|manual)\.bak$/.test(k);

export async function listBackups(): Promise<StoredBackup[]> {
  const all = await (await store()).list();
  return all.filter((b) => isBackupKey(b.key)).sort((a, b) => b.key.localeCompare(a.key));
}

export async function readBackup(key: string): Promise<Buffer | null> {
  if (!isBackupKey(key)) return null;
  return (await store()).get(key);
}

/** ينشئ نسخة كاملة ويحفظها ويحذف الأقدم من حد الاحتفاظ */
export async function runBackup(kind: 'scheduled' | 'manual'): Promise<StoredBackup & { encrypted: boolean; counts: Record<string, number>; ms: number }> {
  const t0 = Date.now();
  const b = await buildFullBackup();
  const { bytes, encrypted } = encodeBackup(b);
  const key = `hmsi-${b.created_at.slice(0, 19).replace(/:/g, '-')}Z-${kind}.bak`;
  const s = await store();
  await s.put(key, bytes);
  const all = (await s.list()).filter((x) => isBackupKey(x.key)).sort((a, c) => c.key.localeCompare(a.key));
  for (const old of all.slice(RETENTION)) await s.remove(old.key);
  return { key, size: bytes.length, created_at: b.created_at, encrypted, counts: b.counts, ms: Date.now() - t0 };
}
