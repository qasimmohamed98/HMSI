import { randomBytes } from 'node:crypto';
import type { Hospital, HospitalListItem, HospitalAdminInfo } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { hashPassword } from '../lib/password.js';
import { HttpConflict, HttpError, isUniqueViolation } from '../lib/errors.js';
import { logoUrl } from '../lib/logo.js';
import { computeSubscription } from '../lib/subscription.js';

type Row = Record<string, unknown>;

function mapHospital(r: Row): Hospital {
  return {
    id: String(r.id),
    name_ar: String(r.name_ar),
    name_en: String(r.name_en),
    code: String(r.code),
    is_active: r.is_active === undefined ? true : Boolean(Number(r.is_active)),
    created_at: String(r.created_at),
    logo_url: logoUrl(r.id, r.logo_updated_at),
    subscription: computeSubscription(r.trial_ends_at, r.subscription_ends_at),
    trial_ends_at: r.trial_ends_at ? String(r.trial_ends_at) : null,
    subscription_ends_at: r.subscription_ends_at ? String(r.subscription_ends_at) : null,
    signup_source: String(r.signup_source ?? 'admin') === 'self' ? 'self' : 'admin',
    contact_name: r.contact_name ? String(r.contact_name) : null,
    contact_phone: r.contact_phone ? String(r.contact_phone) : null,
    contact_email: r.contact_email ? String(r.contact_email) : null,
    city: r.city ? String(r.city) : null,
  };
}

export async function getHospital(id: string): Promise<Hospital | null> {
  const rows = await db.execute({ sql: `SELECT * FROM hospitals WHERE id = ? LIMIT 1`, args: [id] });
  return rows.rows.length > 0 ? mapHospital(rows.rows[0] as Row) : null;
}

export async function updateHospital(id: string, input: { name_ar?: string; name_en?: string; is_active?: boolean }): Promise<Hospital | null> {
  await db.execute({
    sql: `UPDATE hospitals SET name_ar = COALESCE(?, name_ar), name_en = COALESCE(?, name_en), is_active = COALESCE(?, is_active) WHERE id = ?`,
    args: [input.name_ar ?? null, input.name_en ?? null, input.is_active === undefined ? null : input.is_active ? 1 : 0, id],
  });
  return getHospital(id);
}

/** قائمة المستشفيات مع إحصاءات مختصرة ومدرائها — للمدير العام */
export async function listHospitals(): Promise<HospitalListItem[]> {
  const rows = await db.execute({
    sql: `SELECT h.*,
            (SELECT COUNT(*) FROM users u WHERE u.hospital_id = h.id) AS users_count,
            (SELECT COUNT(*) FROM beds b JOIN wards w ON w.id = b.ward_id JOIN departments d ON d.id = w.department_id WHERE d.hospital_id = h.id) AS beds_count,
            (SELECT COUNT(*) FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE p.hospital_id = h.id AND a.status = 'active') AS active_admissions,
            (SELECT COUNT(*) FROM payment_notices n WHERE n.hospital_id = h.id AND n.status = 'pending') AS pending_payments
          FROM hospitals h ORDER BY h.created_at ASC`,
    args: [],
  });
  const admins = await db.execute({
    sql: `SELECT id, hospital_id, username, full_name_ar, is_active FROM users WHERE role = 'admin' ORDER BY full_name_ar`,
    args: [],
  });
  const byHospital = new Map<string, HospitalAdminInfo[]>();
  for (const row of admins.rows) {
    const r = row as Row;
    const list = byHospital.get(String(r.hospital_id)) ?? [];
    list.push({ id: String(r.id), username: String(r.username), full_name_ar: String(r.full_name_ar), is_active: Boolean(Number(r.is_active)) });
    byHospital.set(String(r.hospital_id), list);
  }
  return rows.rows.map((row) => {
    const r = row as Row;
    return {
      ...mapHospital(r),
      users_count: Number(r.users_count ?? 0),
      beds_count: Number(r.beds_count ?? 0),
      active_admissions: Number(r.active_admissions ?? 0),
      pending_payments: Number(r.pending_payments ?? 0),
      admins: byHospital.get(String(r.id)) ?? [],
    };
  });
}

function generateHospitalCode(): string {
  return `H-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function createHospital(input: {
  name_ar: string;
  name_en: string;
  code?: string;
  trial_ends_at?: string | null;
  signup_source?: 'admin' | 'self';
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  city?: string | null;
}): Promise<Hospital> {
  const id = uuid('hosp');
  const code = (input.code ?? generateHospitalCode()).toUpperCase();
  try {
    await db.execute({
      sql: `INSERT INTO hospitals (id, code, name_ar, name_en, trial_ends_at, signup_source, contact_name, contact_phone, contact_email, city)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, code, input.name_ar, input.name_en, input.trial_ends_at ?? null, input.signup_source ?? 'admin',
        input.contact_name ?? null, input.contact_phone ?? null, input.contact_email ?? null, input.city ?? null,
      ],
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpConflict('رمز المستشفى مستخدم بالفعل');
    throw e;
  }
  return (await getHospital(id))!;
}

export async function createHospitalAdmin(
  hospitalId: string,
  input: { username: string; password: string; full_name_ar: string; full_name_en?: string; email?: string | null },
  opts: { mustChangePassword?: boolean } = {},
): Promise<HospitalAdminInfo> {
  if (!(await getHospital(hospitalId))) throw new HttpError('المستشفى غير موجود', 404);
  const username = input.username.toLowerCase();
  const existing = await db.execute({ sql: `SELECT id FROM users WHERE lower(username) = ? LIMIT 1`, args: [username] });
  if (existing.rows.length > 0) throw new HttpConflict('اسم المستخدم مستخدم بالفعل');
  const id = uuid('us');
  await db.execute({
    sql: `INSERT INTO users (id, hospital_id, username, full_name_ar, full_name_en, email, role, password_hash, is_active, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, 'admin', ?, 1, ?)`,
    args: [id, hospitalId, username, input.full_name_ar, input.full_name_en ?? null, input.email ?? null, await hashPassword(input.password), opts.mustChangePassword === false ? 0 : 1],
  });
  return { id, username, full_name_ar: input.full_name_ar, is_active: true };
}

/** المدير العام يعمل داخل مستشفى آخر؛ null = العودة لمستشفاه الأصلي */
export async function setActiveHospital(sessionId: string, hospitalId: string | null): Promise<void> {
  await db.execute({ sql: `UPDATE sessions SET active_hospital_id = ? WHERE id = ?`, args: [hospitalId, sessionId] });
}

const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_BYTES = 300 * 1024;

/** يحفظ شعار المستشفى بعد التحقق من النوع الفعلي والحجم */
export async function setHospitalLogo(id: string, bytes: Uint8Array, mime: string, matches: (b: Uint8Array, m: string) => boolean): Promise<Hospital | null> {
  if (!(LOGO_MIME as readonly string[]).includes(mime) || !matches(bytes, mime)) throw new HttpError('الشعار يجب أن يكون صورة PNG أو JPEG أو WEBP', 415);
  if (bytes.length > MAX_LOGO_BYTES) throw new HttpError('حجم الشعار يتجاوز 300 كيلوبايت', 413);
  await db.execute({
    sql: `UPDATE hospitals SET logo_data = ?, logo_mime = ?, logo_updated_at = ? WHERE id = ?`,
    args: [Buffer.from(bytes).toString('base64'), mime, new Date().toISOString(), id],
  });
  return getHospital(id);
}

export async function clearHospitalLogo(id: string): Promise<Hospital | null> {
  await db.execute({ sql: `UPDATE hospitals SET logo_data = NULL, logo_mime = NULL, logo_updated_at = NULL WHERE id = ?`, args: [id] });
  return getHospital(id);
}

export async function getHospitalLogo(id: string): Promise<{ data: Buffer; mime: string } | null> {
  const rows = await db.execute({ sql: `SELECT logo_data, logo_mime FROM hospitals WHERE id = ? AND logo_data IS NOT NULL LIMIT 1`, args: [id] });
  const r = rows.rows[0] as Row | undefined;
  if (!r) return null;
  return { data: Buffer.from(String(r.logo_data), 'base64'), mime: String(r.logo_mime) };
}

/** تفعيل/تمديد الاشتراك حتى تاريخ (نهاية اليوم) */
export async function setSubscriptionUntil(id: string, until: string): Promise<Hospital | null> {
  await db.execute({ sql: `UPDATE hospitals SET subscription_ends_at = ?, is_active = 1 WHERE id = ?`, args: [until, id] });
  return getHospital(id);
}
