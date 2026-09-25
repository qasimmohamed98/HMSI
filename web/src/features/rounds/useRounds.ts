import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doseStatus, vitalsStatus, type DoseState } from '@hmsi/shared';
import { API } from '@/lib/api';

const ORDER: DoseState[] = ['overdue', 'due', 'upcoming', 'later', 'prn', 'unscheduled'];

/** يحسب حالة كل دواء بالتوقيت المحلي ويعيد القائمة مرتبة حسب الأولوية */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function useRounds(ward?: string, mine = false) {
  const q = useQuery({ queryKey: ['rounds', 'meds', ward ?? '', mine], queryFn: () => API.medicationRounds(ward || undefined, mine), refetchInterval: 60_000 });
  const now = useNow();
  const items = useMemo(
    () =>
      (q.data ?? [])
        .map((m) => ({ m, s: doseStatus(m, m.last_at, now) }))
        .filter((x) => x.s.state !== 'done')
        .sort((a, b) => ORDER.indexOf(a.s.state) - ORDER.indexOf(b.s.state) || (a.s.due_at ?? '').localeCompare(b.s.due_at ?? '')),
    [q.data, now],
  );
  return { ...q, items, now };
}

/** مواعيد العلامات الحيوية (التكرار من الخطة العلاجية ويُقصَّر حسب MEWS) */
export function useVitalsRounds(ward?: string, mine = false) {
  const q = useQuery({ queryKey: ['rounds', 'vitals', ward ?? '', mine], queryFn: () => API.vitalsRounds(ward || undefined, mine), refetchInterval: 60_000 });
  const now = useNow();
  const items = useMemo(
    () =>
      (q.data ?? [])
        .map((v) => ({ v, s: vitalsStatus(v, now) }))
        .sort((a, b) => ORDER.indexOf(a.s.state) - ORDER.indexOf(b.s.state) || a.s.due_at.localeCompare(b.s.due_at)),
    [q.data, now],
  );
  return { ...q, items, now };
}
