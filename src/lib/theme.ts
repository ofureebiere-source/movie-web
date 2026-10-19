import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'netflixpro_theme';

/**
 * The reference ships a single dark scheme with no toggle. Light mode is our
 * addition, so it follows the platform preference until the visitor chooses
 * explicitly — after that the choice sticks and stops tracking the OS.
 */
function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* storage disabled — fall through to the media query */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/**
 * Applies the theme to <html data-theme> and keeps it in sync.
 *
 * The attribute is set before React paints (see the inline script in
 * index.html) so there is no flash of the wrong theme on load; this hook just
 * takes over from there.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage disabled — the choice just won't persist */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
