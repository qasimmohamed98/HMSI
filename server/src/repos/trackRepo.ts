import { timingSafeEqual } from 'node:crypto';
import type { PublicTrackInfo, PublicTrackFamily } from '@hmsi/shared';
import { db } from '../../db/index.js';

type Row = Record<string, unknown>;

interface BedContext {
  info: PublicTrackInfo;
  admissionId: string | null;
  familyPin: string | null;
  patient: Row | null;
  attendingDoctor: string | null;
}

/** «محمد علي كريم» → «م*** ع***» — يكفي الأهل للتأكد دون كشف الاسم لأي شخص يصوّر الرمز */
function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => `${[...p][0]}***`).join(' ');
}

async function loadBedContext(code: string): Promise<BedContext | null> {
  const bedRows = await db.execute({
    sql: `SELECT b.id, b.room, b.bed_no,
                 w.name_ar AS ward_name_ar, w.name_en AS ward_name_en,
                 d.name_ar AS department_name_ar, d.name_en AS department_name_en,
                 h.name_ar AS hospital_name_ar, h.name_en AS hospital_name_en
          FROM beds b
          JOIN wards w ON w.id = b.ward_id
          JOIN departments d ON d.id = w.department_id
          JOIN hospitals h ON h.id = d.hospital_id
          WHERE b.code = ? AND h.is_active = 1
          LIMIT 1`,
    args: [code],
  });
  const bed = bedRows.rows[0] as Row | undefined;
  if (!bed) return null;

  const admRows = await db.execute({
    sql: `SELECT a.id, a.admitted_at, a.family_pin,
                 p.full_name_ar, p.full_name_en, p.gender,
                 (SELECT full_name_ar FROM users u WHERE u.id = a.attending_doctor_id) AS attending_doctor,
                 (SELECT MAX(t.created_at) FROM timeline_events t WHERE t.admission_id = a.id) AS last_update
          FROM admissions a JOIN patients p ON p.id = a.patient_id
          WHERE a.bed_id = ? AND a.status = 'active'
          LIMIT 1`,
    args: [String(bed.id)],
  });
  const adm = admRows.rows[0] as Row | undefined;

  const info: PublicTrackInfo = {
    hospital: { name_ar: String(bed.hospital_name_ar), name_en: String(bed.hospital_name_en) },
    department: { name_ar: String(bed.department_name_ar), name_en: String(bed.department_name_en) },
    ward: { name_ar: String(bed.ward_name_ar), name_en: String(bed.ward_name_en) },
    room: String(bed.room),
    bed_no: String(bed.bed_no),
    occupied: Boolean(adm),
    admission: adm
      ? {
          admitted_at: String(adm.admitted_at),
          days: Math.max(0, Math.floor((Date.now() - Date.parse(String(adm.admitted_at))) / 86_400_000)),
          patient_initials: initials(String(adm.full_name_ar)),
          last_update: adm.last_update ? String(adm.last_update) : null,
        }
      : null,
  };

  return {
    info,
    admissionId: adm ? String(adm.id) : null,
    familyPin: adm?.family_pin ? String(adm.family_pin) : null,
    patient: adm ?? null,
    attendingDoctor: adm?.attending_doctor ? String(adm.attending_doctor) : null,
  };
}

/** المعلومات العامة للسرير — بدون أي بيانات طبية */
export async function getPublicTrack(code: string): Promise<PublicTrackInfo | null> {
  return (await loadBedContext(code))?.info ?? null;
}

export type FamilyTrackResult = { ok: true; data: PublicTrackFamily } | { ok: false; reason: 'not_found' | 'no_admission' | 'bad_pin' };

/** بيانات موسّعة لذوي المريض بعد التحقق من رمز العائلة */
export async function getFamilyTrack(code: string, pin: string): Promise<FamilyTrackResult> {
  const ctx = await loadBedContext(code);
  if (!ctx) return { ok: false, reason: 'not_found' };
  if (!ctx.admissionId || !ctx.familyPin || !ctx.patient) return { ok: false, reason: 'no_admission' };

  const a = Buffer.from(pin);
  const b = Buffer.from(ctx.familyPin);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_pin' };

  const vit = await db.execute({
    sql: `SELECT recorded_at, temperature, pulse, bp_systolic, bp_diastolic, spo2 FROM vitals WHERE admission_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    args: [ctx.admissionId],
  });
  const v = vit.rows[0] as Row | undefined;
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));

  return {
    ok: true,
    data: {
      ...ctx.info,
      patient: {
        full_name_ar: String(ctx.patient.full_name_ar),
        full_name_en: ctx.patient.full_name_en ? String(ctx.patient.full_name_en) : '',
        gender: String(ctx.patient.gender) as PublicTrackFamily['patient']['gender'],
      },
      attending_doctor: ctx.attendingDoctor,
      latest_vitals: v
        ? {
            recorded_at: String(v.recorded_at),
            temperature: num(v.temperature),
            pulse: num(v.pulse),
            bp_systolic: num(v.bp_systolic),
            bp_diastolic: num(v.bp_diastolic),
            spo2: num(v.spo2),
          }
        : null,
    },
  };
}
