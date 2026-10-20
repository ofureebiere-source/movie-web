import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';

/**
 * The episode strip under the player.
 *
 * Ported 1:1 from frameXTV.xyz's `EpisodeNav` (the `ge` component in its
 * `WatchPage` chunk): a Previous link, the season/episode label that opens the
 * episode drawer, a Next link, an optional autoplay switch and an optional
 * "Up Next" hint. The disabled branches keep the reference's markup so the
 * strip does not shift when a neighbour is missing.
 */
export default function EpisodeNav({
  mediaType,
  currentSeason,
  currentEpisode,
  totalEpisodes,
  prevUrl,
  nextUrl,
  nextEpisodeLabel,
  onOpenSelector,
  isAutoplayEnabled = true,
  onToggleAutoplay,
}: {
  mediaType: 'tv' | 'anime';
  currentSeason?: number;
  currentEpisode: number;
  totalEpisodes?: number;
  prevUrl?: string | null;
  nextUrl?: string | null;
  nextEpisodeLabel?: string | null;
  onOpenSelector: () => void;
  isAutoplayEnabled?: boolean;
  onToggleAutoplay?: () => void;
}) {
  const label =
    mediaType === 'tv'
      ? `Season ${currentSeason || 1} • Episode ${currentEpisode}`
      : `Episode ${currentEpisode}${totalEpisodes ? ` of ${totalEpisodes}` : ''}`;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-950/60 border border-white/[0.05] shadow-md">
        <div className="flex items-center justify-between sm:justify-start gap-1.5 xs:gap-2 w-full sm:w-auto">
          {prevUrl ? (
            <Link
              to={prevUrl}
              data-testid="watch-prev-btn"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 xs:px-3.5 py-2.5 min-h-[40px] rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-white/[0.06] hover:border-white/[0.12] text-xs font-semibold text-zinc-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm select-none"
              title="Previous Episode"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
              <span>Previous</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid="watch-prev-btn"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 xs:px-3.5 py-2.5 min-h-[40px] rounded-xl bg-zinc-900/30 border border-white/[0.03] text-xs font-semibold text-zinc-600 cursor-not-allowed select-none"
              title="First Episode"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-700" />
              <span>Previous</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSelector}
            data-testid="watch-selector-btn"
            className="flex-2 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 xs:px-4 py-2.5 min-h-[40px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.08] hover:border-white/[0.15] text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-sm select-none"
            title="Browse all episodes"
          >
            <ListFilter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate max-w-[110px] xs:max-w-[150px] sm:max-w-none">{label}</span>
          </button>

          {nextUrl ? (
            <Link
              to={nextUrl}
              data-testid="watch-next-btn"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 xs:px-4 py-2.5 min-h-[40px] rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm select-none"
              title="Next Episode"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 fill-black" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid="watch-next-btn"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 xs:px-4 py-2.5 min-h-[40px] rounded-xl bg-zinc-900/30 border border-white/[0.03] text-xs font-semibold text-zinc-600 cursor-not-allowed select-none"
              title="Final Episode"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 text-zinc-700" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          {onToggleAutoplay && (
            <button
              type="button"
              data-testid="watch-autoplay-toggle"
              onClick={onToggleAutoplay}
              title={
                isAutoplayEnabled
                  ? 'Autoplay next episode is enabled (click to disable)'
                  : 'Autoplay next episode is disabled (click to enable)'
              }
              aria-label={isAutoplayEnabled ? 'Disable autoplay' : 'Enable autoplay'}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm ${
                isAutoplayEnabled
                  ? 'bg-zinc-900/90 border-white/[0.12] text-zinc-200 hover:text-white'
                  : 'bg-zinc-900/40 border-white/[0.04] text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-[11px] font-mono font-medium">Autoplay</span>
              <div className={`w-7 h-4 rounded-full transition-colors relative p-0.5 ${isAutoplayEnabled ? 'bg-rose-600' : 'bg-zinc-800'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isAutoplayEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
              </div>
            </button>
          )}

          {nextEpisodeLabel && (
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-zinc-400 truncate max-w-sm">
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">Up Next:</span>
              <span className="text-zinc-300 truncate">{nextEpisodeLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
