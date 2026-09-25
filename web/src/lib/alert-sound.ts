/**
 * أصوات التنبيه — تُولَّد بـ Web Audio (بلا ملفات صوتية ولا مصادر خارجية، متوافقة مع CSP).
 * لكل مستوى نغمة مميزة يسهل تمييزها في الردهة:
 *  - info: نغمة واحدة هادئة
 *  - warning: نغمتان صاعدتان
 *  - critical: ثلاث نبضات حادة (تتكرر من AlertCenter حتى الإقرار)
 * المتصفحات لا تسمح بالصوت قبل أول تفاعل للمستخدم مع الصفحة؛ unlockAudio يُستدعى عند أول نقرة.
 */

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface AlertPrefs {
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** صوت للتنبيهات الحرجة والمهمة فقط (بلا صوت للمعلوماتية) */
  importantOnly: boolean;
  desktop: boolean;
  vibrate: boolean;
}

export const DEFAULT_PREFS: AlertPrefs = { sound: true, volume: 0.7, importantOnly: false, desktop: true, vibrate: true };

const key = (userId: string) => `hmsi.alerts.${userId}`;

export function loadPrefs(userId: string | undefined): AlertPrefs {
  if (!userId) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(key(userId)) ?? '{}') as Partial<AlertPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(userId: string, prefs: AlertPrefs): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prefs));
  } catch {
    /* التخزين غير متاح */
  }
  window.dispatchEvent(new Event('hmsi:alert-prefs'));
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

/** يُفعّل الصوت بعد أول تفاعل (سياسة المتصفحات) */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

export function audioBlocked(): boolean {
  return !ctx || ctx.state !== 'running';
}

function tone(c: AudioContext, freq: number, start: number, dur: number, volume: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // غلاف ناعم يمنع «الطقطقة»
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function playAlert(level: AlertLevel, volume = DEFAULT_PREFS.volume): void {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const t = c.currentTime + 0.02;
  const v = Math.min(1, Math.max(0, volume)) * 0.35;
  if (level === 'info') {
    tone(c, 880, t, 0.35, v * 0.8);
  } else if (level === 'warning') {
    tone(c, 660, t, 0.22, v);
    tone(c, 990, t + 0.25, 0.35, v);
  } else {
    for (let i = 0; i < 3; i++) {
      tone(c, 1040, t + i * 0.28, 0.18, v, 'square');
      tone(c, 780, t + i * 0.28 + 0.09, 0.09, v * 0.6, 'square');
    }
  }
}

export function vibrate(level: AlertLevel): void {
  try {
    navigator.vibrate?.(level === 'critical' ? [300, 120, 300, 120, 300] : level === 'warning' ? [200, 100, 200] : 120);
  } catch {
    /* غير مدعوم */
  }
}
