import { Link } from 'react-router-dom';
import { Info, Play } from 'lucide-react';
import { mediaId } from '@/lib/id';
import type { FxItem } from '@/lib/api';

/**
 * The featured banner at the top of the home page.
 *
 * Ported 1:1 from frameXTV.xyz's `Hero` chunk, including its loading skeleton.
 * The Watch Now / Details targets follow the reference's id rules: anime goes
 * to `/watch/anime/{anilistId}` and `/anime/{anilistId}`, series to
 * `/watch/{id}/{season}/{episode}` and `/tv/{id}`, films to `/watch/{id}` and
 * `/movie/{id}`.
 */

export default function Hero({ item, isLoading = false }: { item?: FxItem | null; isLoading?: boolean }) {
  if (isLoading || !item) {
    return (
      <div className="relative w-full h-[50vh] sm:h-[48vh] md:h-[46vh] min-h-[380px] sm:min-h-[420px] max-h-[500px] overflow-hidden bg-zinc-950 select-none border-b border-zinc-900/60">
        <div className="absolute inset-0 bg-zinc-900/40 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-8 sm:pb-10 space-y-3 sm:space-y-4">
          <div className="h-4 w-28 bg-zinc-850 rounded animate-pulse" />
          <div className="h-10 sm:h-12 w-80 max-w-[85vw] bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-3.5 w-48 bg-zinc-850 rounded animate-pulse" />
          <div className="h-8 w-64 max-w-[70vw] bg-zinc-850/60 rounded animate-pulse" />
          <div className="flex items-center gap-3 pt-1">
            <div className="h-10 w-32 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-10 w-28 bg-zinc-850 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const isAnime = item.type === 'anime' || Boolean(item.anilistId);
  const isTv = item.type === 'tv';
  const slug = mediaId(item.id);
  const watchPath = item.anilistId
    ? `/watch/anime/${item.anilistId}`
    : isAnime
      ? `/watch/anime/${item.id}`
      : isTv
        ? `/watch/${item.id}/${item.season || 1}/${item.episode || 1}`
        : `/watch/${slug}`;
  const detailPath = item.anilistId
    ? `/anime/${item.anilistId}`
    : isAnime
      ? `/anime/${item.id}`
      : isTv
        ? `/tv/${item.id}`
        : `/movie/${slug}`;
  const backdrop = item.backdrop || item.poster;
  const overview = item.overview || item.synopsis;

  return (
    <div className="relative w-full h-[50vh] sm:h-[48vh] md:h-[46vh] min-h-[380px] sm:min-h-[420px] max-h-[500px] overflow-hidden bg-black select-none border-b border-zinc-900/60">
      {backdrop && (
        <div className="absolute inset-0">
          <img
            src={backdrop}
            alt={item.title}
            className="w-full h-full object-cover object-center opacity-70 filter contrast-105 transition-opacity duration-700"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-8 sm:pb-10 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-md text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-300 border border-white/10">
            Featured {isAnime ? 'Anime' : isTv ? 'Series' : 'Film'}
          </span>
          {item.rating && (
            <span className="text-[11px] font-mono font-semibold text-amber-400">★ {item.rating}</span>
          )}
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl drop-shadow-md">
          {item.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-300">
          {item.year && <span>{item.year}</span>}
          {item.year && <span>•</span>}
          <span className="capitalize">{isAnime ? 'Anime' : isTv ? 'TV Series' : 'Movie'}</span>
          {item.genres && item.genres.length > 0 && (
            <>
              <span>•</span>
              <span>{item.genres.slice(0, 3).join(' / ')}</span>
            </>
          )}
        </div>
        {overview && (
          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 sm:line-clamp-3 max-w-xl leading-relaxed">
            {overview}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
          <Link
            to={watchPath}
            className="inline-flex items-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-md active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Watch Now</span>
          </Link>
          <Link
            to={detailPath}
            className="inline-flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium transition-all backdrop-blur-sm active:scale-[0.98]"
          >
            <Info className="w-4 h-4" />
            <span>Details</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
