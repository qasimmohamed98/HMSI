import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export const isMobileQuery = '(max-width: 639px)';
export const isTabletQuery = '(min-width: 640px) and (max-width: 1023px)';
export const isDesktopQuery = '(min-width: 1024px)';
export const isLargeQuery = '(min-width: 1440px)';