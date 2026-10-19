'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * Returns `false` during server rendering and the first client paint, then the
 * real answer once the query can be evaluated. Callers must therefore treat
 * `false` as "not yet known" for anything that would render differently on the
 * two sides, or they will trip a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
