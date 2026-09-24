import type { TFunction } from 'i18next';
import type { ChartData } from '@/lib/api';
import { calcAge, fmtDate, fmtDateTime } from '@/lib/format';
import { currentLang } from '@/i18n';

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** يفتح نافذة طباعة بملخص الخروج (للمريض وللأرشيف الورقي) */
export function printDischargeSummary(chart: ChartData, t: TFunction): void {
  const p = chart.patient;
  const a = p.admission;
  if (!a) return;
  const rtl = currentLang() === 'ar';
  const row = (label: string, value: unknown) => (value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : '');
  const diagnoses = chart.diagnoses.map((d) => `<li>${esc(d.title_ar)}${d.icd10 ? ` <span dir="ltr">(${esc(d.icd10)})</span>` : ''} — ${esc(t(`diagnosis.statuses.${d.status}`))}</li>`).join('');
  const meds = chart.medications
    .filter((m) => m.status === 'active')
    .map((m) => `<li>${esc(m.name_ar)} — ${esc(m.dose)} · ${esc(m.route)} · ${esc(m.frequency)}</li>`)
    .join('');

  const html = `<!doctype html><html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${esc(t('ui.summaryTitle'))} — ${esc(p.full_name_ar)}</title>
<style>
  body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:32px;color:#111;line-height:1.6}
  h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}
  .sub{color:#555;font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}
  th{text-align:start;width:32%;color:#555;font-weight:600;padding:4px 0;vertical-align:top}td{padding:4px 0}
  ul{margin:4px 0;padding-inline-start:20px;font-size:14px}.box{white-space:pre-wrap;font-size:14px;border:1px solid #ddd;border-radius:8px;padding:10px}
  .sign{margin-top:48px;display:flex;justify-content:space-between;font-size:13px}
</style></head><body>
<h1>${esc(t('ui.summaryTitle'))}</h1>
<div class="sub">${esc(fmtDateTime(new Date().toISOString()))}</div>
<h2>${esc(t('track.patient'))}</h2>
<table>
${row(t('patients.name'), p.full_name_ar + (p.full_name_en ? ` — ${p.full_name_en}` : ''))}
${row(t('patients.fileNumber'), p.file_number)}
${row(t('patients.age'), `${calcAge(p.birth_date)} ${t('common.years')} · ${t(`gender.${p.gender}`)}`)}
${row(t('patients.bloodType'), p.blood_type)}
</table>
<h2>${esc(t('chart.admissionSummary'))}</h2>
<table>
${row(t('patients.department'), a.department_name_ar)}
${row(t('chart.attendingDoctor'), a.attending_doctor)}
${row(t('patients.admittedAt'), fmtDate(a.admitted_at))}
${row(t('history.dischargedAt'), a.discharged_at ? fmtDate(a.discharged_at) : '')}
${row(t('history.dischargeType'), a.discharge_type ? t(`discharge.types.${a.discharge_type}`) : '')}
${row(t('history.reason'), a.reason)}
</table>
${diagnoses ? `<h2>${esc(t('diagnosis.title'))}</h2><ul>${diagnoses}</ul>` : ''}
${meds ? `<h2>${esc(t('medications.title'))}</h2><ul>${meds}</ul>` : ''}
${a.discharge_summary ? `<h2>${esc(t('history.dischargeSummary'))}</h2><div class="box">${esc(a.discharge_summary)}</div>` : ''}
<div class="sign"><span>${esc(t('chart.attendingDoctor'))}: ____________</span><span>${esc(t('common.confirm'))}: ____________</span></div>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
