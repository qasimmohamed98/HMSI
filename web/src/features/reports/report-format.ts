import type { TFunction } from 'i18next';
import type { DetailedReport, ReportColumn } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { currentLang } from '@/i18n';
import { esc, htmlTable, openPrintDocument } from '@/lib/print-doc';

const LTR_KEYS = ['file_number', 'bed', 'icd10', 'unit', 'reference_range'];

/** قيمة خلية معروضة كنص (للجدول والطباعة) */
export function cellText(c: ReportColumn, v: string | number | null | undefined, t: TFunction, row?: Record<string, string | number | null>): string {
  // الواجهة الإنجليزية: الاسم الإنجليزي للقسم/الفحص/المريض إن وُجد
  if (row && currentLang() === 'en') {
    const en = row[`${c.key}_en`];
    if (en !== null && en !== undefined && en !== '') v = en;
  }
  if (v === null || v === undefined || v === '') return '';
  switch (c.kind) {
    case 'datetime':
      return fmtDateTime(String(v));
    case 'date':
      return fmtDate(String(v));
    case 'percent':
      return `${Math.round(Number(v) * 100)}%`;
    case 'enum':
      return t(`${c.enumPrefix}.${v}`, { defaultValue: String(v) });
    case 'number':
      return String(v);
    default:
      return String(v);
  }
}

export interface ReportContext {
  title: string;
  rangeLabel: string;
  filtersLabel: string;
  hospitalName: string;
  hospitalLogo: string | null | undefined;
  printedBy: string;
}

/** طباعة التقرير على A4 أفقي بترويسة المستشفى والملخص والجدول الكامل */
export function printReport(report: DetailedReport, ctx: ReportContext, t: TFunction): void {
  const summary = `<div class="summary">${report.summary
    .map((s) => `<span>${esc(t(`reports.sum.${s.key}`))}: <b>${esc(s.value)}</b></span>`)
    .join('')}</div>`;
  const numCols = report.columns.map((c, i) => (c.kind === 'number' || c.kind === 'percent' ? i : -1)).filter((i) => i >= 0);
  const table = htmlTable(
    report.columns.map((c) => t(`reports.cols.${c.key}`)),
    report.rows.map((r) =>
      report.columns.map((c) => {
        const text = cellText(c, r[c.key], t, r);
        return LTR_KEYS.includes(c.key) && text ? { html: `<bdi dir="ltr">${esc(text)}</bdi>` } : text;
      }),
    ),
    {
      numCols,
      empty: t('reports.empty'),
      // الرموز والأرقام اللاتينية لا تنقلب ولا تنكسر
      cellClass: (i) => {
        const c = report.columns[i]!;
        if (LTR_KEYS.includes(c.key)) return 'nw';
        return c.kind === 'datetime' || c.kind === 'date' ? 'nw' : '';
      },
    },
  );
  openPrintDocument({
    title: ctx.title,
    subtitle: [ctx.rangeLabel, ctx.filtersLabel].filter(Boolean).join(' · '),
    hospitalName: ctx.hospitalName,
    hospitalLogo: ctx.hospitalLogo,
    body: summary + table,
    printedBy: ctx.printedBy,
    printedAtLabel: t('ui.printedAt'),
    pageLabel: t('print.page'),
    landscape: report.columns.length > 7,
  });
}

/** تصدير Excel (xlsx) بالعربية من اليمين لليسار، مع صف عنوان وملخص */
export async function exportReportExcel(report: DetailedReport, ctx: ReportContext, t: TFunction, rtl: boolean): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file');
  type Cell = { value?: string | number | Date; type?: typeof String | typeof Number | typeof Date; fontWeight?: 'bold'; format?: string; backgroundColor?: string; wrap?: boolean; span?: number } | null;
  const header: Cell[] = report.columns.map((c) => ({ value: t(`reports.cols.${c.key}`), fontWeight: 'bold', backgroundColor: '#E6F2EF', wrap: true }));
  const rows: Cell[][] = report.rows.map((r) =>
    report.columns.map((c): Cell => {
      const v = r[c.key];
      if (v === null || v === undefined || v === '') return null;
      if (c.kind === 'number') return { value: Number(v), type: Number };
      if (c.kind === 'percent') return { value: Number(v), type: Number, format: '0%' };
      if (c.kind === 'datetime' || c.kind === 'date') {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? { value: String(v), type: String } : { value: d, type: Date, format: c.kind === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm' };
      }
      return { value: cellText(c, v, t, r), type: String };
    }),
  );
  const n = report.columns.length;
  const titleRow: Cell[] = [{ value: `${ctx.hospitalName} — ${ctx.title}`, fontWeight: 'bold', span: n }, ...Array(n - 1).fill(null)];
  const rangeRow: Cell[] = [{ value: [ctx.rangeLabel, ctx.filtersLabel].filter(Boolean).join(' · '), span: n }, ...Array(n - 1).fill(null)];
  const sumRow: Cell[] = [{ value: report.summary.map((s) => `${t(`reports.sum.${s.key}`)}: ${s.value}`).join('   |   '), span: n }, ...Array(n - 1).fill(null)];
  const widths = report.columns.map((c) => ({ width: c.kind === 'datetime' ? 18 : c.kind === 'number' || c.kind === 'percent' ? 10 : ['report', 'discharge_summary', 'reason', 'note', 'alerts', 'allergies'].includes(c.key) ? 40 : 20 }));
  await writeXlsxFile([titleRow, rangeRow, sumRow, [], header, ...rows] as never, {
    columns: widths,
    fileName: `${ctx.title} ${report.from}_${report.to}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'),
    rightToLeft: rtl,
    stickyRowsCount: 5,
    fontFamily: 'Arial',
    fontSize: 11,
  });
}
