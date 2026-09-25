/**
 * يحوّل مصادر الأيقونات (SVG) إلى PNG بالأحجام المطلوبة للويب/PWA وأندرويد وiOS وتطبيق ويندوز (Tauri).
 * المتطلبات: متصفح Edge + `npm i -D playwright-core`. شغّل أولاً: npx tsx scripts/generate-brand-assets.ts
 * التشغيل: node scripts/rasterize-icons.mjs  ثم لتطبيق ويندوز: (cd tauri && npx tauri icon ../web/public/brand/app-icon-1024.png)
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const local = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const JOBS = [
  ['../web/public/brand/app-icon.svg', '../web/public/icons/icon-192.png', 192],
  ['../web/public/brand/app-icon.svg', '../web/public/icons/icon-512.png', 512],
  ['../web/public/brand/app-icon-maskable.svg', '../web/public/icons/maskable-512.png', 512],
  ['../web/public/brand/app-icon-maskable.svg', '../web/public/icons/apple-touch-icon.png', 180],
  ['../web/public/brand/app-icon.svg', '../web/public/brand/app-icon-1024.png', 1024],
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [src, out, size] of JOBS) {
  const svg = readFileSync(local(src), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator('svg').first().screenshot({ path: local(out), omitBackground: true });
  console.log('✓', out, size);
}
await browser.close();
