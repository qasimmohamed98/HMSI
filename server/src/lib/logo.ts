/** رابط شعار المستشفى العام (مع رقم نسخة ليُخزَّن في المتصفح ويتجدد عند تغييره) */
export function logoUrl(hospitalId: unknown, updatedAt: unknown): string | null {
  if (!updatedAt) return null;
  return `/api/public/hospitals/${encodeURIComponent(String(hospitalId))}/logo?v=${encodeURIComponent(String(updatedAt))}`;
}
