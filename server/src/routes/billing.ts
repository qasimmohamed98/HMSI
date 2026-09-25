import { Hono } from 'hono';
import type { PaymentInfo, PaymentNotice } from '@hmsi/shared';
import { PaymentInfoSchema, PaymentNoticeSchema, RejectNoticeSchema } from '@hmsi/shared/validate';
import { getSession, requireAuth, requirePermission, sessionHas } from '../middleware/auth.js';
import { parseBody } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { clientIp } from '../config.js';
import { db, uuid } from '../../db/index.js';

/**
 * الدفع والاشتراك.
 * - مستخدمو المستشفى: يرون حالة الاشتراك ومعلومات الدفع (متاح حتى بعد انتهاء الاشتراك).
 * - مدير المستشفى: يرسل «إشعار دفع» بعد التحويل.
 * - المدير العام: يضبط معلومات الدفع ويراجع الإشعارات (التفعيل عبر /api/hospitals/:id/subscription).
 */
export const billingRoutes = new Hono();

type Row = Record<string, unknown>;
const EMPTY_INFO: PaymentInfo = { price: '', bank_name: '', account_name: '', account_number: '', phone: '', notes: '' };

export async function getPaymentInfo(): Promise<PaymentInfo> {
  const rows = await db.execute({ sql: `SELECT value FROM system_settings WHERE key = 'payment_info' LIMIT 1`, args: [] });
  if (rows.rows.length === 0) return EMPTY_INFO;
  try {
    return { ...EMPTY_INFO, ...(JSON.parse(String((rows.rows[0] as Row).value)) as Partial<PaymentInfo>) };
  } catch {
    return EMPTY_INFO;
  }
}

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

function mapNotice(r: Row): PaymentNotice {
  return {
    id: String(r.id),
    hospital_id: String(r.hospital_id),
    hospital_name_ar: r.hospital_name_ar ? String(r.hospital_name_ar) : undefined,
    hospital_name_en: r.hospital_name_en ? String(r.hospital_name_en) : undefined,
    amount: String(r.amount),
    method: String(r.method),
    reference: s(r.reference),
    note: s(r.note),
    submitted_by: String(r.submitted_by),
    submitted_at: String(r.submitted_at),
    status: String(r.status) as PaymentNotice['status'],
    reviewed_by: s(r.reviewed_by),
    reviewed_at: s(r.reviewed_at),
    review_note: s(r.review_note),
  };
}

const NOTICE_SELECT = `SELECT n.*, h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en FROM payment_notices n JOIN hospitals h ON h.id = n.hospital_id`;

/** حالة الاشتراك + معلومات الدفع + إشعارات هذا المستشفى */
billingRoutes.get('/', requireAuth(), async (c) => {
  const session = getSession(c)!;
  const notices = await db.execute({ sql: `${NOTICE_SELECT} WHERE n.hospital_id = ? ORDER BY n.submitted_at DESC LIMIT 20`, args: [session.user.hospital_id] });
  return c.json(
    {
      subscription: session.user.subscription,
      payment_info: await getPaymentInfo(),
      notices: notices.rows.map((r) => mapNotice(r as Row)),
      can_submit: sessionHas(c, 'settings.manage'),
    },
    200,
  );
});

billingRoutes.post('/notices', requireAuth(), requirePermission('settings.manage'), async (c) => {
  const parsed = await parseBody(c, PaymentNoticeSchema);
  if (!parsed.ok) return parsed.json;
  const input = parsed.data as (typeof PaymentNoticeSchema)['_output'];
  const session = getSession(c)!;
  const pending = await db.execute({ sql: `SELECT COUNT(*) AS n FROM payment_notices WHERE hospital_id = ? AND status = 'pending'`, args: [session.user.hospital_id] });
  if (Number((pending.rows[0] as Row).n) >= 3) throw new HttpError('لديك إشعارات دفع قيد المراجعة — انتظر مراجعتها', 409);
  const id = uuid('pay');
  await db.execute({
    sql: `INSERT INTO payment_notices (id, hospital_id, amount, method, reference, note, submitted_by, submitted_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    args: [id, session.user.hospital_id, input.amount, input.method, input.reference || null, input.note || null, session.user.full_name_ar, new Date().toISOString()],
  });
  await writeAudit({ actorId: session.user.id, action: 'payment_notice_submitted', resourceType: 'payment_notice', resourceId: id, ip: clientIp(c) });
  const row = await db.execute({ sql: `${NOTICE_SELECT} WHERE n.id = ?`, args: [id] });
  return c.json(mapNotice(row.rows[0] as Row), 201);
});

// ------------------------------ المدير العام

billingRoutes.get('/notices', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const status = c.req.query('status');
  const rows = await db.execute({
    sql: `${NOTICE_SELECT} ${status ? 'WHERE n.status = ?' : ''} ORDER BY (n.status = 'pending') DESC, n.submitted_at DESC LIMIT 200`,
    args: status ? [status] : [],
  });
  return c.json(rows.rows.map((r) => mapNotice(r as Row)), 200);
});

billingRoutes.post('/notices/:id/reject', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, RejectNoticeSchema);
  if (!parsed.ok) return parsed.json;
  const { review_note } = parsed.data as (typeof RejectNoticeSchema)['_output'];
  const session = getSession(c)!;
  const id = c.req.param('id');
  const res = await db.execute({
    sql: `UPDATE payment_notices SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ? AND status = 'pending'`,
    args: [session.user.full_name_ar, new Date().toISOString(), review_note ?? null, id],
  });
  if (res.rowsAffected === 0) throw new HttpError('الإشعار غير موجود أو تمت مراجعته', 409);
  await writeAudit({ actorId: session.user.id, action: 'payment_notice_rejected', resourceType: 'payment_notice', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});

billingRoutes.put('/payment-info', requireAuth(), requirePermission('hospitals.manage'), async (c) => {
  const parsed = await parseBody(c, PaymentInfoSchema);
  if (!parsed.ok) return parsed.json;
  const info = parsed.data as PaymentInfo;
  const session = getSession(c)!;
  await db.execute({
    sql: `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES ('payment_info', ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    args: [JSON.stringify(info), session.user.full_name_ar, new Date().toISOString()],
  });
  await writeAudit({ actorId: session.user.id, action: 'payment_info_updated', resourceType: 'system', resourceId: 'payment_info', ip: clientIp(c) });
  return c.json(info, 200);
});
