import { useQuery } from '@tanstack/react-query';
import type { ServiceKind } from '@hmsi/shared';
import { API } from '@/lib/api';
import { currentLang } from '@/i18n';

/**
 * اقتراحات من كتالوج الخدمات أثناء الكتابة (أشعة أو مختبر) — ويبقى الإدخال الحر ممكناً.
 * يُربط بحقل الإدخال عبر list={id}.
 */
export function CatalogSuggestions({ id, kind }: { id: string; kind: ServiceKind }) {
  const { data } = useQuery({ queryKey: ['services', kind], queryFn: () => API.listServices({ kind }), staleTime: 5 * 60_000 });
  const en = currentLang() === 'en';
  return (
    <datalist id={id}>
      {(data ?? []).map((s) => (
        <option key={s.id} value={s.name_ar}>
          {en && s.name_en ? s.name_en : s.code}
        </option>
      ))}
    </datalist>
  );
}
