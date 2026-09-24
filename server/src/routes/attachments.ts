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

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((x, i) => b[offset + i] === x);

/**
 * نوع الملف يُعلنه المتصفح ويمكن تزويره؛ لذلك نتحقق من «التوقيع» الفعلي في أول البايتات
 * ونرفض أي ملف لا يطابق نوعه المعلن (مثلاً HTML/SVG/EXE بامتداد أو نوع صورة).
 */
export function contentMatchesMime(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mime === 'image/gif') return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
  if (mime === 'image/webp') return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  if (mime === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  // docx/xlsx = حاوية ZIP؛ doc/xls = حاوية OLE
  if (mime.startsWith('application/vnd.openxmlformats-officedocument.')) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (mime === 'application/msword' || mime === 'application/vnd.ms-excel') return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (mime === 'text/plain') {
    // نص UTF-8 صالح بدون بايتات تحكم ثنائية وبدون وسوم HTML/سكربت
    if (bytes.some((b) => b === 0)) return false;
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return false;
    }
    return !/<\s*(script|html|svg|iframe)\b/i.test(text);
  }
  return false;
}

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
  if (!contentMatchesMime(bytes, mime)) return c.json({ message: 'محتوى الملف لا يطابق نوعه — تم رفضه' }, 415);
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
    // حتى لو فُتح الملف مباشرة: لا سكربتات ولا تضمين
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
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
