import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, ImageOff, Play } from 'lucide-react';
import { mediaId } from '@/lib/id';
import { useMeta } from '@/hooks/useApiQueries';
import { useIsInMyList, toggleMyList } from '@/lib/watchlist';
import type { MediaType } from '@/lib/api';

/**
 * The poster card used by every rail, grid and search result.
 *
 * Ported 1:1 from frameXTV.xyz's `MediaCard` chunk — same markup, same Tailwind
 * classes, same hover/focus behaviour, same `/api/meta` backfill for the title
 * and year, and same My List toggle.
 */

export interface MediaCardProps {
  id: string;
  title: string;
  type?: string;
  year?: string;
  poster?: string;
  rating?: string;
  season?: number;
  episode?: number;
  anilistId?: string;
  episodeCount?: number;
  className?: string;
  /** Skip the detail page and link straight to the player. */
  directPlay?: boolean;
}

export default function MediaCard({
  id,
  title,
  type,
  year,
  poster,
  rating,
  season,
  episode,
  anilistId,
  episodeCount,
  className = '',
  directPlay = false,
}: MediaCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const resolvedAniListId = anilistId || (type === 'anime' ? id : undefined);
  const mediaType: MediaType = resolvedAniListId || type === 'anime' ? 'anime' : type === 'tv' ? 'tv' : 'movie';
  const watchlistId = resolvedAniListId || id;

  const isSaved = useIsInMyList(mediaType, watchlistId);

  // Only films and series have a `/api/meta` record; anime ids are AniList ids
  // the TMDB-backed endpoint does not know, and a card that already carries a
  // poster does not need the round trip.
  const meta = useMeta(id, type === 'tv' ? 'tv' : 'movie', season || 1, episode || 1, !poster && type !== 'anime');

  const displayTitle = meta.data?.title?.replace(/\s*\(\d{4}\).*$/, '') || title;
  const displayYear = meta.data?.year || year;
  const displayPoster = meta.data?.poster || poster;

  const slug = mediaId(id);
  const detailPath = resolvedAniListId
    ? `/anime/${resolvedAniListId}`
    : type === 'tv'
      ? `/tv/${id}`
      : `/movie/${slug}`;
  const watchPath = resolvedAniListId
    ? `/watch/anime/${resolvedAniListId}`
    : type === 'tv'
      ? `/watch/${id}/${season || 1}/${episode || 1}`
      : `/watch/${slug}`;
  const href = directPlay ? watchPath : detailPath;

  const widthClass = className.includes('w-full')
    ? 'w-full'
    : 'w-[130px] xs:w-[148px] sm:w-[165px] md:w-[185px] lg:w-[195px] flex-shrink-0';

  const onToggleWatchlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMyList({
      mediaType,
      id: watchlistId,
      title: displayTitle,
      poster: displayPoster,
      year: displayYear,
    });
  };

  return (
    <Link
      to={href}
      data-testid="media-card"
      data-media-id={watchlistId}
      data-media-type={mediaType}
      className={`group/card relative flex flex-col ${widthClass} text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 rounded-lg transition-transform duration-200 sm:active:scale-[0.98] ${className}`}
      title={`View ${displayTitle} Details`}
    >
      <div className="media-surface relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06] group-hover/card:border-white/[0.15] shadow-md transition-colors">
        {displayPoster && !errored ? (
          <>
            <img
              src={displayPoster}
              alt={displayTitle}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={`w-full h-full object-cover transition-all duration-300 group-hover/card:scale-[1.03] group-hover/card:brightness-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {!loaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-zinc-600 bg-zinc-900">
            <ImageOff className="w-8 h-8 mb-1.5 opacity-60" />
            <span className="text-[10px] font-mono text-zinc-500 line-clamp-2">{displayTitle}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <span className="px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold tracking-wider text-zinc-300 uppercase border border-white/10 shadow-sm">
            {resolvedAniListId || type === 'anime' ? 'ANIME' : type === 'tv' ? 'TV' : 'MOVIE'}
          </span>
        </div>

        {rating && (
          <div className="absolute top-2 right-2 z-10">
            <span className="px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold text-amber-400 border border-white/10 shadow-sm">
              ★ {rating}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-1 group-hover/card:translate-y-0 group-focus-within/card:translate-y-0 transition-transform duration-200">
            <Play className="w-4 h-4 fill-black ml-0.5" />
          </div>
        </div>

        <button
          type="button"
          data-testid="card-watchlist-btn"
          onClick={onToggleWatchlist}
          aria-label={isSaved ? `Remove ${displayTitle} from My List` : `Add ${displayTitle} to My List`}
          title={isSaved ? 'In My List' : 'Add to My List'}
          className={`absolute bottom-2 right-2 z-20 p-1.5 sm:p-2 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-full transition-all cursor-pointer shadow-md active:scale-90 ${
            isSaved
              ? 'bg-rose-500 text-white opacity-100'
              : 'bg-zinc-950/90 text-zinc-300 hover:text-white hover:bg-black border border-white/15 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
        </button>
      </div>

      <div className="pt-2 space-y-0.5 px-0.5">
        <h4 className="text-xs sm:text-sm font-semibold text-zinc-200 truncate group-hover/card:text-white transition-colors">
          {displayTitle}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
          {displayYear && <span>{displayYear}</span>}
          {displayYear && <span>•</span>}
          <span className="capitalize">
            {resolvedAniListId || type === 'anime' ? 'Anime' : type === 'tv' ? 'Series' : 'Film'}
          </span>
          {season && episode ? (
            <>
              <span>•</span>
              <span>
                S{season}E{episode}
              </span>
            </>
          ) : episodeCount ? (
            <>
              <span>•</span>
              <span>{episodeCount} eps</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
