import type { Attachment } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { moveToTrash, type TrashActor } from '../lib/trash.js';

export async function getAttachment(id: string): Promise<Attachment & { data: string | null } | null> {
  const rows = await db.execute({
    sql: `SELECT id, admission_id, uploaded_by, file_name, mime, size, created_at, data
          FROM attachments WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    admission_id: String(r.admission_id),
    uploaded_by: String(r.uploaded_by),
    file_name: String(r.file_name),
    mime: String(r.mime),
    size: Number(r.size ?? 0),
    created_at: String(r.created_at),
    data: r.data ? String(r.data) : null,
  };
}

export async function insertAttachment(input: {
  admission_id: string;
  uploaded_by: string;
  file_name: string;
  mime: string;
  size: number;
  data: string;
}): Promise<Attachment> {
  const id = uuid('at');
  await db.execute({
    sql: `INSERT INTO attachments (id, admission_id, uploaded_by, file_name, mime, size, storage_key, created_at, data)
          VALUES (?, ?, ?, ?, ?, ?, 'inline', ?, ?)`,
    args: [id, input.admission_id, input.uploaded_by, input.file_name, input.mime, input.size, new Date().toISOString(), input.data],
  });
  return {
    id,
    admission_id: input.admission_id,
    uploaded_by: input.uploaded_by,
    file_name: input.file_name,
    mime: input.mime,
    size: input.size,
    created_at: new Date().toISOString(),
  };
}

/** لا حذف نهائي: المرفق (مع محتواه) ينتقل إلى سلة المحذوفات */
export async function deleteAttachment(id: string, hospitalId: string, actor: TrashActor): Promise<void> {
  const a = await getAttachment(id);
  await moveToTrash({ table: 'attachments', id, hospitalId, kind: 'attachment', label: a?.file_name ?? id, actor, admissionId: a?.admission_id ?? null });
}