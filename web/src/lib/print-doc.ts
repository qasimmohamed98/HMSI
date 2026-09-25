import { currentLang } from '@/i18n';
import { fmtDateTime } from './format';
import { Q_COLORS, qMarkSvg } from '@/components/brand/q-geometry';

/**
 * إطار موحّد للمطبوعات (A4): ترويسة بشعار المستشفى واسمه، عنوان المستند، سطر بيانات،
 * المحتوى، وتذييل بمن طبع ومتى مع ترقيم الصفحات. يُستخدم للملف الطبي والتحاليل والأشعة
 * وملخص الخروج والتقارير.
 */

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export interface PrintDocOptions {
  title: string;
  subtitle?: string;
  hospitalName: string;
  hospitalLogo?: string | null;
  /** أزواج (عنوان، قيمة) تُعرض تحت العنوان — مثل بيانات المريض */
  meta?: [string, string | number | null | undefined][];
  body: string;
  printedBy: string;
  printedAtLabel: string;
  pageLabel: string;
  landscape?: boolean;
  /** نص التوقيعات أسفل آخر صفحة */
  signatures?: string[];
}

const CSS = `
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,'Noto Naskh Arabic',sans-serif;color:#111;margin:0;font-size:10.5pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .doc{padding:0 2mm}
  .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0e7c66;padding-bottom:8px;margin-bottom:10px}
  .head img{width:54px;height:54px;object-fit:contain}
  .head .h{flex:1;min-width:0}
  .head .hosp{font-size:13pt;font-weight:800;margin:0}
  .head .sys{font-size:8pt;color:#666;margin:0}
  .title{font-size:15pt;font-weight:800;margin:6px 0 2px}
  .sub{color:#555;font-size:9.5pt;margin:0 0 8px}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 12px;border:1px solid #ccc;border-radius:6px;padding:8px 10px;margin:8px 0 12px;font-size:9.5pt}
  .meta div{min-width:0}
  .meta b{display:block;color:#666;font-weight:600;font-size:8pt}
  h2{font-size:11.5pt;margin:14px 0 6px;padding:3px 8px;background:#eef5f3;border-inline-start:3px solid #0e7c66;break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:9pt}
  th,td{border:1px solid #bbb;padding:3px 5px;text-align:start;vertical-align:top}
  th{background:#f1f1f1;font-weight:700}
  thead{display:table-header-group}
  tr{break-inside:avoid}
  .num{text-align:center;white-space:nowrap}
  .ltr{direction:ltr;unicode-bidi:isolate}
  .nw{white-space:nowrap}
  td.ltr{text-align:end}
  .abn{font-weight:800;color:#b91c1c}
  .muted{color:#666}
  td.wide{width:24%}
  .box{border:1px solid #ccc;border-radius:6px;padding:8px 10px;white-space:pre-wrap;break-inside:avoid}
  .summary{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}
  .summary span{border:1px solid #ccc;border-radius:6px;padding:3px 8px;font-size:9pt}
  .summary b{font-size:11pt}
  .sign{display:flex;justify-content:space-between;gap:24px;margin-top:36px;font-size:9.5pt;break-inside:avoid}
  .sign div{flex:1;border-top:1px solid #555;padding-top:4px;text-align:center}
  .foot{margin-top:14px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#666;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .sysmark{display:inline-flex;align-items:center;gap:4px;font-family:Syncopate,'Segoe UI',sans-serif;font-weight:700;letter-spacing:.08em;font-size:6.5pt;color:#888}
  .sysmark svg{width:11px;height:11px}
  .empty{color:#777;font-style:italic}
  @media screen{body{background:#e9ecef}.doc{background:#fff;max-width:210mm;margin:12px auto;padding:12mm;box-shadow:0 2px 12px rgba(0,0,0,.15)}.landscape .doc{max-width:297mm}}
`;

export function openPrintDocument(o: PrintDocOptions): void {
  const rtl = currentLang() === 'ar';
  const meta = (o.meta ?? []).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const html = `<!doctype html><html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}" class="${o.landscape ? 'landscape' : ''}"><head><meta charset="utf-8">
<title>${esc(o.title)} — ${esc(o.hospitalName)}</title>
<style>
@page{size:A4 ${o.landscape ? 'landscape' : 'portrait'};margin:12mm 10mm 14mm;@bottom-center{content:"${esc(o.pageLabel)} " counter(page) " / " counter(pages);font-size:8pt;color:#666}}
${CSS}
</style></head><body><div class="doc">
<div class="head">
  ${o.hospitalLogo ? `<img src="${esc(o.hospitalLogo)}" alt="">` : ''}
  <div class="h"><p class="hosp">${esc(o.hospitalName)}</p></div>
</div>
<div class="title">${esc(o.title)}</div>
${o.subtitle ? `<p class="sub">${esc(o.subtitle)}</p>` : ''}
${meta.length ? `<div class="meta">${meta.map(([k, v]) => `<div><b>${esc(k)}</b><bdi>${esc(v)}</bdi></div>`).join('')}</div>` : ''}
${o.body}
${o.signatures?.length ? `<div class="sign">${o.signatures.map((s) => `<div>${esc(s)}</div>`).join('')}</div>` : ''}
<div class="foot"><span>${esc(o.printedAtLabel)}: ${esc(fmtDateTime(new Date().toISOString()))}</span><span>${esc(o.printedBy)}</span><span class="sysmark" dir="ltr">${qMarkSvg({ colors: Q_COLORS.mono('#888') })}Q VIREXA</span></div>
</div>
</body></html>`;
  const w = window.open('', '_blank', `width=${o.landscape ? 1100 : 860},height=900`);
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  // الطباعة تُدار من النافذة الأم (سياسة CSP تمنع السكربتات داخل نافذة الطباعة):
  // ننتظر الصور (شعار المستشفى) والخطوط ثم نفتح حوار الطباعة
  const doc = w.document;
  const images = Array.from(doc.images).map((i) =>
    i.complete
      ? Promise.resolve()
      : new Promise<void>((r) => {
          i.onload = i.onerror = () => r();
        }),
  );
  void Promise.all([...images, doc.fonts?.ready.catch(() => undefined)]).then(() =>
    setTimeout(() => {
      w.focus();
      w.print();
    }, 150),
  );
}

/** جدول HTML من صفوف (القيم تُهرَّب) */
export function htmlTable(
  headers: string[],
  rows: (string | number | null | undefined | { html: string })[][],
  opts: { numCols?: number[]; empty?: string; cellClass?: (col: number) => string } = {},
): string {
  if (rows.length === 0) return `<p class="empty">${esc(opts.empty ?? '—')}</p>`;
  const cell = (v: string | number | null | undefined | { html: string }, i: number) => {
    const names = [opts.numCols?.includes(i) ? 'num' : '', opts.cellClass?.(i) ?? ''].filter(Boolean).join(' ');
    const cls = names ? ` class="${names}"` : '';
    if (v && typeof v === 'object' && 'html' in v) return `<td${cls}>${v.html}</td>`;
    return `<td${cls}>${v === null || v === undefined || v === '' ? '—' : esc(v)}</td>`;
  };
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map(cell).join('')}</tr>`)
    .join('')}</tbody></table>`;
}
