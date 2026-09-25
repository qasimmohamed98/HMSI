/**
 * هندسة علامة Q — مصدر واحد لكل مكان يُرسم فيه الرمز (الواجهة، المطبوعات، توليد الأيقونات).
 * القصة: الحلقة = المعمل، الفتحة عند 45° = البوابة، الخط يبدأ داخل الحلقة ويخرج منها = خط الإنتاج،
 * وفي الشعار الكامل ينحني الخط ليصبح سطراً يحمل اسم المنتج.
 * رمز Q ثابت؛ لا يتغير إلا طول السطر الأفقي حسب عرض اسم المنتج.
 * المواصفات الكاملة في صفحة الهوية (Q VIREXA brand system v1.0).
 */

export const BRAND = {
  parent: 'Q',
  product: 'VIREXA',
  ink: '#13204A',
  output: '#0A9E88',
  outputBright: '#3CE0C3',
} as const;

export interface QGeometry {
  cx: number;
  cy: number;
  r: number;
  s: number;
  gap: number;
  start: number;
  iconLen: number;
}

/** الرسم القياسي، ونسخة الأحجام الصغيرة (< 32px) بحلقة أسمك وبوابة أضيق */
export const Q_REGULAR: QGeometry = { cx: 60, cy: 60, r: 40, s: 14, gap: 22, start: 12, iconLen: 66 };
export const Q_SMALL: QGeometry = { cx: 60, cy: 60, r: 38, s: 18, gap: 25, start: 10, iconLen: 62 };

export const WORDMARK = { family: 'Syncopate', weight: 700, size: 58, tracking: 0.06 } as const;
const LINE_Y = 108;

const rad = (d: number) => (d * Math.PI) / 180;
const f = (n: number) => Math.round(n * 100) / 100;
const pt = (g: QGeometry, deg: number, d: number): [number, number] => [g.cx + d * Math.cos(rad(deg)), g.cy + d * Math.sin(rad(deg))];
const escXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let uid = 0;

export interface QColors {
  /** الحلقة وبداية الخط (لون المعمل) */
  a: string;
  /** الخط الخارجي واسم المنتج (لون المنتج) */
  b: string;
}

/** ألوان جاهزة: على خلفية فاتحة، على خلفية داكنة/الحبر، وأحادية */
export const Q_COLORS = {
  light: { a: BRAND.ink, b: BRAND.output },
  dark: { a: '#FFFFFF', b: BRAND.outputBright },
  mono: (c: string): QColors => ({ a: c, b: c }),
  css: { a: 'var(--q-a)', b: 'var(--q-b)' },
} as const;

function ringPath(g: QGeometry): string {
  const [x1, y1] = pt(g, 45 + g.gap, g.r);
  const [x2, y2] = pt(g, 45 - g.gap + 360, g.r);
  return `M${f(x1)} ${f(y1)} A${g.r} ${g.r} 0 1 1 ${f(x2)} ${f(y2)}`;
}

function gradientDef(id: string, g: QGeometry, c: QColors): string {
  const [x1, y1] = pt(g, 45, g.r);
  const [x2, y2] = pt(g, 45, g.r + 16);
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"><stop offset="0" style="stop-color:${c.a}"/><stop offset="1" style="stop-color:${c.b}"/></linearGradient>`;
}

/** رمز Q وحده (الأيقونة). padding: هامش إضافي حول الرمز بوحدات الرسم */
export function qMarkSvg(opts: { colors?: QColors; small?: boolean; padding?: number; title?: string } = {}): string {
  const g = opts.small ? Q_SMALL : Q_REGULAR;
  const c = opts.colors ?? Q_COLORS.css;
  const id = `q${++uid}`;
  const [sx, sy] = pt(g, 45, g.start);
  const [ex, ey] = pt(g, 45, g.iconLen);
  const pad = g.s / 2 + 2 + (opts.padding ?? 0);
  const x0 = g.cx - g.r - pad;
  const y0 = g.cy - g.r - pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(ex + pad - x0)} ${f(ey + pad - y0)}" role="img" aria-label="${escXml(opts.title ?? 'Q')}"><defs>${gradientDef(id, g, c)}</defs><path d="${ringPath(g)}" fill="none" stroke="${c.a}" stroke-width="${g.s}" stroke-linecap="butt"/><path d="M${f(sx)} ${f(sy)} L${f(ex)} ${f(ey)}" fill="none" stroke="url(#${id})" stroke-width="${g.s}" stroke-linecap="round"/></svg>`;
}

/**
 * الشعار الكامل: Q + خط إنتاج ينحني ليحمل اسم المنتج.
 * wordWidth: عرض الاسم بخط Syncopate بحجم WORDMARK.size (يُقاس في المتصفح؛ التقدير الافتراضي تقريبي).
 */
export function qLockupSvg(name: string, opts: { colors?: QColors; wordWidth?: number } = {}): string {
  const g = Q_REGULAR;
  const c = opts.colors ?? Q_COLORS.css;
  const id = `q${++uid}`;
  const rb = g.s;
  const xc = LINE_Y + 0.41421 * rb;
  const t1: [number, number] = [xc - 0.70711 * rb, LINE_Y - rb + 0.70711 * rb];
  const [sx, sy] = pt(g, 45, g.start);
  const wordX = xc + 14;
  const w = opts.wordWidth ?? estimateWordWidth(name);
  const endX = wordX + w;
  const x0 = g.cx - g.r - 9;
  const y0 = g.cy - g.r - 9;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(endX + 8 - x0)} ${f(LINE_Y + g.s / 2 + 2 - y0)}" role="img" aria-label="Q ${escXml(name)}"><defs>${gradientDef(id, g, c)}</defs><path d="${ringPath(g)}" fill="none" stroke="${c.a}" stroke-width="${g.s}" stroke-linecap="butt"/><path d="M${f(sx)} ${f(sy)} L${f(t1[0])} ${f(t1[1])} A${rb} ${rb} 0 0 0 ${f(xc)} ${LINE_Y} L${f(endX)} ${LINE_Y}" fill="none" stroke="url(#${id})" stroke-width="${g.s}" stroke-linecap="round" stroke-linejoin="round"/><text x="${f(wordX)}" y="${LINE_Y - 17}" font-family="${WORDMARK.family}, 'Segoe UI', sans-serif" font-weight="${WORDMARK.weight}" font-size="${WORDMARK.size}" letter-spacing="${f(WORDMARK.size * WORDMARK.tracking)}" fill="${c.b}">${escXml(name)}</text></svg>`;
}

/** تقدير عرض الاسم إن لم يتوفر القياس (متوسط عرض أحرف Syncopate العريضة) */
export function estimateWordWidth(name: string): number {
  const perChar: Record<string, number> = { I: 0.36, M: 1.08, W: 1.2, O: 1.02, Q: 1.02, C: 0.98, G: 1.0 };
  const em = [...name].reduce((s, ch) => s + (perChar[ch] ?? 0.9), 0);
  return em * WORDMARK.size + WORDMARK.size * WORDMARK.tracking * Math.max(0, name.length - 1);
}

/** قياس دقيق في المتصفح بعد تحميل الخط */
export function measureWordWidth(name: string): number {
  if (typeof document === 'undefined') return estimateWordWidth(name);
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return estimateWordWidth(name);
    ctx.font = `${WORDMARK.weight} ${WORDMARK.size}px ${WORDMARK.family}`;
    const w = ctx.measureText(name).width + WORDMARK.size * WORDMARK.tracking * Math.max(0, name.length - 1);
    return w > 0 ? w : estimateWordWidth(name);
  } catch {
    return estimateWordWidth(name);
  }
}
