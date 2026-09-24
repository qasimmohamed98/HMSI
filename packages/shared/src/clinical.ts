import type { Consciousness } from './types.js';

/**
 * درجة الإنذار المبكر المعدّلة (MEWS — Subbe et al., 2001).
 * أداة فرز مساعدة لتنبيه الكادر عند تدهور العلامات الحيوية، ولا تغني عن التقييم السريري
 * أو بروتوكول المستشفى المحلي. عتبات الاستجابة: 0–2 روتيني، 3–4 متابعة أدق، ≥5 أو أي بند = 3 مراجعة عاجلة.
 */
export interface MewsInput {
  bp_systolic?: number | null;
  pulse?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  consciousness?: Consciousness | null;
}

export type MewsLevel = 'low' | 'medium' | 'high';

export interface MewsResult {
  score: number;
  level: MewsLevel;
  /** عدد البنود المقاسة من 5 — الدرجة ناقصة إن لم تُقس كل البنود */
  measured: number;
  parts: { sbp: number | null; hr: number | null; rr: number | null; temp: number | null; avpu: number | null };
}

const has = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function scoreSbp(v: number): number {
  if (v <= 70) return 3;
  if (v <= 80) return 2;
  if (v <= 100) return 1;
  if (v < 200) return 0;
  return 2;
}

export function scoreHr(v: number): number {
  if (v < 40) return 2;
  if (v <= 50) return 1;
  if (v <= 100) return 0;
  if (v <= 110) return 1;
  if (v < 130) return 2;
  return 3;
}

export function scoreRr(v: number): number {
  if (v < 9) return 2;
  if (v <= 14) return 0;
  if (v <= 20) return 1;
  if (v < 30) return 2;
  return 3;
}

export function scoreTemp(v: number): number {
  if (v < 35) return 2;
  if (v < 38.5) return 0;
  return 2;
}

const AVPU_SCORE: Record<Consciousness, number> = { alert: 0, voice: 1, pain: 2, unresponsive: 3 };

/** يعيد null إن لم يُقس أي بند */
export function calcMews(v: MewsInput): MewsResult | null {
  const parts = {
    sbp: has(v.bp_systolic) ? scoreSbp(v.bp_systolic) : null,
    hr: has(v.pulse) ? scoreHr(v.pulse) : null,
    rr: has(v.respiratory_rate) ? scoreRr(v.respiratory_rate) : null,
    temp: has(v.temperature) ? scoreTemp(v.temperature) : null,
    avpu: v.consciousness ? AVPU_SCORE[v.consciousness] : null,
  };
  const values = Object.values(parts).filter((x): x is number => x !== null);
  if (values.length === 0) return null;
  const score = values.reduce((a, b) => a + b, 0);
  const level: MewsLevel = score >= 5 || values.some((x) => x >= 3) ? 'high' : score >= 3 ? 'medium' : 'low';
  return { score, level, measured: values.length, parts };
}
