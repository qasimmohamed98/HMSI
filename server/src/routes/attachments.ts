import { Hono } from 'hono';
import type { Context } from 'hono';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { insertAttachment, getAttachment, deleteAttachment } from '../repos/attachmentRepo.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { clientIp } from '../config.js';

export const attachmentRoutes = new Hono();

/**
 * المرفقات تُخزَّن داخل قاعدة البيانات (base64).
 * حد Netlify Functions لجسم الطلب 6MB — لذلك الحد 4MB للملف مع هامش لترميز multipart.
 */
export const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024;

const ALLOWED_MIME = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel))$/;

async function guard(c: Context): Promise<string> {
  const admissionId = c.req.param('admissionId') ?? '';
  const scope = await getAdmissionScope(admissionId, getSession(c)!.user.hospital_id);
  if (!scope) throw new HttpError('التنويم غير موجود', 404);
  return admissionId;
}

/** اسم ملف آمن لرأس Content-Disposition (يدعم العربية عبر RFC 5987) */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'attachment';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

attachmentRoutes.post('/:admissionId/attachments', requireAuth(), requirePermission('files.manage'), async (c) => {
  const admissionId = await guard(c);
  const session = getSession(c)!;

  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_ATTACHMENT_SIZE + 64 * 1024) return c.json({ message: 'حجم الملف يتجاوز 4 ميجابايت' }, 413);

  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ message: 'الملف مطلوب' }, 400);
  if (file.size === 0) return c.json({ message: 'الملف فارغ' }, 400);
  if (file.size > MAX_ATTACHMENT_SIZE) return c.json({ message: 'حجم الملف يتجاوز 4 ميجابايت' }, 413);
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.test(mime)) return c.json({ message: 'نوع الملف غير مسموح (صور، PDF، نص، Word، Excel)' }, 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const attachment = await insertAttachment({
    admission_id: admissionId,
    uploaded_by: session.user.full_name_ar,
    file_name: file.name.slice(0, 200),
    mime,
    size: file.size,
    data: Buffer.from(bytes).toString('base64'),
  });
  await writeAudit({ actorId: session.user.id, action: 'attachment_uploaded', resourceType: 'attachment', resourceId: attachment.id, ip: clientIp(c) });
  return c.json(attachment, 201);
});

attachmentRoutes.get('/:admissionId/attachments/:id', requireAuth(), requirePermission('chart.view'), async (c) => {
  const admissionId = await guard(c);
  const session = getSession(c)!;
  const id = c.req.param('id');
  const attachment = await getAttachment(id);
  if (!attachment || attachment.admission_id !== admissionId || !attachment.data) return c.json({ message: 'الملف غير موجود' }, 404);
  await writeAudit({ actorId: session.user.id, action: 'attachment_downloaded', resourceType: 'attachment', resourceId: id, ip: clientIp(c) });
  const body = Buffer.from(attachment.data, 'base64');
  return c.body(body, 200, {
    // لا نعرض الملف داخل الصفحة أبداً (حماية من XSS عبر ملفات HTML/SVG)
    'Content-Type': ALLOWED_MIME.test(attachment.mime) ? attachment.mime : 'application/octet-stream',
    'Content-Disposition': contentDisposition(attachment.file_name),
    'Content-Length': String(body.length),
  });
});

attachmentRoutes.delete('/:admissionId/attachments/:id', requireAuth(), requirePermission('files.manage'), async (c) => {
  const admissionId = await guard(c);
  const session = getSession(c)!;
  const id = c.req.param('id');
  const attachment = await getAttachment(id);
  if (!attachment || attachment.admission_id !== admissionId) return c.json({ message: 'الملف غير موجود' }, 404);
  await deleteAttachment(id);
  await writeAudit({ actorId: session.user.id, action: 'attachment_deleted', resourceType: 'attachment', resourceId: id, ip: clientIp(c) });
  return c.body(null, 204);
});
