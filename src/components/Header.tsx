import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Check, Clock, Code2, Copy, Film, Home, Search, Sparkles, Tv } from 'lucide-react';
import { DiscordIcon, PumpIcon, XIcon } from '@/components/BrandIcons';
import {
  DISCORD_URL,
  SITE_NAME,
  TOKEN_CA,
  TOKEN_SHORT,
  TOKEN_URL,
  X_HANDLE,
  X_URL,
} from '@/lib/brand';
import MobileNav from './MobileNav';
import Wordmark from './Wordmark';

/**
 * The sticky top bar.
 *
 * Based on frameXTV.xyz's header: a 14-unit bar, our `Netflix-pro` wordmark on
 * the left (no badge tile), the five primary destinations in the middle
 * (hidden below `sm`), then Search / My List / History / X / Discord / the
 * $XTV token chip on the right. The mobile variant is the fixed bottom nav.
 *
 * The `/` shortcut focuses search from anywhere, and the `kbd` chip in the
 * search button advertises it. The token chip's Copy button writes the CA to
 * the clipboard and flips to "Copied!" for two seconds, and the chip body
 * opens the donation modal through `framextv:open_donation_modal` — both as
 * upstream.
 */

const NAV = [
  { label: 'Home', path: '/', icon: Home, match: (p: string) => p === '/' },
  {
    label: 'Movies',
    path: '/movies',
    icon: Film,
    match: (p: string) => p.startsWith('/movies') || p.startsWith('/movie'),
  },
  { label: 'TV', path: '/tv', icon: Tv, match: (p: string) => p.startsWith('/tv') },
  { label: 'Anime', path: '/anime', icon: Sparkles, match: (p: string) => p.startsWith('/anime') },
  {
    label: 'API',
    path: '/api',
    icon: Code2,
    match: (p: string) => p.startsWith('/api') || p.startsWith('/docs'),
  },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [copied, setCopied] = useState(false);

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

  const copyToken = (event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(TOKEN_CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <header className="border-b border-white/[0.05] bg-black/95 glass-panel backdrop-blur-md sticky top-0 z-50 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/"
              className="flex items-center space-x-2 text-left focus-visible:ring-2 focus-visible:ring-zinc-400/50 rounded-md cursor-pointer group"
            >
              <Wordmark className="text-base sm:text-lg transition-transform group-hover:scale-[1.02]" />
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

            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg glass-control bg-zinc-950/80 hover:bg-zinc-900 border border-white/[0.08] hover:border-white/[0.15] text-zinc-300 hover:text-white transition-all text-xs font-medium shrink-0 items-center gap-1.5"
              title={`Follow on X (${X_HANDLE})`}
              aria-label="Follow on X"
            >
              <XIcon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{X_HANDLE}</span>
            </a>

            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg glass-control bg-zinc-950/80 hover:bg-zinc-900 border border-white/[0.08] hover:border-white/[0.15] text-zinc-300 hover:text-white transition-all text-xs font-medium shrink-0 flex items-center gap-1.5"
              title="Join Discord community"
              aria-label="Join Discord"
            >
              <DiscordIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Community</span>
            </a>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('framextv:open_donation_modal'))}
              className="sm:hidden p-1.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-[#14F195]/30 hover:border-[#14F195]/60 text-[#14F195] transition-all text-xs shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
              title={`Support ${SITE_NAME} with Crypto (Solana / BTC)`}
              aria-label={`Support ${SITE_NAME} with Crypto`}
            >
              <PumpIcon className="w-3.5 h-3.5" />
            </button>

            <div
              className="hidden sm:flex items-center shrink-0 border border-zinc-700/80 rounded-md overflow-hidden text-xs font-mono select-none shadow-sm"
              role="group"
              aria-label={`${SITE_NAME} Token Contract Address`}
            >
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="View $XTV on pump.fun"
                className="bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-black px-2 sm:px-2.5 py-1 sm:py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer tracking-tight"
              >
                <PumpIcon className="w-3 h-3 text-black shrink-0" />
                <span>$XTV</span>
              </a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('framextv:open_donation_modal'))}
                title={`Support ${SITE_NAME} with Crypto (Click to open donation modal)`}
                aria-label={`Support ${SITE_NAME} with Crypto`}
                className="bg-black hover:bg-zinc-900 active:bg-zinc-800 text-zinc-200 px-2 sm:px-2.5 py-1 sm:py-1.5 border-x border-zinc-700/80 transition-colors cursor-pointer tracking-wider font-semibold flex items-center gap-1"
              >
                <span>{TOKEN_SHORT}</span>
              </button>
              <button
                type="button"
                onClick={copyToken}
                title="Copy Token CA"
                aria-label="Copy Token Contract Address"
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 font-bold text-[11px] sm:text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  copied
                    ? 'bg-emerald-500 text-black font-extrabold shadow-inner'
                    : 'bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileNav />
    </>
  );
}
