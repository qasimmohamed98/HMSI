/**
 * جدولة الجرعات من نص التكرار الحر (عربي/إنجليزي) — بلا تغيير في طريقة الوصف الحالية.
 * أمثلة مفهومة: «كل 8 ساعات»، «مرتين يومياً»، «ثلاث مرات يومياً»، «يومياً»، «صباحاً»، «مساءً»،
 * «قبل النوم»، «عند الحاجة»، «مرة واحدة»، q6h، q8h، BID، TID، QID، OD، daily، nocte، PRN، STAT.
 * نص غير مفهوم → لا جدولة (يظهر للممرض «تكرار غير محدد» بدل تخمين خاطئ).
 */

export type ScheduleKind = 'interval' | 'fixed' | 'prn' | 'once' | 'unknown';

export interface DoseSchedule {
  kind: ScheduleKind;
  /** الفاصل بالساعات (interval) */
  hours?: number;
  /** ساعات اليوم الثابتة (fixed) بالتوقيت المحلي */
  times?: number[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();

export function parseFrequency(text: string | null | undefined): DoseSchedule {
  const f = norm(text ?? '');
  if (!f) return { kind: 'unknown' };
  if (/(عند الحاجه|عند اللزوم|\bprn\b|as needed|when needed)/.test(f)) return { kind: 'prn' };
  if (/(\bstat\b|مره واحده|جرعه واحده|\bonce\b(?! daily| a day))/.test(f)) return { kind: 'once' };

  const every = f.match(/(?:\bq\s*|every\s*|كل\s*)(\d{1,2})\s*(?:h\b|hr|hrs|hour|hours|ساعه|ساعات|س\b)/);
  if (every) {
    const h = Number(every[1]);
    if (h >= 1 && h <= 72) return { kind: 'interval', hours: h };
  }
  if (/كل ساعتين/.test(f)) return { kind: 'interval', hours: 2 };
  if (/كل ساعه\b|\bhourly\b/.test(f)) return { kind: 'interval', hours: 1 };

  if (/(\bqid\b|4 مرات|اربع مرات|four times)/.test(f)) return { kind: 'interval', hours: 6 };
  if (/(\btid\b|\btds\b|3 مرات|ثلاث مرات|three times)/.test(f)) return { kind: 'interval', hours: 8 };
  if (/(\bbid\b|\bbd\b|مرتين|twice)/.test(f)) return { kind: 'interval', hours: 12 };

  if (/(قبل النوم|\bqhs\b|\bhs\b|at bedtime)/.test(f)) return { kind: 'fixed', times: [22] };
  if (/(مساء|ليلا|\bnocte\b|\bevening\b|\bat night\b|\bpm\b)/.test(f)) return { kind: 'fixed', times: [20] };
  if (/(صباحا|صباح|\bmane\b|\bmorning\b|\bam\b)/.test(f)) return { kind: 'fixed', times: [8] };

  if (/(يوميا|يومي|مره يوميا|مره في اليوم|\bod\b|\bqd\b|daily|once a day|once daily|every day)/.test(f)) return { kind: 'interval', hours: 24 };
  return { kind: 'unknown' };
}

export type DoseState = 'overdue' | 'due' | 'upcoming' | 'later' | 'prn' | 'unscheduled' | 'done';

export interface DoseStatus {
  state: DoseState;
  /** موعد الجرعة القادمة (ISO) إن كان مجدولاً */
  due_at: string | null;
  schedule: DoseSchedule;
}

/** هامش قبل/بعد الموعد يُعدّ «مستحقة الآن» */
export const DOSE_WINDOW_MS = 60 * 60_000;
/** «قريبة» إن كانت خلال 4 ساعات */
export const UPCOMING_MS = 4 * 3_600_000;

function nextFixed(times: number[], after: Date): Date {
  for (let day = 0; day < 3; day++) {
    for (const h of [...times].sort((a, b) => a - b)) {
      const d = new Date(after);
      d.setDate(d.getDate() + day);
      d.setHours(h, 0, 0, 0);
      if (d.getTime() > after.getTime()) return d;
    }
  }
  return after;
}

/**
 * حالة الجرعة التالية لدواء نشط (تُحسب في المتصفح بالتوقيت المحلي).
 * - أول جرعة لدواء لم يُعطَ بعد: مستحقة منذ وقت الوصف (أو صباح تاريخ البداية إن كان مستقبلاً)
 * - بعدها: آخر تسجيل (أُعطيت/أُجّلت/رُفضت) + الفاصل
 */
export function doseStatus(
  med: { frequency: string | null; start_at: string | null; created_at?: string | null; end_at?: string | null },
  lastAt: string | null,
  now: Date = new Date(),
): DoseStatus {
  const schedule = parseFrequency(med.frequency);
  if (med.end_at && new Date(`${med.end_at}T23:59:59`).getTime() < now.getTime()) return { state: 'done', due_at: null, schedule };
  if (schedule.kind === 'prn') return { state: 'prn', due_at: null, schedule };
  if (schedule.kind === 'unknown') return { state: 'unscheduled', due_at: null, schedule };

  const startDay = med.start_at ? new Date(`${med.start_at.slice(0, 10)}T00:00:00`) : now;
  const created = med.created_at ? new Date(med.created_at) : startDay;
  const firstDue = startDay.getTime() > created.getTime() ? new Date(startDay.getTime() + 8 * 3_600_000) : created;

  let due: Date;
  if (schedule.kind === 'once') {
    if (lastAt) return { state: 'done', due_at: null, schedule };
    due = firstDue;
  } else if (!lastAt) {
    due = schedule.kind === 'fixed' ? nextFixed(schedule.times!, new Date(firstDue.getTime() - 2 * 3_600_000)) : firstDue;
  } else if (schedule.kind === 'fixed') {
    // الجرعة المسجّلة تغطي أقرب موعد ثابت (±ساعتين)
    due = nextFixed(schedule.times!, new Date(new Date(lastAt).getTime() + 2 * 3_600_000));
  } else {
    due = new Date(new Date(lastAt).getTime() + schedule.hours! * 3_600_000);
  }

  const diff = due.getTime() - now.getTime();
  const state: DoseState = diff < -DOSE_WINDOW_MS ? 'overdue' : diff <= DOSE_WINDOW_MS ? 'due' : diff <= UPCOMING_MS ? 'upcoming' : 'later';
  return { state, due_at: due.toISOString(), schedule };
}

// ---------------------------------------------------------------- العلامات الحيوية حسب الوقت

/** التكرار الافتراضي لقياس العلامات الحيوية إن لم تحدده الخطة العلاجية */
export const DEFAULT_VITALS_HOURS = 4;
/** هامش «مستحقة الآن» للعلامات الحيوية */
export const VITALS_WINDOW_MS = 30 * 60_000;

/**
 * التكرار الفعلي: ما في الخطة العلاجية (أو 4 ساعات)، ويُقصَّر تلقائياً عند تدهور المريض:
 * MEWS مرتفع → كل ساعة، متوسط → كل ساعتين على الأكثر.
 */
export function vitalsIntervalHours(planHours: number | null | undefined, mewsLevel?: 'low' | 'medium' | 'high' | null): number {
  const base = planHours && planHours > 0 ? planHours : DEFAULT_VITALS_HOURS;
  if (mewsLevel === 'high') return Math.min(base, 1);
  if (mewsLevel === 'medium') return Math.min(base, 2);
  return base;
}

export function vitalsStatus(
  row: { admitted_at: string; last_at: string | null; interval_hours: number | null; mews?: { level: 'low' | 'medium' | 'high' } | null },
  now: Date = new Date(),
): { state: Exclude<DoseState, 'prn' | 'unscheduled' | 'done'>; due_at: string; hours: number } {
  const hours = vitalsIntervalHours(row.interval_hours, row.mews?.level);
  // أول قياس مستحق عند التنويم
  const due = row.last_at ? new Date(Date.parse(row.last_at) + hours * 3_600_000) : new Date(row.admitted_at);
  const diff = due.getTime() - now.getTime();
  const state = diff < -VITALS_WINDOW_MS ? 'overdue' : diff <= VITALS_WINDOW_MS ? 'due' : diff <= 60 * 60_000 ? 'upcoming' : 'later';
  return { state, due_at: due.toISOString(), hours };
}
