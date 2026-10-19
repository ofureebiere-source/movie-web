import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Clock, Film, Home, Search, Sparkles, Tv, Code2 } from 'lucide-react';
import { WORDMARK_ACCENT, WORDMARK_LEAD } from '@/lib/brand';
import MobileNav from './MobileNav';

/**
 * The sticky top bar.
 *
 * Ported 1:1 from frameXTV.xyz's header: a 14-unit bar, a square badge + two
 * tone wordmark on the left, the five primary destinations in the middle
 * (hidden below `sm`), and the Search / My List / History actions on the right.
 * The mobile variant is the fixed bottom nav.
 *
 * The `/` shortcut focuses search from anywhere, and the `kbd` chip in the
 * search button advertises it.
 */

const NAV = [
  { label: 'Home', path: '/', icon: Home, match: (p: string) => p === '/' },
  { label: 'Movies', path: '/movies', icon: Film, match: (p: string) => p.startsWith('/movies') || p.startsWith('/movie') },
  { label: 'TV', path: '/tv', icon: Tv, match: (p: string) => p.startsWith('/tv') },
  { label: 'Anime', path: '/anime', icon: Sparkles, match: (p: string) => p.startsWith('/anime') },
  { label: 'API', path: '/api', icon: Code2, match: (p: string) => p.startsWith('/api') || p.startsWith('/docs') },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      event.preventDefault();
      navigate('/search');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const isSearch = path.startsWith('/search');
  const isMyList = path.startsWith('/my-list');
  const isHistory = path.startsWith('/history');

  const actionClass = (active: boolean) =>
    `p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 ${
      active
        ? 'accent-active bg-white text-black border-white font-bold shadow-sm'
        : 'glass-control bg-zinc-950/80 hover:bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.15]'
    }`;

  return (
    <>
      <header className="border-b border-white/[0.05] bg-black/95 glass-panel backdrop-blur-md sticky top-0 z-50 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/"
              className="flex items-center text-left focus-visible:ring-2 focus-visible:ring-zinc-400/50 rounded-md cursor-pointer group"
            >
              <div className="flex items-baseline whitespace-nowrap">
                <span className="font-extrabold tracking-tight text-white text-base sm:text-lg transition-opacity group-hover:opacity-80">
                  {WORDMARK_LEAD}
                  <span className="text-brand-red">{WORDMARK_ACCENT}</span>
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden sm:flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
            {NAV.map((item) => {
              const active = item.match(path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'accent-active bg-white text-black font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-black' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <Link
              to="/search"
              title="Search movies, TV series, anime (/)"
              className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-2 text-xs font-medium cursor-pointer ${
                isSearch
                  ? 'accent-active bg-white text-black border-white font-bold shadow-sm'
                  : 'glass-control bg-zinc-950/80 hover:bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.15]'
              }`}
            >
              <Search className={`w-3.5 h-3.5 ${isSearch ? 'text-black' : 'text-zinc-400'}`} />
              <span className="hidden md:inline">Search</span>
              <kbd
                className={`hidden md:inline-block text-[10px] font-mono px-1 py-0.2 rounded border ${
                  isSearch ? 'bg-zinc-200 border-zinc-300 text-black' : 'bg-zinc-900 border-white/[0.08] text-zinc-500'
                }`}
              >
                /
              </kbd>
            </Link>

            <Link
              to="/my-list"
              data-testid="nav-my-list-btn"
              title="My List"
              aria-label="My List"
              className={actionClass(isMyList)}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isMyList ? 'text-black fill-black' : 'text-zinc-400'}`} />
              <span className="hidden md:inline">My List</span>
            </Link>

            <Link
              to="/history"
              data-testid="nav-history-btn"
              title="Watch History"
              aria-label="Watch History"
              className={actionClass(isHistory)}
            >
              <Clock className={`w-3.5 h-3.5 ${isHistory ? 'text-black' : 'text-zinc-400'}`} />
              <span className="hidden md:inline">History</span>
            </Link>
          </div>
        </div>
      </header>

      <MobileNav />
    </>
  );
}
