import { Hono } from 'hono';
import type { Context } from 'hono';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { HttpError } from '../lib/errors.js';
import { writeAudit } from '../lib/audit.js';
import { clientIp } from '../config.js';
import { db } from '../../db/index.js';

/**
 * ملصقات الطابعات الحرارية بلغة ZPL (Zebra وما يتوافق معها، 203dpi).
 *
 * المتصفح لا يستطيع الإرسال مباشرة إلى منفذ الطابعة (9100)، والدالة على Netlify لا ترى شبكة المستشفى؛
 * لذلك هذه النقاط تعيد نص ZPL جاهزاً ليُرسل عبر:
 *   - وكيل طباعة محلي (مثل Zebra Browser Print) يجلب الرابط ويرسله للطابعة، أو
 *   - تنزيل الملف وإرساله يدوياً.
 * وللطباعة من المتصفح مباشرة على أي طابعة معرّفة في النظام توجد نسخة HTML في الواجهة.
 *
 * النص العربي يتطلب خط TTF عربياً محمّلاً على الطابعة (E:ARIAL.TTF افتراضياً) وبرنامجاً ثابتاً يدعم ^PA.
 */
export const labelRoutes = new Hono();

const ARABIC_FONT = process.env.LABEL_FONT ?? 'E:ARIAL.TTF';

/** ^FH: الأحرف الخاصة في ZPL تُكتب بصيغة hex بعد «_» */
export function zplText(v: unknown): string {
  return String(v ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[_^~\\]/g, (ch) => `_${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

const field = (x: number, y: number, size: number, text: unknown) =>
  `^FO${x},${y}^A@N,${size},${size},${ARABIC_FONT}^FH^FD${zplText(text)}^FS`;

function ageFrom(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

async function loadPatient(c: Context) {
  const admissionId = c.req.param('admissionId') ?? '';
  const scope = await getAdmissionScope(admissionId, getSession(c)!.user.hospital_id);
  if (!scope) throw new HttpError('التنويم غير موجود', 404);
  const rows = await db.execute({
    sql: `SELECT file_number, full_name_ar, full_name_en, gender, birth_date, blood_type FROM patients WHERE id = ? LIMIT 1`,
    args: [scope.patientId],
  });
  return { admission: scope.admission, patient: { ...(rows.rows[0] as Record<string, unknown>) } };
}

function zpl(c: Context, body: string, fileName: string) {
  return c.body(body, 200, {
    'Content-Type': 'application/zpl; charset=utf-8',
    'Content-Disposition': `inline; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  });
}

/** سوار المريض: 25×250 مم تقريباً (يُطبع أفقياً) — الاسم، رقم الملف، العمر/الجنس، فصيلة الدم، باركود رقم الملف */
labelRoutes.get('/:admissionId/labels/wristband', requireAuth(), requirePermission('chart.view'), async (c) => {
  const { admission, patient } = await loadPatient(c);
  const s = getSession(c)!;
  const name = patient.full_name_ar;
  const body = [
    '^XA^CI28^PA0,1,1,1^PW1800^LL200',
    field(40, 20, 34, name),
    patient.full_name_en ? field(40, 62, 24, patient.full_name_en) : '',
    field(40, 100, 24, `${String(patient.file_number)}  ·  ${ageFrom(String(patient.birth_date))}y  ·  ${patient.gender === 'male' ? 'M' : 'F'}  ·  ${String(patient.blood_type)}`),
    field(40, 140, 22, `${admission.ward_name_ar ?? ''} ${admission.room}-${admission.bed_no}  ·  ${admission.admitted_at.slice(0, 10)}`),
    `^FO1100,30^BY2^BCN,110,Y,N,N^FH^FD${zplText(patient.file_number)}^FS`,
    '^XZ',
  ].join('\n');
  await writeAudit({ actorId: s.user.id, action: 'label_printed', resourceType: 'admission', resourceId: admission.id, ip: clientIp(c) });
  return zpl(c, body, `wristband-${String(patient.file_number)}.zpl`);
});

/** ملصق عيّنة مختبر: 50×25 مم — باركود معرّف الطلب + اسم المريض ورقم الملف واسم الفحص */
labelRoutes.get('/:admissionId/labs/:id/label', requireAuth(), requirePermission('chart.view'), async (c) => {
  const { admission, patient } = await loadPatient(c);
  const s = getSession(c)!;
  const rows = await db.execute({
    sql: `SELECT id, test_name_ar, test_name_en, ordered_at FROM lab_results WHERE id = ? AND admission_id = ? LIMIT 1`,
    args: [c.req.param('id'), admission.id],
  });
  if (rows.rows.length === 0) throw new HttpError('الطلب غير موجود', 404);
  const lab = rows.rows[0] as Record<string, unknown>;
  const body = [
    '^XA^CI28^PA0,1,1,1^PW400^LL200',
    field(12, 8, 22, patient.full_name_ar),
    field(12, 36, 18, `${String(patient.file_number)} · ${String(lab.ordered_at).slice(0, 16).replace('T', ' ')}`),
    `^FO12,62^BY1^BCN,70,N,N,N^FH^FD${zplText(lab.id)}^FS`,
    field(12, 142, 20, lab.test_name_en || lab.test_name_ar),
    '^XZ',
  ].join('\n');
  await writeAudit({ actorId: s.user.id, action: 'label_printed', resourceType: 'lab_result', resourceId: String(lab.id), ip: clientIp(c) });
  return zpl(c, body, `specimen-${String(lab.id)}.zpl`);
});
