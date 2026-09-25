import { db, uuid } from '../../db/index.js';
import type { Executor } from './audit.js';

/** مساعدات فريق الرعاية المشتركة بين المسارات */

export interface CareMember {
  id: string;
  admission_id: string;
  user_id: string;
  role: 'doctor' | 'nurse';
  specialty: string | null;
  is_primary: boolean;
  assigned_at: string;
  full_name_ar: string;
  full_name_en: string | null;
}

export async function activeTeam(admissionId: string): Promise<CareMember[]> {
  const r = await db.execute({
    sql: `SELECT ct.id, ct.admission_id, ct.user_id, ct.role, ct.specialty, ct.is_primary, ct.assigned_at, u.full_name_ar, u.full_name_en
          FROM care_team ct JOIN users u ON u.id = ct.user_id
          WHERE ct.admission_id = ? AND ct.ended_at IS NULL
          ORDER BY ct.role, ct.is_primary DESC, ct.assigned_at`,
    args: [admissionId],
  });
  return r.rows.map((row) => {
    const x = row as unknown as Record<string, unknown>;
    return {
      id: String(x.id),
      admission_id: String(x.admission_id),
      user_id: String(x.user_id),
      role: String(x.role) as 'doctor' | 'nurse',
      specialty: x.specialty ? String(x.specialty) : null,
      is_primary: Number(x.is_primary) === 1,
      assigned_at: String(x.assigned_at),
      full_name_ar: String(x.full_name_ar),
      full_name_en: x.full_name_en ? String(x.full_name_en) : null,
    };
  });
}

export async function activeNurseId(admissionId: string): Promise<string | null> {
  const r = await db.execute({ sql: `SELECT user_id FROM care_team WHERE admission_id = ? AND role = 'nurse' AND ended_at IS NULL LIMIT 1`, args: [admissionId] });
  return r.rows[0] ? String((r.rows[0] as unknown as Record<string, unknown>).user_id) : null;
}

export async function activeDoctorIds(admissionId: string): Promise<string[]> {
  const r = await db.execute({ sql: `SELECT user_id FROM care_team WHERE admission_id = ? AND role = 'doctor' AND ended_at IS NULL`, args: [admissionId] });
  return r.rows.map((x) => String((x as unknown as Record<string, unknown>).user_id));
}

/** إضافة عضو (يتجاهل إن كان عضواً فعّالاً بالفعل) */
export async function addMember(
  exec: Executor,
  m: { admissionId: string; userId: string; role: 'doctor' | 'nurse'; specialty?: string | null; primary?: boolean; byId?: string | null },
): Promise<string> {
  const id = uuid('ct');
  await exec.execute({
    sql: `INSERT INTO care_team (id, admission_id, user_id, role, specialty, is_primary, assigned_by_id, assigned_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM care_team WHERE admission_id = ? AND user_id = ? AND ended_at IS NULL)`,
    args: [id, m.admissionId, m.userId, m.role, m.specialty ?? null, m.primary ? 1 : 0, m.byId ?? null, new Date().toISOString(), m.admissionId, m.userId],
  });
  return id;
}

export async function endMembers(exec: Executor, admissionId: string, reason: string, where = ''): Promise<void> {
  await exec.execute({
    sql: `UPDATE care_team SET ended_at = ?, end_reason = ? WHERE admission_id = ? AND ended_at IS NULL ${where}`,
    args: [new Date().toISOString(), reason, admissionId],
  });
}
