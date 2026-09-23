import { currentLang } from '@/i18n';

export function fmtDate(value: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(currentLang() === 'ar' ? 'ar-EG' : 'en-GB', opts);
}

export function fmtDateTime(value: string): string {
  const lang = currentLang();
  const d = new Date(value);
  const date = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
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

export function chipKey(v: string): string {
  return v ? v.toUpperCase().replace(/\s+/g, '').slice(0, 2) : '..';
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}