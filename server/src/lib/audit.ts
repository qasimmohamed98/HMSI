import type { InStatement } from '@libsql/client';
import { db, uuid } from '../../db/index.js';

/** أي منفّذ SQL — العميل العادي أو transaction */
export interface Executor {
  execute(stmt: InStatement): Promise<unknown>;
}

export interface AuditMeta {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAudit(entry: AuditMeta, exec: Executor = db): Promise<void> {
  await exec.execute({
    sql: `INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, meta_json, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      uuid('aud'),
      entry.actorId,
      entry.action,
      entry.resourceType,
      entry.resourceId ?? null,
      JSON.stringify(entry.meta ?? {}),
      entry.ip ?? null,
    ],
  });
}

export interface TimelineMeta {
  admissionId: string;
  actor: string;
  actorId: string | null;
  type: string;
  titleAr: string;
  titleEn: string;
}

export async function addTimeline(meta: TimelineMeta, at: string = new Date().toISOString(), exec: Executor = db): Promise<void> {
  await exec.execute({
    sql: `INSERT INTO timeline_events (id, admission_id, actor_id, actor, type, title_ar, title_en, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid('tl'), meta.admissionId, meta.actorId, meta.actor, meta.type, meta.titleAr, meta.titleEn, at],
  });
}
