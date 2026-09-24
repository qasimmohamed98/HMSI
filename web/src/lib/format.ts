import { currentLang } from '@/i18n';

/**
 * كل الأرقام والتواريخ بأرقام لاتينية (0-9) في الواجهتين — القيم الطبية (الضغط، الجرعات، أرقام الملفات)
 * تُكتب بها أصلاً، وخلط «٢٤» مع «24» في نفس الشاشة مربك.
 */
export function locale(): string {
  return currentLang() === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB';
}

export function fmtDate(value: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(locale(), opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function fmtPercent(ratio: number): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

export function calcAge(birthDate: string): number {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** الأحرف الأولى من أول كلمتين: «فاطمة سعيد» → «ف س»، «Omar Ali» → «OA» */
export function chipKey(v: string): string {
  const words = (v ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '..';
  // «المستشفى» → «م» وليس «ا» (تجاهل أداة التعريف)
  const letters = words.slice(0, 2).map((w) => [...(w.length > 3 && w.startsWith('ال') ? w.slice(2) : w)][0]!.toUpperCase());
  return /[؀-ۿ]/.test(letters[0]!) ? letters.join(' ') : letters.join('');
}

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD (وليس UTC — يختلف بعد منتصف الليل بتوقيت العراق) */
export function todayISO(): string {
  return localISODate(new Date());
}

export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** يختار الاسم حسب لغة الواجهة: localName(ward, 'name') → name_ar أو name_en */
export function localName<T extends string>(obj: Partial<Record<`${T}_ar` | `${T}_en`, string | null>> | null | undefined, base: T): string {
  if (!obj) return '';
  const ar = (obj as Record<string, string | null | undefined>)[`${base}_ar`] ?? '';
  const en = (obj as Record<string, string | null | undefined>)[`${base}_en`] ?? '';
  return currentLang() === 'en' ? en || ar : ar || en;
}
