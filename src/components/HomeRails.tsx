import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { CirclePlay, Clock, ImageOff, Play, Trash2 } from 'lucide-react';
import { formatRemaining, removeProgress, type ProgressEntry } from '@/lib/watchProgress';
import { useHorizontalScroll, useRailScrollState, scrollRailBy } from '@/hooks/useHorizontalScroll';
import MediaCard from './MediaCard';

/**
 * The Continue Watching rail and the My List rail.
 *
 * Both are ported 1:1 from frameXTV.xyz's `HomePage` chunk. Continue Watching
 * reads `watchProgress` and offers a remove button per card; My List reads the
 * saved list and renders through `MediaCard`.
 */

function ContinueWatchingCard({ item, onRemove }: { item: ProgressEntry; onRemove: () => void }) {
  const progress = item.duration > 0 ? Math.min(100, Math.max(0, Math.round((item.timestamp / item.duration) * 100))) : 0;
  const label =
    item.mediaType === 'tv'
      ? `S${item.season || 1} · E${item.episode || 1}`
      : item.mediaType === 'anime'
        ? `Episode ${item.episode || 1}`
        : 'Movie';
  const remaining = formatRemaining(item);
  const href =
    item.mediaType === 'anime'
      ? `/watch/anime/${item.id}/${item.episode || 1}`
      : item.mediaType === 'tv'
        ? `/watch/${item.id}/${item.season || 1}/${item.episode || 1}`
        : `/watch/${item.id}`;

  return (
    <div
      data-testid="continue-watching-card"
      className="group relative flex flex-col flex-shrink-0 w-[160px] sm:w-[190px] md:w-[210px] text-left select-none focus-within:ring-2 focus-within:ring-white rounded-xl transition-all duration-200"
    >
      <Link
        to={href}
        className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md block group-hover:border-zinc-700 transition-colors"
        title={`Resume ${item.title || 'video'}`}
      >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title || 'Media poster'}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-zinc-600 bg-zinc-900">
            <ImageOff className="w-6 h-6 mb-1 opacity-50" />
            <span className="text-[10px] font-mono text-zinc-400 line-clamp-1">{item.title}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <span className="px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold tracking-wider text-zinc-300 uppercase border border-white/10 shadow-sm">
            {label}
          </span>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeProgress(item.mediaType, item.id, item.season, item.episode);
            onRemove();
          }}
          title="Remove from Continue Watching"
          aria-label="Remove from Continue Watching"
          className="absolute top-2 right-2 z-20 p-1 sm:p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-zinc-400 hover:text-white border border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform">
            <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-950/80 overflow-hidden">
          <div
            data-testid="continue-watching-progress-bar"
            className="h-full bg-rose-500 rounded-r-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Link>

      <div className="pt-2 px-0.5 space-y-0.5">
        <Link
          to={href}
          className="text-xs sm:text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors block"
          title={item.title}
        >
          {item.title || 'Untitled'}
        </Link>
        <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-zinc-400">
          <span className="text-zinc-500">{label}</span>
          {remaining && <span className="text-zinc-400 text-[10px] font-medium shrink-0">{remaining}</span>}
        </div>
      </div>
    </div>
  );
}

export function ContinueWatchingRail({
  items,
  refresh,
  className = '',
}: {
  items: ProgressEntry[];
  refresh: () => void;
  className?: string;
}) {
  const trackRef = useHorizontalScroll<HTMLDivElement>();
  const { canScrollLeft, canScrollRight } = useRailScrollState(trackRef, items.length);

  if (items.length === 0) return null;

  return (
    <section data-testid="continue-watching-row" className={`space-y-2.5 py-3 ${className}`}>
      <div className="flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <CirclePlay className="w-4 h-4 text-rose-500" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">Continue Watching</h3>
            <Link to="/history" className="text-xs text-zinc-400 hover:text-white transition-colors font-medium ml-1">
              History →
            </Link>
          </div>
          <p className="text-xs text-zinc-400">Pick up right where you left off</p>
        </div>
        <div className="hidden md:flex items-center space-x-1">
          <button
            type="button"
            onClick={() => scrollRailBy(trackRef, 'left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className={`w-7 h-7 rounded-md border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer ${
              canScrollLeft
                ? 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white'
                : 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-40'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollRailBy(trackRef, 'right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className={`w-7 h-7 rounded-md border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer ${
              canScrollRight
                ? 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white'
                : 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-40'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div ref={trackRef} className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 -mx-1 scroll-touch">
        {items.map((item) => (
          <ContinueWatchingCard
            key={`${item.mediaType}-${item.id}-${item.season || 1}-${item.episode || 1}`}
            item={item}
            onRemove={refresh}
          />
        ))}
      </div>
    </section>
  );
}

export function MyListRail({
  items,
  className = '',
}: {
  items: { mediaType: string; id: string; title: string; poster?: string; year?: string }[];
  className?: string;
}) {
  const trackRef = useHorizontalScroll<HTMLDivElement>();
  const { canScrollLeft, canScrollRight } = useRailScrollState(trackRef, items.length);

  if (items.length === 0) return null;

  return (
    <section data-testid="home-my-list-row" className={`relative w-full space-y-3 group ${className}`}>
      <div className="flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              <span>My List</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-semibold text-zinc-400">
              {items.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono">Titles saved for later</p>
        </div>
        <Link
          to="/my-list"
          data-testid="my-list-view-all-link"
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          View all
        </Link>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollRailBy(trackRef, 'left')}
            aria-label="Scroll left"
            className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-zinc-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 shadow-xl cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <div ref={trackRef} className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 scroll-touch">
          {items.map((entry) => (
            <MediaCard
              key={`home-list-${entry.mediaType}-${entry.id}`}
              id={entry.id}
              type={entry.mediaType}
              title={entry.title}
              poster={entry.poster}
              year={entry.year}
              anilistId={entry.mediaType === 'anime' ? entry.id : undefined}
            />
          ))}
        </div>
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollRailBy(trackRef, 'right')}
            aria-label="Scroll right"
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-zinc-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 shadow-xl cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
