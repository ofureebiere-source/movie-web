import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/**
 * The theme follows the device, with no toggle and no stored override.
 *
 * There is deliberately no localStorage key: a stored choice would outlive the
 * device setting and leave the site stuck on a theme the visitor can no longer
 * change from here. `prefers-color-scheme` is the single source of truth, and
 * the change listener below keeps an open tab in step when the OS flips.
 */
function readDeviceTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
  }
  return 'dark';
}

/**
 * Applies the device theme to <html data-theme> and follows it live.
 *
 * The attribute is also set before React paints (see the inline script in
 * index.html) so there is no flash of the wrong theme on load; this hook takes
 * over from there and re-applies on every device change.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readDeviceTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(LIGHT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setTheme(event.matches ? 'light' : 'dark');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }, [theme]);

  return { theme };
}
