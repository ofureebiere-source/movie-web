import { Link } from 'react-router-dom';
import { ArrowLeft, Bookmark, Film, Keyboard, Sparkles, Tv } from 'lucide-react';
import type { MediaType } from '@/lib/api';

/**
 * The sticky bar above the player.
 *
 * Ported 1:1 from frameXTV.xyz's `WatchHeader` (the `pe` component in its
 * `WatchPage` chunk): a back link, the title with a media-type badge, the
 * season/episode line, then the My List, Theater Mode and Shortcuts controls.
 */
export default function WatchHeader({
  mediaType,
  title,
  year,
  genres = [],
  season,
  episode,
  episodeName,
  backUrl,
  backLabel,
  isTheaterMode = false,
  onToggleTheater,
  onOpenShortcuts,
  isSaved = false,
  onToggleWatchlist,
}: {
  mediaType: MediaType;
  title: string;
  year?: string;
  genres?: string[];
  season?: number;
  episode?: number;
  episodeName?: string;
  backUrl: string;
  backLabel?: string;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  onOpenShortcuts?: () => void;
  isSaved?: boolean;
  onToggleWatchlist?: () => void;
}) {
  const label =
    backLabel || `Back to ${mediaType === 'movie' ? 'Details' : mediaType === 'tv' ? 'Series' : 'Anime'}`;

  return (
    <header
      data-testid="watch-header"
      className="w-full bg-zinc-950/95 border-b border-white/[0.05] backdrop-blur-md relative z-20"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <Link
            to={backUrl}
            data-testid="watch-back-btn"
            className="group flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium transition-all active:scale-95 shadow-sm"
            title={label}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md md:max-w-xl">
                {title}
              </h1>
              {mediaType === 'anime' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>Anime</span>
                </span>
              ) : mediaType === 'tv' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                  <Tv className="w-3 h-3 text-indigo-400" />
                  <span>TV Series</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-white/[0.08] text-[10px] font-mono text-zinc-300 uppercase tracking-wider">
                  <Film className="w-3 h-3 text-zinc-400" />
                  <span>Movie</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 truncate">
              {mediaType === 'tv' && (
                <>
                  <span className="text-zinc-300 font-semibold">
                    S{season || 1} · E{episode || 1}
                  </span>
                  {episodeName && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 truncate max-w-[140px] sm:max-w-xs">{episodeName}</span>
                    </>
                  )}
                </>
              )}
              {mediaType === 'anime' && (
                <>
                  <span className="text-zinc-300 font-semibold">Episode {episode || 1}</span>
                  {episodeName && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 truncate max-w-[140px] sm:max-w-xs">{episodeName}</span>
                    </>
                  )}
                </>
              )}
              {mediaType === 'movie' && (
                <>
                  {year && <span>{year}</span>}
                  {genres.length > 0 && (
                    <>
                      {year && <span className="text-zinc-600">•</span>}
                      <span className="truncate">{genres.slice(0, 2).join(' / ')}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-right flex-shrink-0">
          {onToggleWatchlist && (
            <button
              type="button"
              data-testid="watch-watchlist-btn"
              onClick={onToggleWatchlist}
              title={isSaved ? 'Remove from My List' : 'Add to My List'}
              aria-label={isSaved ? 'Remove from My List' : 'Add to My List'}
              className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 min-w-[32px] min-h-[32px] rounded-lg border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 border-white/[0.06] text-zinc-300 hover:text-white'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-400' : ''}`} />
              <span className="hidden md:inline">{isSaved ? 'In List' : 'Add to List'}</span>
            </button>
          )}

          {onToggleTheater && (
            <button
              type="button"
              data-testid="theater-toggle-btn"
              onClick={onToggleTheater}
              title={isTheaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
              aria-label={isTheaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
              className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 min-w-[32px] min-h-[32px] rounded-lg border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                isTheaterMode
                  ? 'bg-white text-black border-white font-bold shadow-sm'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 border-white/[0.06] text-zinc-300 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isTheaterMode ? 'Exit Theater' : 'Theater'}</span>
            </button>
          )}

          {onOpenShortcuts && (
            <button
              type="button"
              data-testid="shortcuts-trigger-btn"
              onClick={onOpenShortcuts}
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
              className="p-1.5 sm:px-2 sm:py-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
