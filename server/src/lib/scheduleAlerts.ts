import { calcMews, doseStatus, vitalsStatus, type Consciousness } from '@hmsi/shared';
import { db } from '../../db/index.js';
import { pushToUsers, type PushMessage } from './push.js';

/**
 * تنبيهات المواعيد على الخادم: جرعة حان موعدها أو تأخرت، وعلامات حيوية حان قياسها أو تأخر —
 * تُرسل لجهاز الممرض المعيَّن على المريض حتى والنظام مغلق.
 * (نفس منطق ScheduleWatcher في الواجهة، ونفس المعرّف كـ tag، فلا يظهر التنبيه مرتين على جهاز واحد.)
 *
 * التوقيت: المواعيد الثابتة (8، 14، 20…) تُحسب بتوقيت العملية — خدمة الإنتاج تعمل بـ TZ=Asia/Baghdad.
 */

const INTERVAL_MS = 60_000;
/** أكثر من هذا العدد لممرض واحد في الدورة نفسها → إشعار ملخص واحد بدل سيل */
const SUMMARY_AFTER = 3;

interface Event {
  key: string;
  nurseId: string;
  late: boolean;
  msg: PushMessage;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function collect(now: Date): Promise<Event[]> {
  const events: Event[] = [];
  const nurseCol = `(SELECT ct.user_id FROM care_team ct WHERE ct.admission_id = a.id AND ct.role = 'nurse' AND ct.ended_at IS NULL LIMIT 1)`;

  const meds = await db.execute({
    sql: `SELECT m.id, m.name_ar, m.name_en, m.dose, m.frequency, m.start_at, m.end_at, m.created_at, a.room, a.bed_no,
                 (SELECT ma.administered_at FROM medication_administrations ma WHERE ma.medication_id = m.id ORDER BY ma.administered_at DESC LIMIT 1) AS last_at,
                 ${nurseCol} AS nurse_id
          FROM medications m
          JOIN admissions a ON a.id = m.admission_id AND a.status = 'active'
          WHERE m.status = 'active' AND ${nurseCol} IS NOT NULL`,
    args: [],
  });
  for (const row of meds.rows) {
    const m = row as unknown as Record<string, string | null>;
    const s = doseStatus({ frequency: m.frequency, start_at: m.start_at, created_at: m.created_at, end_at: m.end_at }, m.last_at, now);
    if ((s.state !== 'due' && s.state !== 'overdue') || !s.due_at) continue;
    const late = s.state === 'overdue';
    const key = `sched-med-${m.id}-${s.due_at}-${s.state}`;
    const bed = `${m.room ?? ''}/${m.bed_no ?? ''}`;
    events.push({
      key,
      nurseId: String(m.nurse_id),
      late,
      msg: {
        tag: key,
        kind: 'dose_due',
        severity: late ? 'warning' : 'info',
        titleAr: `${late ? 'جرعة متأخرة' : 'حان موعد الجرعة'}: ${m.name_ar} ${m.dose ?? ''}`.trim(),
        titleEn: `${late ? 'Overdue dose' : 'Dose due'}: ${m.name_en || m.name_ar} ${m.dose ?? ''}`.trim(),
        bodyAr: `سرير ${bed}`,
        bodyEn: `Bed ${bed}`,
        link: '/medication-rounds',
      },
    });
  }

  const vit = await db.execute({
    sql: `SELECT a.id AS admission_id, a.admitted_at, a.room, a.bed_no, p.id AS patient_id, cp.vitals_interval_hours,
                 v.recorded_at AS last_at, v.temperature, v.pulse, v.respiratory_rate, v.bp_systolic, v.consciousness,
                 ${nurseCol} AS nurse_id
          FROM admissions a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN care_plans cp ON cp.admission_id = a.id
          LEFT JOIN vitals v ON v.id = (SELECT id FROM vitals WHERE admission_id = a.id ORDER BY recorded_at DESC LIMIT 1)
          WHERE a.status = 'active' AND ${nurseCol} IS NOT NULL`,
    args: [],
  });
  for (const row of vit.rows) {
    const r = row as unknown as Record<string, unknown>;
    const mews = r.last_at
      ? calcMews({ bp_systolic: num(r.bp_systolic), pulse: num(r.pulse), respiratory_rate: num(r.respiratory_rate), temperature: num(r.temperature), consciousness: (r.consciousness as Consciousness | null) ?? null })
      : null;
    const s = vitalsStatus({ admitted_at: String(r.admitted_at), last_at: (r.last_at as string | null) ?? null, interval_hours: num(r.vitals_interval_hours), mews: mews ? { level: mews.level } : null }, now);
    if (s.state !== 'due' && s.state !== 'overdue') continue;
    const late = s.state === 'overdue';
    const key = `sched-vit-${String(r.admission_id)}-${s.due_at}-${s.state}`;
    const bed = `${String(r.room ?? '')}/${String(r.bed_no ?? '')}`;
    events.push({
      key,
      nurseId: String(r.nurse_id),
      late,
      msg: {
        tag: key,
        kind: 'vitals_due',
        severity: late ? 'warning' : 'info',
        titleAr: late ? 'قياس العلامات الحيوية متأخر' : 'حان قياس العلامات الحيوية',
        titleEn: late ? 'Vital signs overdue' : 'Vital signs due',
        bodyAr: `سرير ${bed}`,
        bodyEn: `Bed ${bed}`,
        link: `/patients/${String(r.patient_id)}?tab=vitals`,
      },
    });
  }
  return events;
}

/** دورة واحدة: يرسل الجديد فقط (كل موعد مرة عند «حان» ومرة عند «تأخر»). تُرجع عدد الإرسالات. */
export async function runScheduleAlerts(now: Date = new Date()): Promise<number> {
  const events = await collect(now);
  const fresh: Event[] = [];
  for (const e of events) {
    const r = await db.execute({
      sql: `INSERT OR IGNORE INTO schedule_alerts_sent (key, user_id, sent_at) VALUES (?, ?, ?)`,
      args: [e.key, e.nurseId, now.toISOString()],
    });
    if (r.rowsAffected > 0) fresh.push(e);
  }
  const byNurse = new Map<string, Event[]>();
  for (const e of fresh) byNurse.set(e.nurseId, [...(byNurse.get(e.nurseId) ?? []), e]);

  let sent = 0;
  for (const [nurseId, list] of byNurse) {
    if (list.length <= SUMMARY_AFTER) {
      for (const e of list) sent += await pushToUsers([nurseId], e.msg);
      continue;
    }
    const late = list.filter((e) => e.late).length;
    sent += await pushToUsers([nurseId], {
      tag: `sched-summary-${now.toISOString().slice(0, 16)}`,
      kind: 'schedule_summary',
      severity: late ? 'warning' : 'info',
      titleAr: late ? `لديك ${list.length} مواعيد لمرضاك (${late} متأخرة)` : `لديك ${list.length} مواعيد لمرضاك الآن`,
      titleEn: late ? `${list.length} tasks for your patients (${late} overdue)` : `${list.length} tasks for your patients now`,
      bodyAr: 'جرعات وعلامات حيوية — افتح جولة التمريض',
      bodyEn: 'Doses and vital signs — open the nursing round',
      link: '/medication-rounds',
    });
  }
  return sent;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** يبدأ الدورة كل دقيقة (في خادم الإنتاج فقط) */
export function startScheduleAlerts(): void {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runScheduleAlerts();
      if (Math.random() < 0.01) {
        await db.execute({ sql: `DELETE FROM schedule_alerts_sent WHERE sent_at < ?`, args: [new Date(Date.now() - 3 * 86_400_000).toISOString()] });
      }
    } catch (e) {
      console.error('[hmsi] schedule alerts', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, INTERVAL_MS);
  setTimeout(tick, 15_000);
}
