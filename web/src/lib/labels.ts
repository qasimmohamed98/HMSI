import JsBarcode from 'jsbarcode';
import type { TFunction } from 'i18next';
import type { AdmissionSummary, LabResult, Patient } from '@hmsi/shared';
import { API } from './api';
import { calcAge, fmtDateTime } from './format';

/**
 * ملصقات الباركود (سوار المريض + عيّنات المختبر).
 * نسخة HTML تُطبع على أي طابعة معرّفة في النظام (بما فيها الحرارية عبر برنامج تشغيلها)،
 * ورابط ZPL من الخادم للطابعات الحرارية عبر وكيل طباعة محلي — انظر server/src/routes/labels.ts.
 */

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function barcodeSvg(value: string, height: number, width = 1.4): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, { format: 'CODE128', height, width, margin: 0, displayValue: false });
  return svg.outerHTML;
}

function openLabelWindow(opts: { title: string; pageSize: string; body: string; zplUrl: string | null; t: TFunction }): void {
  const { title, pageSize, body, zplUrl, t } = opts;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page{size:${pageSize};margin:0}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;color:#000;background:#fff}
  .label{width:${pageSize.split(' ')[0]};height:${pageSize.split(' ')[1]};padding:1.5mm 2.5mm;overflow:hidden;display:flex;gap:3mm;align-items:center}
  .col{flex:1;min-width:0;line-height:1.25}
  .name{font-weight:800;font-size:11pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:7.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mono{font-family:ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:isolate}
  svg{display:block;max-width:100%}
  .bar{direction:ltr;text-align:center}
  .tools{position:fixed;inset-inline:0;bottom:0;padding:12px;display:flex;gap:8px;justify-content:center;background:#f4f4f4;border-top:1px solid #ddd;font-size:14px}
  .tools a,.tools button{font:inherit;padding:6px 14px;border:1px solid #999;border-radius:6px;background:#fff;color:#000;text-decoration:none;cursor:pointer}
  .hint{position:fixed;top:0;inset-inline:0;padding:8px 12px;font-size:12px;color:#555;background:#fafafa;border-bottom:1px solid #eee}
  @media screen{body{padding:48px 16px 80px}.label{border:1px dashed #aaa;margin:auto}}
  @media print{.tools,.hint{display:none}}
</style></head><body>
<div class="hint">${esc(t('labels.hint'))}</div>
${body}
<div class="tools">
  <button onclick="window.print()">${esc(t('labels.print'))}</button>
  ${zplUrl ? `<a href="${esc(zplUrl)}" download>${esc(t('labels.downloadZpl'))}</a>` : ''}
</div>
</body></html>`;
  const w = window.open('', '_blank', 'width=1040,height=420');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

/** سوار المريض: 250×25 مم */
export function printWristband(patient: Patient, admission: AdmissionSummary, t: TFunction): void {
  const body = `<div class="label">
  <div class="col">
    <div class="name">${esc(patient.full_name_ar)}</div>
    ${patient.full_name_en ? `<div class="sub mono" style="text-align:right">${esc(patient.full_name_en)}</div>` : ''}
    <div class="sub"><span class="mono">${esc(patient.file_number)}</span> · ${esc(calcAge(patient.birth_date))} ${esc(t('common.years'))} · ${esc(t(`gender.${patient.gender}`))} · <span class="mono">${esc(patient.blood_type)}</span></div>
    <div class="sub">${esc(admission.ward_name_ar)} · <span class="mono">${esc(admission.room)}/${esc(admission.bed_no)}</span></div>
  </div>
  <div class="bar">${barcodeSvg(patient.file_number, 48)}<div class="sub mono">${esc(patient.file_number)}</div></div>
</div>`;
  openLabelWindow({ title: `${t('labels.wristband')} — ${patient.file_number}`, pageSize: '250mm 25mm', body, zplUrl: API.labelZplUrl(admission.id, 'wristband'), t });
}

/** ملصق أنبوب العيّنة: 50×25 مم — الباركود يحمل معرّف الطلب */
export function printSpecimenLabel(patient: Patient, admissionId: string, lab: LabResult, t: TFunction): void {
  const body = `<div class="label" style="flex-direction:column;align-items:stretch;gap:0.6mm">
  <div class="name" style="font-size:8.5pt">${esc(patient.full_name_ar)}</div>
  <div class="sub"><span class="mono">${esc(patient.file_number)}</span> · ${esc(fmtDateTime(lab.ordered_at))}</div>
  <div class="bar">${barcodeSvg(lab.id, 30, 1)}</div>
  <div class="sub" style="font-weight:700">${esc(lab.test_name_en || lab.test_name_ar)}</div>
</div>`;
  openLabelWindow({ title: `${t('labels.specimen')} — ${lab.test_name_ar}`, pageSize: '50mm 25mm', body, zplUrl: API.labelZplUrl(admissionId, { labId: lab.id }), t });
}
