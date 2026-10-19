import { Link, useLocation } from 'react-router-dom';
import { Clock, Film, Home, Sparkles, Tv } from 'lucide-react';

/**
 * The fixed bottom navigation, shown below `sm`.
 *
 * Ported 1:1 from frameXTV.xyz's mobile nav: five destinations, safe-area
 * padding for the home indicator, and the active item in white.
 */

const ITEMS = [
  { label: 'Home', path: '/', icon: Home, match: (p: string) => p === '/' },
  { label: 'Movies', path: '/movies', icon: Film, match: (p: string) => p.startsWith('/movies') || p.startsWith('/movie') },
  { label: 'TV', path: '/tv', icon: Tv, match: (p: string) => p.startsWith('/tv') },
  { label: 'Anime', path: '/anime', icon: Sparkles, match: (p: string) => p.startsWith('/anime') },
  { label: 'History', path: '/history', icon: Clock, match: (p: string) => p.startsWith('/history') },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 glass-panel backdrop-blur-lg border-t border-white/[0.05] flex items-center justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] sm:hidden shadow-2xl"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all active:scale-95 cursor-pointer min-w-[54px] min-h-[44px] ${
              active ? 'accent-active text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-white' : 'text-zinc-500'}`} />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
