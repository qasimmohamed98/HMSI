import { createHash } from 'node:crypto';
import { db, uuid } from '../../db/index.js';

/**
 * سجل الأخطاء للمدير العام. لا يُخزَّن فيه أي سر أو بيانات مريض قدر الإمكان:
 * تُحذف قيم متغيرات البيئة والرموز الطويلة والأرقام الطويلة (هوية/هاتف) والبريد.
 */
export function redactText(text: string, max = 2000): string {
  let out = text;
  for (const v of Object.values(process.env)) {
    if (v && v.length >= 8) out = out.split(v).join('***');
  }
  return out
    .replace(/eyJ[\w.-]{20,}/g, '***')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '***')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '***@***')
    .replace(/\d{6,}/g, '######')
    .slice(0, max);
}

export interface ErrorInput {
  source: 'server' | 'client' | 'job';
  message: string;
  detail?: string | null;
  path?: string | null;
  hospitalId?: string | null;
  userId?: string | null;
  userAgent?: string | null;
}

/** يسجل الخطأ؛ المتكرر في نفس اليوم يزيد العدّاد فقط. لا يرمي أبداً. */
export async function recordError(e: ErrorInput): Promise<void> {
  try {
    const message = redactText(e.message || 'Error', 500);
    // مسار بلا معرّفات حتى تتجمع الأخطاء المتشابهة
    const path = e.path ? redactText(e.path.split('?')[0]!.replace(/\/[\w-]*\d[\w-]*/g, '/:id'), 200) : null;
    const fingerprint = createHash('sha1').update(`${e.source}|${message}|${path ?? ''}`).digest('hex').slice(0, 20);
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const upd = await db.execute({
      sql: `UPDATE error_events SET count = count + 1, last_seen_at = ? WHERE fingerprint = ? AND substr(last_seen_at, 1, 10) = ?`,
      args: [now, fingerprint, day],
    });
    if (upd.rowsAffected > 0) return;
    await db.execute({
      sql: `INSERT INTO error_events (id, source, fingerprint, message, detail, path, hospital_id, user_id, user_agent, count, created_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [uuid('err'), e.source, fingerprint, message, e.detail ? redactText(e.detail) : null, path, e.hospitalId ?? null, e.userId ?? null, e.userAgent?.slice(0, 200) ?? null, now, now],
    });
    // الاحتفاظ 90 يوماً
    if (Math.random() < 0.05) await db.execute({ sql: `DELETE FROM error_events WHERE last_seen_at < ?`, args: [new Date(Date.now() - 90 * 86_400_000).toISOString()] });
  } catch (err) {
    console.error('[hmsi] could not record error', err instanceof Error ? err.message : err);
  }
}
