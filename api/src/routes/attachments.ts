import { Hono } from 'hono';
import type { Context } from 'hono';
import { getSession, requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdmissionScope } from '../repos/chartRepo.js';
import { insertAttachment, getAttachment, deleteAttachment } from '../repos/attachmentRepo.js';
import { writeAudit } from '../lib/audit.js';

export const attachmentRoutes = new Hono();

const MAX_SIZE = 5 * 1024 * 1024;

async function guard(c: Context, admissionId: string): Promise<Response | null> {
  const scope = await getAdmissionScope(admissionId);
  if (!scope) return c.json({ message: 'غير موجود' }, 404);
  return null;
}

attachmentRoutes.post('/:admissionId/attachments', requireAuth(), requirePermission('files.manage'), async (c) => {
  const admissionId = c.req.param('admissionId')!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const session = getSession(c)!;

  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ message: 'الملف مطلوب' }, 400);
  if (file.size > MAX_SIZE) return c.json({ message: 'حجم الملف يتجاوز 5 ميجابايت' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const attachment = await insertAttachment({
    admission_id: admissionId,
    uploaded_by: session.user.full_name_ar,
    file_name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    data: Buffer.from(bytes).toString('base64'),
  });
  await writeAudit({ actorId: session.user.id, action: 'attachment_uploaded', resourceType: 'attachment', resourceId: attachment.id, ip: c.req.header('x-forwarded-for') });
  return c.json(attachment, 201);
});

attachmentRoutes.get('/:admissionId/attachments/:id', requireAuth(), requirePermission('chart.view'), async (c) => {
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const attachment = await getAttachment(id);
  if (!attachment || attachment.admission_id !== admissionId) return c.json({ message: 'الملف غير موجود' }, 404);
  if (!attachment.data) return c.json({ message: 'لا توجد بيانات للملف' }, 404);
  return c.body(Buffer.from(attachment.data, 'base64'), 200, {
    'Content-Type': attachment.mime,
    'Content-Disposition': `attachment; filename="attachment"`,
    'Content-Length': String(attachment.size),
  });
});

attachmentRoutes.delete('/:admissionId/attachments/:id', requireAuth(), requirePermission('files.manage'), async (c) => {
  const admissionId = c.req.param('admissionId')!;
  const id = c.req.param('id')!;
  const session = getSession(c)!;
  const failed = await guard(c, admissionId);
  if (failed) return failed;
  const attachment = await getAttachment(id);
  if (!attachment || attachment.admission_id !== admissionId) return c.json({ message: 'الملف غير موجود' }, 404);
  await deleteAttachment(id);
  await writeAudit({ actorId: session.user.id, action: 'attachment_deleted', resourceType: 'attachment', resourceId: id, ip: c.req.header('x-forwarded-for') });
  return c.body(null, 204);
});