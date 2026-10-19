import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

/**
 * Light/dark toggle for the top bar.
 *
 * The reference has no such control, so this is deliberately restrained: a
 * plain icon button matching the height and hover treatment of the nav
 * actions beside it, not a new visual idiom.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-testid="theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 sm:p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
