/**
 * يعيد التقاط صور الدليل التعليمي (web/public/guide) من نسخة محلية بقاعدة تجريبية.
 * المتطلبات: متصفح Edge مثبت + `npm i -D playwright-core`، وتشغيل:
 *   (cd server && LOCAL_DB_URL=file:visual.db npx tsx scripts/seed.ts && LOCAL_DB_URL=file:visual.db npx tsx src/dev.ts)
 *   (cd web && VITE_API_MODE=live npx vite --port 5174)
 * ثم: node scripts/capture-guide.mjs [اسم مجموعة اختياري: admin | doctor | nurse ...]
 * ⚠ لا تشغّله على قاعدة الإنتاج.
 */
// يلتقط صور الدليل التعليمي من النسخة المحلية (قاعدة تجريبية) إلى web/public/guide
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:5174';
// مسار ويندوز من import.meta.url: /E:/x → E:/x
const local = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const OUT = local('../web/public/guide/');
mkdirSync(OUT, { recursive: true });
const only = process.argv[2]; // اختياري: التقاط مجموعة واحدة
const b = await chromium.launch({ channel: 'msedge', headless: true });
const fails = [];

async function session(user, mobile = false) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 800 }, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('hmsi.lang', 'ar'); localStorage.setItem('hmsi.theme', 'light'); } catch {} });
  if (user) {
    const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: user, password: 'password123' } });
    if (!r.ok()) throw new Error('login ' + user);
  }
  const page = await ctx.newPage();
  return { ctx, page };
}
const wait = (p, ms = 600) => p.waitForTimeout(ms);
async function shot(page, name, opts = {}) {
  await wait(page, 500);
  await page.screenshot({ path: OUT + name + '.jpg', type: 'jpeg', quality: 72, ...opts });
  console.log('✓', name);
}
async function step(name, fn) {
  if (only && !name.startsWith(only)) return;
  try { await fn(); } catch (e) { fails.push(`${name}: ${e.message.split('\n')[0]}`); }
}
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'networkidle' });
const tab = (p, n) => p.locator(`[role=tab]:nth-child(${n})`).click();

// ——— عام
await step('login', async () => {
  const { page } = await session(null);
  await go(page, '/login'); await shot(page, 'login');
  await go(page, '/signup'); await shot(page, 'signup', { fullPage: true });
});

// ——— المدير
await step('admin', async () => {
  const { page, ctx } = await session('manager');
  await go(page, '/settings');
  await page.locator('input[type=file]').setInputFiles(local('../web/public/icons/icon-512.png')).catch(() => {});
  await wait(page, 1200);
  await go(page, '/'); await shot(page, 'dashboard');
  await go(page, '/settings'); await page.getByText('شعار المستشفى').first().scrollIntoViewIfNeeded(); await shot(page, 'settings-logo');
  await go(page, '/users'); await shot(page, 'users');
  await page.getByRole('button', { name: /مستخدم جديد|إضافة مستخدم/ }).first().click(); await shot(page, 'users-new');
  await go(page, '/departments'); await shot(page, 'departments');
  await go(page, '/wards'); await shot(page, 'wards');
  await page.locator('button:has-text("B1")').first().click(); await shot(page, 'wards-bed');
  await go(page, '/reports'); await page.getByRole('button', { name: 'سجل الدخول' }).click(); await page.getByRole('button', { name: 'هذه السنة' }).click(); await shot(page, 'reports');
  await go(page, '/audit'); await shot(page, 'audit');
  await go(page, '/billing'); await shot(page, 'billing', { fullPage: true });
  // سلة المحذوفات: نحذف إجراءً ثم نعرض السلة
  const csrf = decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'hmsi_csrf').value);
  const chart = await (await ctx.request.get(`${BASE}/api/patients/p6/chart`)).json();
  if (chart.procedures?.[0]) await ctx.request.delete(`${BASE}/api/patients/${chart.admissionId}/procedures/${chart.procedures[0].id}`, { headers: { 'x-csrf-token': csrf, origin: BASE } });
  await go(page, '/trash'); await shot(page, 'trash');
});

// ——— الاستقبال
await step('reception', async () => {
  const { page } = await session('reception');
  await go(page, '/patients'); await shot(page, 'patients');
  await page.getByRole('button', { name: 'مريض جديد' }).click(); await shot(page, 'patients-new');
  await page.keyboard.press('Escape');
  await go(page, '/patients');
  await page.getByRole('button', { name: /تنويم/ }).first().click(); await wait(page, 500);
  const sel = page.locator('[role=dialog] select');
  await sel.nth(0).selectOption({ index: 1 }); await wait(page, 300);
  await sel.nth(1).selectOption({ index: 1 }); await wait(page, 300);
  await sel.nth(2).selectOption({ index: 1 }).catch(() => {}); await wait(page, 300);
  await page.locator('[role=dialog] textarea').fill('ألم في البطن منذ يومين');
  await shot(page, 'patients-admit');
});

// ——— الطبيب
await step('doctor', async () => {
  const { page } = await session('doctor');
  await go(page, '/patients/p4'); await shot(page, 'chart-overview');
  await tab(page, 3); await shot(page, 'chart-diagnosis');
  await tab(page, 4); await shot(page, 'chart-notes');
  await tab(page, 6); await shot(page, 'chart-meds');
  await page.getByRole('button', { name: 'وصف دواء' }).click(); await shot(page, 'chart-meds-new'); await page.keyboard.press('Escape');
  await tab(page, 7); await shot(page, 'chart-lab');
  await page.getByRole('button', { name: /طلب فحص|طلب تحليل/ }).first().click(); await shot(page, 'chart-lab-order'); await page.keyboard.press('Escape');
  await page.getByText('تخصيص').first().click(); await shot(page, 'family-share'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'طباعة' }).first().click(); await shot(page, 'print-menu'); await page.keyboard.press('Escape');
  await go(page, '/patients/p4'); await tab(page, 13); await shot(page, 'chart-discharge');
});

// ——— التمريض
await step('nurse', async () => {
  const { page } = await session('nurse');
  await go(page, '/patients/p4'); await tab(page, 2); await shot(page, 'vitals', { fullPage: true });
  await page.getByRole('button', { name: 'تسجيل علامات جديدة' }).click(); await shot(page, 'vitals-new'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'سوائل داخلة' }).click(); await shot(page, 'fluids-new'); await page.keyboard.press('Escape');
  await tab(page, 6); await shot(page, 'mar');
  await page.getByRole('button', { name: 'تسجيل جرعة' }).first().click(); await shot(page, 'mar-dialog'); await page.keyboard.press('Escape');
});

// ——— المختبر والأشعة والصيدلية
await step('lab', async () => {
  const { page } = await session('lab');
  await go(page, '/laboratory'); await shot(page, 'lab-page');
  await page.getByRole('button', { name: 'إدخال النتيجة' }).first().click(); await shot(page, 'lab-result'); await page.keyboard.press('Escape');
  const r = await session('radiology');
  await go(r.page, '/radiology'); await shot(r.page, 'radiology-page');
  const ph = await session('pharmacist');
  await go(ph.page, '/pharmacy'); await shot(ph.page, 'pharmacy-page');
});

// ——— ذوو المريض (هاتف)
await step('family', async () => {
  const doc = await session('doctor');
  const chart = await (await doc.ctx.request.get(`${BASE}/api/patients/p4/chart`)).json();
  const wards = await (await doc.ctx.request.get(`${BASE}/api/wards`)).json();
  const a = chart.patient.admission;
  const bed = wards.flatMap((w) => w.beds).find((x) => x.room === a.room && x.bed_no === a.bed_no && x.status === 'occupied');
  const { page } = await session(null, true);
  await go(page, `/track/${bed.code}`); await shot(page, 'track-public', { fullPage: true });
  await page.locator('input').first().fill(a.family_pin); await page.getByRole('button', { name: 'عرض التفاصيل' }).click(); await wait(page, 1200);
  await shot(page, 'track-family', { fullPage: true });
});

// ——— المدير العام
await step('super', async () => {
  const { page } = await session('admin');
  await go(page, '/hospitals'); await shot(page, 'hospitals');
});

console.log(fails.length ? 'FAILED:\n' + fails.join('\n') : 'all ok');
await b.close();
