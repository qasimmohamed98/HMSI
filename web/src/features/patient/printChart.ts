import type { TFunction } from 'i18next';
import type { User } from '@hmsi/shared';
import { calcMews } from '@hmsi/shared';
import type { ChartData } from '@/lib/api';
import { calcAge, doctorName, fmtDate, fmtDateTime, localName } from '@/lib/format';
import { jsonParse } from '@/lib/demo-data';
import { esc, htmlTable, openPrintDocument } from '@/lib/print-doc';

/**
 * مطبوعات المريض على A4 بشعار المستشفى: الملف الطبي كاملاً، تقرير التحاليل، تقرير الأشعة، ملخص الخروج.
 */

type Meta = [string, string | number | null | undefined][];

function patientMeta(chart: ChartData, t: TFunction): Meta {
  const p = chart.patient;
  const a = p.admission;
  const allergies = jsonParse<string[]>(p.allergies_json, []);
  return [
    [t('patients.name'), p.full_name_ar + (p.full_name_en ? ` — ${p.full_name_en}` : '')],
    [t('patients.fileNumber'), p.file_number],
    [t('patients.age'), `${calcAge(p.birth_date)} ${t('common.years')} · ${t(`gender.${p.gender}`)}`],
    [t('patients.bloodType'), p.blood_type],
    [t('patients.department'), a ? localName(a, 'department_name') : null],
    [t('patients.bed'), a ? `${localName(a, 'ward_name')} · ${a.room}/${a.bed_no}` : null],
    [t('chart.attendingDoctor'), doctorName(a) || null],
    [t('chart.admitted'), a ? fmtDate(a.admitted_at) : null],
    [t('chart.allergies'), allergies.length ? allergies.join('، ') : null],
    [t('history.dischargedAt'), a?.discharged_at ? fmtDate(a.discharged_at) : null],
  ];
}

function base(user: User | null, t: TFunction) {
  return {
    hospitalName: localName(user, 'hospital_name'),
    hospitalLogo: user?.hospital_logo_url,
    printedBy: `${t('print.printedBy')}: ${localName(user, 'full_name')}`,
    printedAtLabel: t('ui.printedAt'),
    pageLabel: t('print.page'),
  };
}

const ltr = (v: unknown) => ({ html: `<bdi dir="ltr" class="nw">${esc(v ?? '—')}</bdi>` });

function labsTable(chart: ChartData, t: TFunction, onlyResulted: boolean): string {
  const labs = chart.labs.filter((l) => !onlyResulted || l.result);
  return htmlTable(
    [t('reports.cols.test'), t('reports.cols.result'), t('reports.cols.unit'), t('reports.cols.reference_range'), t('reports.cols.status'), t('reports.cols.ordered_at'), t('reports.cols.resulted_at'), t('reports.cols.resulted_by')],
    labs.map((l) => [
      l.test_name_ar + (l.test_name_en ? ` (${l.test_name_en})` : ''),
      l.result ? { html: `<bdi dir="ltr"${l.status === 'abnormal' ? ' class="abn"' : ''}>${esc(l.result)}</bdi>${l.status === 'abnormal' ? ' ▲' : ''}` } : null,
      l.unit ? ltr(l.unit) : null,
      l.reference_range ? ltr(l.reference_range) : null,
      t(`laboratory.statuses.${l.status}`),
      { html: `<span class="nw">${esc(fmtDateTime(l.ordered_at))}</span>` },
      l.resulted_at ? { html: `<span class="nw">${esc(fmtDateTime(l.resulted_at))}</span>` } : null,
      l.resulted_by,
    ]),
    { empty: t('print.noResults') },
  );
}

function radiologyBlocks(chart: ChartData, t: TFunction, onlyId?: string): string {
  const list = chart.radiology.filter((r) => (onlyId ? r.id === onlyId : Boolean(r.report)));
  if (list.length === 0) return `<p class="empty">${esc(t('print.noReports'))}</p>`;
  return list
    .map(
      (r) => `<h2>${esc(r.study_type_ar)}${r.study_type_en ? ` <span class="muted">(${esc(r.study_type_en)})</span>` : ''}</h2>
<p class="muted">${esc(t('reports.cols.ordered_at'))}: ${esc(fmtDateTime(r.ordered_at))} · ${esc(t('reports.cols.ordered_by'))}: ${esc(r.ordered_by)}${r.performed_by ? ` · ${esc(t('reports.cols.performed_by'))}: ${esc(r.performed_by)}` : ''}</p>
<div class="box">${esc(r.report ?? '—')}</div>`,
    )
    .join('');
}

/** الملف الطبي كاملاً للتنويم المعروض */
export function printFullChart(chart: ChartData, t: TFunction, user: User | null): void {
  const vitals = chart.vitals.slice(0, 15);
  const sections: string[] = [];
  const a = chart.patient.admission;
  if (a?.reason) sections.push(`<h2>${esc(t('history.reason'))}</h2><div class="box">${esc(a.reason)}</div>`);

  sections.push(
    `<h2>${esc(t('diagnosis.title'))}</h2>` +
      htmlTable(
        [t('reports.cols.diagnosis'), 'ICD-10', t('reports.cols.status'), t('reports.cols.doctor')],
        chart.diagnoses.map((d) => [d.title_ar, d.icd10 ? ltr(d.icd10) : null, t(`diagnosis.statuses.${d.status}`), d.added_by]),
        { empty: '—' },
      ),
  );

  sections.push(
    `<h2>${esc(t('print.latestVitals'))}</h2>` +
      htmlTable(
        [t('vitals.recordedAt'), t('vitals.temperature'), t('vitals.pulse'), t('vitals.respiratoryRate'), t('vitals.bp'), t('vitals.spo2'), t('vitals.pain'), 'MEWS'],
        vitals.map((v) => [
          { html: `<span class="nw">${esc(fmtDateTime(v.recorded_at))}</span>` },
          v.temperature,
          v.pulse,
          v.respiratory_rate,
          v.bp_systolic ? ltr(`${v.bp_systolic}/${v.bp_diastolic ?? '—'}`) : null,
          v.spo2 != null ? `${v.spo2}%` : null,
          v.pain_score,
          calcMews(v)?.score ?? null,
        ]),
        { numCols: [1, 2, 3, 5, 6, 7], empty: '—' },
      ),
  );

  sections.push(
    `<h2>${esc(t('print.activeMeds'))}</h2>` +
      htmlTable(
        [t('reports.cols.medication'), t('reports.cols.dose'), t('reports.cols.route'), t('reports.cols.frequency'), t('reports.cols.med_status'), t('reports.cols.prescribed_by'), t('reports.cols.dispensed_at')],
        chart.medications.map((m) => [m.name_ar, m.dose, m.route, m.frequency, t(`medications.statuses.${m.status}`), m.prescribed_by, m.dispensed_at ? fmtDateTime(m.dispensed_at) : null]),
        { empty: '—' },
      ),
  );

  if (chart.administrations.length) {
    const medName = (id: string) => chart.medications.find((m) => m.id === id)?.name_ar ?? '';
    sections.push(
      `<h2>${esc(t('mar.title'))}</h2>` +
        htmlTable(
          [t('reports.cols.administered_at'), t('reports.cols.medication'), t('reports.cols.dose_status'), t('reports.cols.administered_by'), t('reports.cols.note')],
          chart.administrations.slice(0, 40).map((x) => [{ html: `<span class="nw">${esc(fmtDateTime(x.administered_at))}</span>` }, medName(x.medication_id), t(`mar.statuses.${x.status}`), x.administered_by, x.note]),
        ),
    );
  }

  sections.push(`<h2>${esc(t('laboratory.title'))}</h2>` + labsTable(chart, t, false));
  sections.push(`<h2>${esc(t('radiology.title'))}</h2>` + radiologyBlocks(chart, t).replace(/<h2>/g, '<h3 style="font-size:10.5pt;margin:8px 0 2px">').replace(/<\/h2>/g, '</h3>'));

  if (chart.procedures.length) {
    sections.push(
      `<h2>${esc(t('procedures.title'))}</h2>` +
        htmlTable([t('procedures.name'), t('reports.cols.performed_by'), t('vitals.recordedAt'), t('reports.cols.note')], chart.procedures.map((p) => [p.name_ar, p.performed_by, fmtDateTime(p.performed_at), p.notes])),
    );
  }
  if (chart.consultations.length) {
    sections.push(
      `<h2>${esc(t('consultations.title'))}</h2>` +
        chart.consultations
          .map((c) => `<div class="box" style="margin-bottom:6px"><b>${esc(c.specialty)}</b> — ${esc(c.reason)}${c.response ? `<br><span class="muted">${esc(c.responded_by ?? '')}:</span> ${esc(c.response)}` : ''}</div>`)
          .join(''),
    );
  }
  const notes = chart.notes.slice(0, 30);
  if (notes.length) {
    sections.push(
      `<h2>${esc(t('print.notes'))}</h2>` +
        notes
          .map((n) => `<div class="box" style="margin-bottom:6px"><span class="muted">${esc(n.kind === 'doctor' ? t('notes.doctorTitle') : t('notes.nursingTitle'))} · ${esc(n.author)} · ${esc(fmtDateTime(n.recorded_at))}</span><br>${esc(n.content)}</div>`)
          .join(''),
    );
  }
  if (a?.discharge_summary) sections.push(`<h2>${esc(t('history.dischargeSummary'))}</h2><div class="box">${esc(a.discharge_summary)}</div>`);

  openPrintDocument({
    ...base(user, t),
    title: t('print.chartTitle'),
    meta: patientMeta(chart, t),
    body: sections.join(''),
    signatures: [t('print.doctorSign'), t('print.stamp')],
  });
}

/** تقرير التحاليل الصادرة للتنويم */
export function printLabReport(chart: ChartData, t: TFunction, user: User | null): void {
  openPrintDocument({
    ...base(user, t),
    title: t('print.labTitle'),
    meta: patientMeta(chart, t),
    body: labsTable(chart, t, true) + `<p class="muted" style="margin-top:6px">▲ ${esc(t('track.abnormal'))}</p>`,
    signatures: [t('print.labSign'), t('print.stamp')],
  });
}

/** تقرير الأشعة: كل التقارير المكتوبة أو تقرير واحد */
export function printRadiologyReport(chart: ChartData, t: TFunction, user: User | null, reportId?: string): void {
  openPrintDocument({
    ...base(user, t),
    title: t('print.radTitle'),
    meta: patientMeta(chart, t),
    body: radiologyBlocks(chart, t, reportId),
    signatures: [t('print.radSign'), t('print.stamp')],
  });
}

/** ملخص الخروج (للمريض وللأرشيف الورقي) */
export function printDischargeSummary(chart: ChartData, t: TFunction, user: User | null): void {
  const a = chart.patient.admission;
  if (!a) return;
  const diagnoses = chart.diagnoses.filter((d) => d.status !== 'suspected');
  const meds = chart.medications.filter((m) => m.status === 'active');
  const body = [
    `<h2>${esc(t('print.admission'))}</h2>`,
    htmlTable(
      [t('history.reason'), t('patients.admittedAt'), t('history.dischargedAt'), t('history.dischargeType'), t('reports.cols.los_days')],
      [[
        a.reason,
        fmtDate(a.admitted_at),
        a.discharged_at ? fmtDate(a.discharged_at) : null,
        a.discharge_type ? t(`discharge.types.${a.discharge_type}`) : null,
        a.discharged_at ? Math.max(0, Math.round((Date.parse(a.discharged_at) - Date.parse(a.admitted_at)) / 8.64e6) / 10) : null,
      ]],
    ),
    `<h2>${esc(t('diagnosis.title'))}</h2>`,
    htmlTable([t('reports.cols.diagnosis'), 'ICD-10', t('reports.cols.status')], diagnoses.map((d) => [d.title_ar, d.icd10 ? ltr(d.icd10) : null, t(`diagnosis.statuses.${d.status}`)]), { empty: '—' }),
    `<h2>${esc(t('medications.title'))}</h2>`,
    htmlTable([t('reports.cols.medication'), t('reports.cols.dose'), t('reports.cols.route'), t('reports.cols.frequency')], meds.map((m) => [m.name_ar, m.dose, m.route, m.frequency]), { empty: '—' }),
    a.discharge_summary ? `<h2>${esc(t('history.dischargeSummary'))}</h2><div class="box">${esc(a.discharge_summary)}</div>` : '',
  ].join('');
  openPrintDocument({
    ...base(user, t),
    title: t('ui.summaryTitle'),
    meta: patientMeta(chart, t),
    body,
    signatures: [t('print.doctorSign'), t('print.stamp')],
  });
}
