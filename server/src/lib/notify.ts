import type { Role } from '@hmsi/shared';
import { db, uuid } from '../../db/index.js';
import { activeDoctorIds, activeNurseId } from './careTeam.js';
import { pushToRoles, pushToUsers, type PushMessage } from './push.js';

/**
 * إشعارات الجرس داخل النظام. تُنشأ عند الأحداث السريرية المهمة ولا تُفشل العملية الأصلية أبداً.
 * الهدف: مستخدم بعينه (الطبيب المعالج) أو أدوار في نفس المستشفى.
 */

export type Severity = 'info' | 'warning' | 'critical';

/** إرسالات الأجهزة الجارية — لا ننتظرها في الطلب، والاختبارات تنتظرها بـ flushPush() */
const pending = new Set<Promise<unknown>>();
export function trackPush(p: Promise<unknown>): void {
  pending.add(p);
  void p.finally(() => pending.delete(p));
}
export async function flushPush(): Promise<void> {
  await Promise.all([...pending]);
}

export interface NotifyInput {
  hospitalId: string;
  userId?: string | null;
  roles?: Role[];
  kind: string;
  severity?: Severity;
  titleAr: string;
  titleEn?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  link?: string | null;
  admissionId?: string | null;
  createdById?: string | null;
  /**
   * نص إشعار الجهاز (يظهر على شاشة القفل): بلا اسم مريض. إن لم يُحدَّد يُرسل العنوان وحده —
   * لأن body_ar قد يحمل اسم المريض.
   */
  pushBodyAr?: string | null;
  pushBodyEn?: string | null;
}

export async function notify(n: NotifyInput): Promise<void> {
  if (!n.userId && !n.roles?.length) return;
  // لا يُشعَر المستخدم بما فعله بنفسه
  if (n.userId && n.userId === n.createdById) return;
  const id = uuid('ntf');
  try {
    await db.execute({
      sql: `INSERT INTO notifications (id, hospital_id, target_user_id, target_roles, kind, severity, title_ar, title_en, body_ar, body_en, link, admission_id, created_by_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        n.hospitalId,
        n.userId ?? null,
        n.userId ? null : n.roles!.join(','),
        n.kind,
        n.severity ?? 'info',
        n.titleAr,
        n.titleEn ?? null,
        n.bodyAr ?? null,
        n.bodyEn ?? null,
        n.link ?? null,
        n.admissionId ?? null,
        n.createdById ?? null,
        new Date().toISOString(),
      ],
    });
  } catch (e) {
    console.error('[hmsi] notify failed', e instanceof Error ? e.message : e);
    return;
  }
  // إشعار الجهاز لا يؤخر الطلب ولا يُفشله
  const m: PushMessage = {
    tag: id,
    kind: n.kind,
    severity: n.severity ?? 'info',
    titleAr: n.titleAr,
    titleEn: n.titleEn,
    bodyAr: n.pushBodyAr ?? null,
    bodyEn: n.pushBodyEn ?? n.pushBodyAr ?? null,
    link: n.link,
  };
  trackPush(n.userId ? pushToUsers([n.userId], m) : pushToRoles(n.hospitalId, n.roles!, m, n.createdById));
}

export interface AdmissionInfo {
  hospitalId: string;
  patientId: string;
  patientAr: string;
  patientEn: string | null;
  attendingId: string | null;
  bedAr: string;
}

export async function admissionInfo(admissionId: string): Promise<AdmissionInfo | null> {
  const r = await db.execute({
    sql: `SELECT p.hospital_id, p.id AS patient_id, p.full_name_ar, p.full_name_en, a.attending_doctor_id, a.room, a.bed_no
          FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = ? LIMIT 1`,
    args: [admissionId],
  });
  const row = r.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    hospitalId: String(row.hospital_id),
    patientId: String(row.patient_id),
    patientAr: String(row.full_name_ar),
    patientEn: row.full_name_en ? String(row.full_name_en) : null,
    attendingId: row.attending_doctor_id ? String(row.attending_doctor_id) : null,
    bedAr: `${String(row.room ?? '')}/${String(row.bed_no ?? '')}`,
  };
}

/**
 * إشعار مرتبط بمريض منوّم، يُوجَّه لفريق رعايته:
 * - toAttending: أطباء الفريق (أو الطبيب المعالج)؛ إن لم يوجد طبيب → مدير المستشفى
 * - toNurse: الممرض المعيَّن؛ إن لم يُعيَّن → كل التمريض
 * - roles / userIds: أدوار أو مستخدمون محددون
 */
export async function notifyAdmission(
  admissionId: string,
  o: Omit<NotifyInput, 'hospitalId' | 'userId' | 'link' | 'admissionId' | 'bodyAr' | 'bodyEn'> & {
    toAttending?: boolean;
    toNurse?: boolean;
    userIds?: string[];
    bodyAr?: string;
    bodyEn?: string;
  },
): Promise<void> {
  const info = await admissionInfo(admissionId);
  if (!info) return;
  const base = {
    hospitalId: info.hospitalId,
    kind: o.kind,
    severity: o.severity,
    titleAr: o.titleAr,
    titleEn: o.titleEn,
    bodyAr: [info.patientAr, info.bedAr, o.bodyAr].filter(Boolean).join(' · '),
    bodyEn: [info.patientEn ?? info.patientAr, info.bedAr, o.bodyEn ?? o.bodyAr].filter(Boolean).join(' · '),
    link: `/patients/${info.patientId}`,
    admissionId,
    createdById: o.createdById,
    // على شاشة القفل: السرير والتفصيل فقط، بلا اسم المريض
    pushBodyAr: [`سرير ${info.bedAr}`, o.bodyAr].filter(Boolean).join(' · '),
    pushBodyEn: [`Bed ${info.bedAr}`, o.bodyEn ?? o.bodyAr].filter(Boolean).join(' · '),
  };
  const users = new Set<string>(o.userIds ?? []);
  if (o.toAttending) {
    const docs = await activeDoctorIds(admissionId);
    if (!docs.length && info.attendingId) docs.push(info.attendingId);
    if (docs.length) docs.forEach((d) => users.add(d));
    else await notify({ ...base, roles: ['admin'] });
  }
  if (o.toNurse) {
    const nurse = await activeNurseId(admissionId);
    if (nurse) users.add(nurse);
    else await notify({ ...base, roles: ['nurse'] });
  }
  for (const u of users) await notify({ ...base, userId: u });
  if (o.roles?.length) await notify({ ...base, roles: o.roles });
}
