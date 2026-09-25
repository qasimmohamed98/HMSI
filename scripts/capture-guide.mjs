/**
 * يعيد التقاط صور الدليل التعليمي (web/public/guide) من نسخة محلية بقاعدة تجريبية.
 * المتطلبات: متصفح Edge مثبت + `npm i -D playwright-core`، وتشغيل:
 *   (cd server && LOCAL_DB_URL=file:visual.db npx tsx scripts/seed.ts && LOCAL_DB_URL=file:visual.db npx tsx src/dev.ts)
 *   (cd web && VITE_API_MODE=live npx vite --port 5174)
 * ثم: node scripts/capture-guide.mjs [--en] [اسم مجموعة اختياري: admin | doctor | nurse ...]
 *   بدون --en: صور الواجهة العربية → web/public/guide
 *   مع --en:  صور الواجهة الإنجليزية → web/public/guide/en (يستخدمها الدليل الإنجليزي)
 * ⚠ لا تشغّله على قاعدة الإنتاج.
 */
// يلتقط صور الدليل التعليمي من النسخة المحلية (قاعدة تجريبية) إلى web/public/guide
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:5174';
// مسار ويندوز من import.meta.url: /E:/x → E:/x
const local = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const args = process.argv.slice(2);
const LANG = args.includes('--en') ? 'en' : 'ar';
const OUT = local(LANG === 'en' ? '../web/public/guide/en/' : '../web/public/guide/');
mkdirSync(OUT, { recursive: true });
const only = args.find((a) => !a.startsWith('--')); // اختياري: التقاط مجموعة واحدة
/** نص الزر/العنصر حسب لغة الواجهة */
const L = (ar, en) => (LANG === 'en' ? en : ar);
const b = await chromium.launch({ channel: 'msedge', headless: true });
const fails = [];

async function session(user, mobile = false) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 800 }, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((lang) => { try { localStorage.setItem('hmsi.lang', lang); localStorage.setItem('hmsi.theme', 'light'); } catch {} }, LANG);
  if (user) {
    const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: user, password: 'HmsiDemo2026' } });
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
async function apiAs(user) {
  const ctx = await b.newContext();
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: user, password: 'HmsiDemo2026' } });
  const csrf = decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'hmsi_csrf').value);
  const h = { 'x-csrf-token': csrf, origin: BASE };
  return {
    post: async (path, data) => (await ctx.request.post(`${BASE}/api${path}`, { data, headers: h })).json(),
    patch: async (path, data) => (await ctx.request.patch(`${BASE}/api${path}`, { data, headers: h })).json(),
  };
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
  // صور الدليل بلا شعار مستشفى، حتى لا يُخلط بشعار Q
  {
    const t = decodeURIComponent((await ctx.cookies()).find((c) => c.name === 'hmsi_csrf').value);
    await ctx.request.delete(`${BASE}/api/hospitals/me/logo`, { headers: { 'x-csrf-token': t, origin: BASE } });
  }
  await go(page, '/settings');
  await wait(page, 1200);
  await go(page, '/'); await shot(page, 'dashboard');
  await go(page, '/settings'); await page.getByText(L('شعار المستشفى', 'Hospital logo')).first().scrollIntoViewIfNeeded(); await shot(page, 'settings-logo');
  await go(page, '/settings'); await page.getByText(L('التنبيهات المسموعة والمكتوبة', 'Sound and on-screen alerts')).first().scrollIntoViewIfNeeded(); await shot(page, 'alerts-settings');
  await page.getByRole('button', { name: L('تفعيل التحقق بخطوتين', 'Turn on 2-step verification') }).first().click(); await wait(page, 800);
  await shot(page, 'twofa-setup'); await page.keyboard.press('Escape');
  await go(page, '/users'); await shot(page, 'users');
  await page.getByRole('button', { name: L(/مستخدم جديد|إضافة مستخدم/, 'New user') }).first().click(); await shot(page, 'users-new');
  await go(page, '/departments'); await shot(page, 'departments');
  await go(page, '/wards'); await shot(page, 'wards');
  await page.locator('button:has-text("B1")').first().click(); await shot(page, 'wards-bed');
  await go(page, '/reports'); await page.getByRole('button', { name: L('سجل الدخول', 'Admissions register') }).click(); await page.getByRole('button', { name: L('هذه السنة', 'This year') }).click(); await shot(page, 'reports');
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
  await page.getByRole('button', { name: L('مريض جديد', 'New patient') }).click(); await shot(page, 'patients-new');
  await page.keyboard.press('Escape');
  await go(page, '/patients');
  await page.getByRole('button', { name: L(/تنويم/, /Admit/) }).first().click(); await wait(page, 500);
  const sel = page.locator('[role=dialog] select');
  await sel.nth(0).selectOption({ index: 1 }); await wait(page, 300);
  await sel.nth(1).selectOption({ index: 1 }); await wait(page, 300);
  await sel.nth(2).selectOption({ index: 1 }).catch(() => {}); await wait(page, 300);
  await page.locator('[role=dialog] textarea').fill(L('ألم في البطن منذ يومين', 'Abdominal pain for two days'));
  await shot(page, 'patients-admit');
});

// ——— الطبيب
await step('doctor', async () => {
  const { page } = await session('doctor');
  await go(page, '/patients/p4'); await shot(page, 'chart-overview');
  await shot(page, 'careteam', { clip: { x: 0, y: 0, width: 1280, height: 620 } });
  await tab(page, 2); await shot(page, 'care-plan');
  await tab(page, 4); await shot(page, 'chart-diagnosis');
  await tab(page, 5); await shot(page, 'chart-notes');
  await tab(page, 7); await shot(page, 'chart-meds');
  await page.getByRole('button', { name: L('وصف دواء', 'Prescribe medication') }).click(); await shot(page, 'chart-meds-new');
  {
    const inputs = page.locator('[role=dialog] input');
    await inputs.nth(0).fill('Augmentin');
    await inputs.nth(1).fill('1 g');
    await inputs.nth(2).fill('IV');
    await inputs.nth(3).fill(L('كل 8 ساعات', 'every 8 hours'));
    await page.locator('[role=dialog] textarea').fill(L('تحمّلته سابقاً دون تفاعل — مراقبة لصيقة', 'Tolerated before without reaction — close monitoring'));
    await shot(page, 'allergy-warning');
  }
  await page.keyboard.press('Escape');
  await tab(page, 8); await shot(page, 'chart-lab');
  await page.getByRole('button', { name: L(/طلب فحص|طلب تحليل/, /Order test/) }).first().click(); await shot(page, 'chart-lab-order'); await page.keyboard.press('Escape');
  await page.getByText(L('تخصيص', 'Customize')).first().click(); await shot(page, 'family-share'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: L('طباعة', 'Print') }).first().click(); await shot(page, 'print-menu'); await page.keyboard.press('Escape');
  await go(page, '/patients/p4'); await tab(page, 14); await shot(page, 'chart-discharge');
  // طبيب يفتح مريضاً ليس من مرضاه
  const other = await session('doctor3');
  await go(other.page, '/patients/p1'); await shot(other.page, 'not-yours');
});

// ——— التمريض
await step('nurse', async () => {
  const { page } = await session('nurse');
  await go(page, '/patients/p4'); await tab(page, 3); await shot(page, 'vitals', { fullPage: true });
  await page.getByRole('button', { name: L('تسجيل علامات جديدة', 'Record new vitals') }).click(); await shot(page, 'vitals-new'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: L('سوائل داخلة', 'Intake') }).click(); await shot(page, 'fluids-new'); await page.keyboard.press('Escape');
  await tab(page, 7); await shot(page, 'mar');
  await page.getByRole('button', { name: L('تسجيل جرعة', 'Record dose') }).first().click(); await shot(page, 'mar-dialog'); await page.keyboard.press('Escape');
  await go(page, '/medication-rounds'); await wait(page, 1500); await shot(page, 'rounds');
  // ملاحظة تسليم نموذجية ثم الصفحة
  const nurseApi = await apiAs('nurse');
  await nurseApi.post('/handover/adm4', {
    situation: L('مستقرة، حرارة 38.2 ليلاً استجابت للباراسيتامول', 'Stable, temperature 38.2 overnight responded to paracetamol'),
    background: L('التهاب رئوي، حساسية سيفالوسبورين', 'Pneumonia, cephalosporin allergy'),
    assessment: L('MEWS 3، تشبع الأكسجين 93%', 'MEWS 3, oxygen saturation 93%'),
    recommendation: L('متابعة الحرارة والتشبع كل 4 ساعات، نتيجة زرع الدم معلقة', 'Check temperature and saturation every 4 hours, blood culture pending'),
  });
  await go(page, '/handover'); await shot(page, 'handover');
  await page.getByRole('button', { name: L('كتابة التسليم', 'Write handover') }).first().click();
  await page.locator('[role=dialog] textarea').nth(0).fill(L('مستقر، بلا شكوى جديدة', 'Stable, no new complaints'));
  await shot(page, 'handover-sbar'); await page.keyboard.press('Escape');
  // التسليم والاستلام: الممرض يسلّم مريضاً لزميلته ثم تفتح الزميلة طلب الاستلام
  await nurseApi.post('/care-team/handovers', { to_user_id: 'u_nurse2', admission_ids: ['adm8'], note: L('نهاية المناوبة الصباحية — متابعة السوائل', 'End of the morning shift — keep watching fluids') });
  const n2 = await session('nurse2');
  await go(n2.page, '/handover?tab=nurses'); await wait(n2.page, 1500);
  await shot(n2.page, 'nurse-handover');
});

// ——— المختبر والأشعة والصيدلية
await step('lab', async () => {
  const { page } = await session('lab');
  await go(page, '/laboratory'); await shot(page, 'lab-page');
  await page.getByRole('button', { name: L('إدخال النتيجة', 'Enter result') }).first().click(); await shot(page, 'lab-result'); await page.keyboard.press('Escape');
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
  await page.locator('input').first().fill(a.family_pin); await page.getByRole('button', { name: L('عرض التفاصيل', 'Show details') }).click(); await wait(page, 1200);
  await shot(page, 'track-family', { fullPage: true });
});

// ——— المدير العام
await step('super', async () => {
  const { page } = await session('admin');
  await go(page, '/hospitals'); await shot(page, 'hospitals');
  await go(page, '/system-health');
  await page.getByRole('button', { name: L('نسخة احتياطية الآن', 'Back up now') }).click(); await wait(page, 2500);
  await shot(page, 'system-health');
});

// ——— التنبيهات (أخيراً: التنبيه الحرج يظهر لكل الأطباء والتمريض حتى الإقرار به)
await step('alerts', async () => {
  const { page } = await session('doctor');
  await go(page, '/'); await wait(page, 2000);
  const nurseApi = await apiAs('nurse2');
  await nurseApi.post('/vitals', { admission_id: 'adm1', temperature: 39.7, pulse: 138, respiratory_rate: 32, bp_systolic: 82, consciousness: 'voice' });
  const docApi = await apiAs('doctor2');
  const order = await docApi.post('/patients/adm1/labs', { admission_id: 'adm1', test_name_ar: 'بوتاسيوم', test_name_en: 'Potassium' });
  const labApi = await apiAs('lab');
  await labApi.patch(`/patients/adm1/labs/${order.id}`, { result: '6.4', unit: 'mmol/L', abnormal: true });
  await page.getByRole('alertdialog').waitFor({ timeout: 40000 });
  await wait(page, 1500);
  await shot(page, 'alerts');
  await page.getByRole('button', { name: L('اطّلعت', 'Acknowledge') }).click();
});

console.log(fails.length ? 'FAILED:\n' + fails.join('\n') : 'all ok');
await b.close();
