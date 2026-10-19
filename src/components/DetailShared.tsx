import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ImageOff,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  User,
  Video,
  X,
} from 'lucide-react';
import MediaCard from './MediaCard';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { getReleaseState } from '@/lib/releaseState';
import { isUnavailable } from '@/lib/id';
import type { FxCastMember, FxDetail, FxItem, FxVideo } from '@/lib/api';

/**
 * The detail-page furniture shared by movies, series and anime.
 *
 * Ported 1:1 from frameXTV.xyz's `DetailsError` chunk: the trailer modal, the
 * backdropped hero with its status/rating pills and Play / Add to My List /
 * Watch Trailer actions, the cast rail, the recommendations rail, the loading
 * skeleton and the error card.
 */

/** YouTube trailer, in a modal (the reference uses `youtube-nocookie`). */
export function TrailerModal({
  video,
  isOpen,
  onClose,
  title,
}: {
  video?: FxVideo;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => closeRef.current?.focus(), 50);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !video || !video.key) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} Trailer` : 'Media Trailer'}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-850 bg-zinc-900/60">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
              {video.name || `${title || 'Title'} Official Trailer`}
            </h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close trailer"
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&modestbranding=1`}
            title={video.name || 'Official Trailer'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

/** `142` → `2h 22m`. */
function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h`;
  return `${rest}m`;
}

/** The title's own trailer, preferring an official YouTube trailer, then teaser, then anything. */
function pickTrailer(videos: FxVideo[]): FxVideo | undefined {
  const isTrailerish = (v: FxVideo) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser');
  return (
    videos.find((v) => isTrailerish(v) && (v as { official?: boolean }).official) ||
    videos.find(isTrailerish) ||
    videos[0]
  );
}

export interface DetailHeroProps {
  detail: FxDetail;
  playUrl: string;
  playLabel?: string;
  resumeSubtitle?: string;
  isSaved?: boolean;
  onToggleWatchlist?: () => void;
}

export function DetailHero({
  detail,
  playUrl,
  playLabel = 'Watch Now',
  resumeSubtitle,
  isSaved = false,
  onToggleWatchlist,
}: DetailHeroProps) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterErrored, setPosterErrored] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const { isReleased } = getReleaseState({
    mediaType: detail.type,
    releaseDate: detail.releaseDate,
    status: detail.status,
  });

  const videos = detail.videos || [];
  const trailer = pickTrailer(videos);
  const runtimeLabel = formatRuntime(detail.runtime);
  const typeLabel = detail.type === 'anime' ? 'Anime' : detail.type === 'tv' ? 'TV Series' : 'Movie';

  return (
    <div className="relative w-full overflow-hidden bg-black text-white">
      {detail.backdrop && (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-35">
          <img
            src={detail.backdrop}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover filter blur-3xl scale-110 transform translate-y-[-10%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-8 sm:pb-12 z-10">
        <div className="flex flex-col md:flex-row items-start gap-6 sm:gap-8 lg:gap-10">
          <div className="w-40 sm:w-52 md:w-60 lg:w-72 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shrink-0 mx-auto md:mx-0 relative">
            {detail.poster && !posterErrored ? (
              <>
                <img
                  src={detail.poster}
                  alt={detail.title}
                  onLoad={() => setPosterLoaded(true)}
                  onError={() => setPosterErrored(true)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                {!posterLoaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-zinc-600 bg-zinc-900">
                <ImageOff className="w-10 h-10 mb-2 opacity-50" />
                <span className="text-[11px] font-mono text-zinc-500 line-clamp-2">{detail.title}</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 text-left w-full">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold tracking-wider text-zinc-300 uppercase">
                {typeLabel}
              </span>
              {detail.year && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {detail.year}
                </span>
              )}
              {detail.rating && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{detail.rating}</span>
                </span>
              )}
              {runtimeLabel && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {runtimeLabel}
                </span>
              )}
              {detail.status && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>{detail.status}</span>
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {detail.title}
              </h1>
              {detail.originalTitle && detail.originalTitle !== detail.title && (
                <p className="text-xs sm:text-sm font-mono text-zinc-400">
                  Original: <span className="text-zinc-300">{detail.originalTitle}</span>
                </p>
              )}
              {detail.tagline && (
                <p className="text-xs sm:text-sm italic text-zinc-400 font-serif pt-0.5">“{detail.tagline}”</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {(detail.genres || []).map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-300"
                >
                  {genre}
                </span>
              ))}
              {detail.studios && detail.studios.length > 0 && (
                <span className="text-[11px] font-mono text-zinc-500 ml-1">by {detail.studios.join(', ')}</span>
              )}
            </div>

            {detail.overview && (
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl pt-1">{detail.overview}</p>
            )}

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2 w-full">
              <div className="relative inline-flex flex-col gap-1 group/unreleased w-full xs:w-auto">
                {isReleased ? (
                  <Link
                    to={playUrl}
                    data-testid="detail-play-btn"
                    className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-[0.98] cursor-pointer w-full xs:w-auto"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>{playLabel}</span>
                  </Link>
                ) : (
                  <div className="relative inline-flex group/btn w-full xs:w-auto">
                    <button
                      type="button"
                      data-testid="detail-play-btn"
                      aria-disabled="true"
                      tabIndex={0}
                      aria-describedby="unreleased-play-tooltip"
                      title="Not released yet"
                      onMouseEnter={() => setTooltipOpen(true)}
                      onMouseLeave={() => setTooltipOpen(false)}
                      onFocus={() => setTooltipOpen(true)}
                      onBlur={() => setTooltipOpen(false)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setTooltipOpen((prev) => !prev);
                      }}
                      className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-800/90 border border-zinc-750 text-zinc-400 cursor-not-allowed select-none transition-all shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 w-full xs:w-auto"
                    >
                      <Play className="w-4 h-4 fill-zinc-500 text-zinc-500" />
                      <span>{playLabel}</span>
                    </button>
                    <div
                      id="unreleased-play-tooltip"
                      role="tooltip"
                      data-testid="unreleased-tooltip"
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-900/95 backdrop-blur-md border border-zinc-700 text-xs font-semibold text-zinc-200 shadow-2xl whitespace-nowrap z-30 pointer-events-none transition-all duration-150 group-hover/btn:opacity-100 group-hover/btn:visible group-focus-within/btn:opacity-100 group-focus-within/btn:visible ${tooltipOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                    >
                      <span>Not released yet</span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
                    </div>
                  </div>
                )}
                {resumeSubtitle && isReleased && (
                  <span data-testid="detail-resume-subtitle" className="text-[11px] font-mono text-zinc-400 pl-0.5">
                    {resumeSubtitle}
                  </span>
                )}
              </div>

              {onToggleWatchlist && (
                <button
                  type="button"
                  data-testid="detail-watchlist-btn"
                  onClick={onToggleWatchlist}
                  className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all active:scale-[0.98] cursor-pointer self-stretch xs:self-start w-full xs:w-auto ${
                    isSaved
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
                  }`}
                  aria-label={isSaved ? `Remove ${detail.title} from My List` : `Add ${detail.title} to My List`}
                >
                  <Star className={`w-4 h-4 ${isSaved ? 'fill-rose-400 text-rose-400' : 'text-zinc-400'}`} />
                  <span>{isSaved ? 'In My List' : 'Add to My List'}</span>
                </button>
              )}

              {trailer && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium transition-all active:scale-[0.98] cursor-pointer self-stretch xs:self-start w-full xs:w-auto"
                >
                  <Video className="w-4 h-4" />
                  <span>Watch Trailer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {trailer && (
        <TrailerModal video={trailer} isOpen={trailerOpen} onClose={() => setTrailerOpen(false)} title={detail.title} />
      )}
    </div>
  );
}

function CastMemberCard({ member }: { member: FxCastMember }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <div className="flex-shrink-0 w-24 sm:w-28 text-left group">
      <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shadow-sm mb-2">
        {member.profile && !errored ? (
          <>
            <img
              src={member.profile}
              alt={member.name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {!loaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
            <User className="w-6 h-6 sm:w-8 sm:h-8 opacity-60" />
          </div>
        )}
      </div>
      <h5 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
        {member.name}
      </h5>
      {member.character && <p className="text-[11px] font-mono text-zinc-400 truncate">{member.character}</p>}
    </div>
  );
}

export function CastSection({ cast, title = 'Cast & Characters' }: { cast: FxCastMember[]; title?: string }) {
  const trackRef = useHorizontalScroll<HTMLDivElement>();
  if (!cast || cast.length === 0) return null;
  const shown = cast.slice(0, 12);
  return (
    <section className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
        <span className="text-[11px] font-mono text-zinc-400">{shown.length} members</span>
      </div>
      <div ref={trackRef} className="flex items-start gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x focus:outline-none">
        {shown.map((member, index) => (
          <div key={`${member.id}-${index}`} className="snap-start">
            <CastMemberCard member={member} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecommendationsSection({ items, title = 'More Like This' }: { items: FxItem[]; title?: string }) {
  const trackRef = useHorizontalScroll<HTMLDivElement>();
  if (!items || items.length === 0) return null;
  const shown = items.filter((item) => Boolean(item.id && item.title && !isUnavailable(item.id))).slice(0, 10);
  if (shown.length === 0) return null;
  return (
    <section className="space-y-3.5 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
        <span className="text-[11px] font-mono text-zinc-400">{shown.length} recommendations</span>
      </div>
      <div ref={trackRef} className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-none snap-x focus:outline-none">
        {shown.map((item) => (
          <div key={item.id} className="snap-start flex-shrink-0">
            <MediaCard
              id={item.id}
              title={item.title}
              type={item.type}
              year={item.year}
              poster={item.poster || item.image}
              rating={item.rating}
              anilistId={item.anilistId}
              episodeCount={item.episodeCount}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The full-page detail skeleton. */
export function DetailSkeleton() {
  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col animate-pulse select-none">
      <div className="w-full bg-zinc-950 border-b border-zinc-900 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start gap-6 lg:gap-10">
          <div className="shrink-0 w-36 sm:w-48 lg:w-56 aspect-[2/3] rounded-xl bg-zinc-900 border border-zinc-850 mx-auto md:mx-0" />
          <div className="flex-1 space-y-4 w-full text-left">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 rounded-full bg-zinc-900" />
              <div className="h-5 w-14 rounded-full bg-zinc-900" />
              <div className="h-5 w-16 rounded-full bg-zinc-900" />
            </div>
            <div className="h-8 sm:h-12 w-3/4 max-w-md rounded-lg bg-zinc-900" />
            <div className="h-4 w-1/3 rounded bg-zinc-900/80" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-5 w-16 rounded bg-zinc-900" />
              <div className="h-5 w-16 rounded bg-zinc-900" />
              <div className="h-5 w-16 rounded bg-zinc-900" />
            </div>
            <div className="space-y-2 pt-2 max-w-2xl">
              <div className="h-3 w-full rounded bg-zinc-900/80" />
              <div className="h-3 w-5/6 rounded bg-zinc-900/80" />
              <div className="h-3 w-4/6 rounded bg-zinc-900/80" />
            </div>
            <div className="flex items-center gap-3 pt-3">
              <div className="h-10 w-32 rounded-xl bg-zinc-900" />
              <div className="h-10 w-28 rounded-xl bg-zinc-900/60" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="space-y-3">
          <div className="h-5 w-32 rounded bg-zinc-900" />
          <div className="flex items-center gap-3 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <div key={key} className="w-24 sm:w-28 flex-shrink-0 space-y-2">
                <div className="aspect-[3/4] w-full rounded-lg bg-zinc-900 border border-zinc-850" />
                <div className="h-3 w-20 rounded bg-zinc-900" />
                <div className="h-2.5 w-14 rounded bg-zinc-900/60" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-zinc-900" />
          <div className="h-24 w-full rounded-xl bg-zinc-950 border border-zinc-900" />
          <div className="h-24 w-full rounded-xl bg-zinc-950 border border-zinc-900" />
        </div>
      </div>
    </div>
  );
}

export function DetailsError({
  title = 'Title Unavailable',
  message = 'We could not locate this title in our catalog. It may have been removed or is temporarily unavailable.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          )}
          <Link
            to="/search"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Catalog</span>
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
