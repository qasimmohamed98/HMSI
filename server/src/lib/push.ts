import webpush from 'web-push';
import type { Role } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';

/**
 * إشعارات الدفع (Web Push): تصل لجهاز الموظف حتى والنظام مغلق.
 * الخادم يوقّع الرسالة بمفاتيح VAPID ويرسلها لخدمة المتصفح (Google/Apple/Mozilla) مجاناً — لا مزوّد خارجي.
 *
 * الخصوصية: نص الإشعار يظهر على شاشة القفل، لذلك لا يحمل اسم المريض أبداً — العنوان وموقع السرير فقط،
 * والتفاصيل داخل النظام بعد الدخول. محتوى الرسالة مشفّر بين الخادم والجهاز (معيار Web Push).
 */

export type PushSeverity = 'info' | 'warning' | 'critical';
export type PushLevel = 'all' | 'important' | 'critical';

export interface PushMessage {
  titleAr: string;
  titleEn?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  link?: string | null;
  severity?: PushSeverity;
  /** يدمج الإشعارات المتكررة لنفس الحدث على الجهاز (نفس معرّف إشعار الجرس) */
  tag: string;
  kind: string;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: 'ar' | 'en';
  level: PushLevel;
}

const LEVEL_ALLOWS: Record<PushLevel, PushSeverity[]> = {
  all: ['info', 'warning', 'critical'],
  important: ['warning', 'critical'],
  critical: ['critical'],
};

// ---------------------------------------------------------------- المفاتيح

let keys: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return keys;
  }
  const r = await db.execute({ sql: `SELECT public_key, private_key FROM push_keys WHERE id = 1`, args: [] });
  const row = r.rows[0] as unknown as { public_key: string; private_key: string } | undefined;
  if (row) {
    keys = { publicKey: row.public_key, privateKey: row.private_key };
    return keys;
  }
  const k = webpush.generateVAPIDKeys();
  await db.execute({
    sql: `INSERT OR IGNORE INTO push_keys (id, public_key, private_key, created_at) VALUES (1, ?, ?, ?)`,
    args: [k.publicKey, k.privateKey, new Date().toISOString()],
  });
  // إن سبقتنا عملية أخرى نأخذ ما حُفظ
  keys = null;
  return vapidKeys();
}

const SUBJECT = () => process.env.VAPID_SUBJECT || `https://${process.env.PUBLIC_HOST || 'virexa.qproductshub.tech'}`;

// ---------------------------------------------------------------- الإرسال

export type PushTransport = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  opts: { TTL: number; urgency: 'normal' | 'high'; topic?: string },
) => Promise<{ statusCode: number }>;

let transport: PushTransport | null = null;
/** للاختبارات: استبدال الإرسال الفعلي */
export function setPushTransport(t: PushTransport | null): void {
  transport = t;
}

async function defaultTransport(): Promise<PushTransport> {
  const k = await vapidKeys();
  return (sub, payload, opts) =>
    webpush.sendNotification(sub, payload, { ...opts, vapidDetails: { subject: SUBJECT(), publicKey: k.publicKey, privateKey: k.privateKey } });
}

function payloadFor(m: PushMessage, lang: 'ar' | 'en'): string {
  const en = lang === 'en';
  return JSON.stringify({
    title: (en && m.titleEn) || m.titleAr,
    body: (en ? m.bodyEn || m.bodyAr : m.bodyAr) || '',
    link: m.link || '/',
    tag: m.tag,
    kind: m.kind,
    severity: m.severity ?? 'info',
    lang,
  });
}

/** يرسل لكل أجهزة مستخدمين محددين (لا يرمي أبداً) */
export async function pushToUsers(userIds: string[], m: PushMessage): Promise<number> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return 0;
  try {
    const r = await db.execute({
      sql: `SELECT s.id, s.endpoint, s.p256dh, s.auth, s.lang, s.level FROM push_subscriptions s
            JOIN users u ON u.id = s.user_id AND u.is_active = 1
            WHERE s.user_id IN (${ids.map(() => '?').join(',')})`,
      args: ids,
    });
    const subs = (r.rows as unknown as SubRow[]).filter((s) => LEVEL_ALLOWS[s.level]?.includes(m.severity ?? 'info'));
    if (!subs.length) return 0;
    const send = transport ?? (await defaultTransport());
    const results = await Promise.all(subs.map((s) => sendOne(send, s, m)));
    return results.filter(Boolean).length;
  } catch (e) {
    console.error('[hmsi] push failed', e instanceof Error ? e.message : e);
    return 0;
  }
}

async function sendOne(send: PushTransport, s: SubRow, m: PushMessage): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payloadFor(m, s.lang), {
      // تنبيه قديم لا فائدة منه: يُسقط إن لم يصل خلال ساعة (الحرجة 6 ساعات)
      TTL: m.severity === 'critical' ? 6 * 3600 : 3600,
      urgency: m.severity === 'info' ? 'normal' : 'high',
    });
    await db.execute({ sql: `UPDATE push_subscriptions SET last_success_at = ?, fail_count = 0 WHERE id = ?`, args: [now, s.id] });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode ?? 0;
    // 404/410: الجهاز ألغى الاشتراك (أُزيل التطبيق أو سُحب الإذن) — نحذفه
    if (code === 404 || code === 410) {
      await db.execute({ sql: `DELETE FROM push_subscriptions WHERE id = ?`, args: [s.id] });
    } else {
      await db.execute({ sql: `UPDATE push_subscriptions SET fail_count = fail_count + 1 WHERE id = ?`, args: [s.id] });
      await db.execute({ sql: `DELETE FROM push_subscriptions WHERE id = ? AND fail_count >= 20`, args: [s.id] });
      console.error('[hmsi] push send', code || (e instanceof Error ? e.message : e));
    }
    return false;
  }
}

/** يرسل لكل المستخدمين النشطين بأدوار معينة في مستشفى */
export async function pushToRoles(hospitalId: string, roles: Role[], m: PushMessage, exceptUserId?: string | null): Promise<number> {
  if (!roles.length) return 0;
  try {
    const r = await db.execute({
      sql: `SELECT DISTINCT s.user_id FROM push_subscriptions s JOIN users u ON u.id = s.user_id
            WHERE u.hospital_id = ? AND u.is_active = 1 AND u.role IN (${roles.map(() => '?').join(',')})`,
      args: [hospitalId, ...roles],
    });
    const ids = r.rows.map((x) => String((x as unknown as { user_id: string }).user_id)).filter((id) => id !== exceptUserId);
    return pushToUsers(ids, m);
  } catch (e) {
    console.error('[hmsi] push roles failed', e instanceof Error ? e.message : e);
    return 0;
  }
}

// ---------------------------------------------------------------- الاشتراكات

export interface SubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: 'ar' | 'en';
  level: PushLevel;
  device?: string | null;
}

/** الجهاز الواحد لمستخدم واحد: إن سجّل موظف آخر على نفس الجهاز ينتقل الاشتراك إليه */
export async function saveSubscription(userId: string, hospitalId: string, s: SubscribeInput): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, hospital_id, endpoint, p256dh, auth, lang, level, device, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, hospital_id = excluded.hospital_id, p256dh = excluded.p256dh,
            auth = excluded.auth, lang = excluded.lang, level = excluded.level, device = excluded.device, updated_at = excluded.updated_at, fail_count = 0`,
    args: [uuid('psh'), userId, hospitalId, s.endpoint, s.p256dh, s.auth, s.lang, s.level, s.device ?? null, now, now],
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<boolean> {
  const r = await db.execute({ sql: `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, args: [userId, endpoint] });
  return r.rowsAffected > 0;
}

