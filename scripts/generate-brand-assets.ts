/**
 * يولّد ملفات الهوية (SVG) من نفس هندسة الرمز المستخدمة في الواجهة:
 *   web/public/favicon.svg                  — أيقونة المتصفح (Q على مربع الحبر)
 *   web/public/brand/q-mark*.svg            — رمز Q (ملون، معكوس، أسود، أبيض)
 *   web/public/brand/q-virexa*.svg          — الشعار الكامل (ملون، معكوس، أسود، أبيض)
 *   web/public/brand/app-icon*.svg          — مصادر أيقونات التطبيق (عادية و maskable بمنطقة آمنة)
 * ثم تُحوَّل مصادر الأيقونات إلى PNG (192/512/180/1024) عبر scripts/rasterize-icons.mjs.
 * التشغيل: npx tsx scripts/generate-brand-assets.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BRAND, Q_COLORS, qLockupSvg, qMarkSvg } from '../web/src/components/brand/q-geometry';

const pub = new URL('../web/public/', import.meta.url);
const brandDir = new URL('brand/', pub);
mkdirSync(brandDir, { recursive: true });
const write = (rel: URL | string, base: URL, svg: string) => writeFileSync(new URL(rel, base), `${svg}\n`);

// عرض «VIREXA» بخط Syncopate 700 بحجم 58 (مقاس في المتصفح) — ملفات SVG الثابتة لا تستطيع القياس
const VIREXA_WIDTH = 420;

const variants = {
  '': Q_COLORS.light,
  '-reverse': Q_COLORS.dark,
  '-black': Q_COLORS.mono('#000000'),
  '-white': Q_COLORS.mono('#FFFFFF'),
} as const;
for (const [suffix, colors] of Object.entries(variants)) {
  write(`q-mark${suffix}.svg`, brandDir, qMarkSvg({ colors }));
  write(`q-virexa${suffix}.svg`, brandDir, qLockupSvg(BRAND.product, { colors, wordWidth: VIREXA_WIDTH }));
}

/** أيقونة على مربع الحبر. inset: نسبة مساحة الرمز من الأيقونة */
function appIcon(opts: { radius: number; inset: number; small?: boolean }): string {
  const inner = qMarkSvg({ colors: Q_COLORS.dark, small: opts.small })
    .replace('<svg ', `<svg x="${(1 - opts.inset) * 512 / 2}" y="${(1 - opts.inset) * 512 / 2}" width="${opts.inset * 512}" height="${opts.inset * 512}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2C63"/><stop offset="1" stop-color="${BRAND.ink}"/></linearGradient></defs><rect width="512" height="512" rx="${opts.radius}" fill="url(#bg)"/>${inner}</svg>`;
}

write('app-icon.svg', brandDir, appIcon({ radius: 112, inset: 0.66 }));
// maskable: الرمز داخل المنطقة الآمنة (دائرة بقطر 80%) والخلفية تملأ المربع كاملاً
write('app-icon-maskable.svg', brandDir, appIcon({ radius: 0, inset: 0.5 }));
write('favicon.svg', pub, appIcon({ radius: 120, inset: 0.7, small: true }));

console.log('brand SVG assets written');
