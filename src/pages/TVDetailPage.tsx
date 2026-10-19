import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, ImageOff, Play, Star } from 'lucide-react';
import { CastSection, DetailHero, DetailSkeleton, DetailsError, RecommendationsSection } from '@/components/DetailShared';
import SeasonSelector from '@/components/SeasonSelector';
import { useDetails, useSeason } from '@/hooks/useApiQueries';
import { extractId, isUnavailable, mediaId } from '@/lib/id';
import { getReleaseState } from '@/lib/releaseState';
import { formatRemaining, formatTime, getLatestForTitle } from '@/lib/watchProgress';
import { useIsInMyList, toggleMyList } from '@/lib/watchlist';
import { SITE_NAME } from '@/lib/brand';
import NotFoundPage from './NotFoundPage';
import type { FxEpisode } from '@/lib/api';

/**
 * A series' detail page.
 *
 * Ported 1:1 from frameXTV.xyz's `TVDetailPage`: the season is a `?season=`
 * query param, the episode list refetches per season, each episode card shows
 * its still, runtime, air date and rating, and an episode whose air date is in
 * the future renders a disabled Play with a "Not released yet" tooltip.
 */

function EpisodeCard({ tvId, seasonNumber, episode }: { tvId: string; seasonNumber: number; episode: FxEpisode }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const watchUrl = `/watch/${tvId}/${seasonNumber}/${episode.number}`;
  const embedUrl = `/embed/tv/${tvId}/${seasonNumber}/${episode.number}`;
  const unavailable = isUnavailable(watchUrl) || isUnavailable(embedUrl);
  const released = !unavailable && getReleaseState({ mediaType: 'tv', episodeAirDate: episode.airDate }).isReleased;

  return (
    <div className="group flex flex-col sm:flex-row items-start gap-4 p-3 sm:p-4 rounded-xl bg-zinc-950/60 hover:bg-zinc-900/80 border border-zinc-850 hover:border-zinc-800 transition-all text-left">
      {released ? (
        <Link
          to={watchUrl}
          className="relative flex-shrink-0 w-full sm:w-44 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shadow-sm cursor-pointer block"
        >
          {episode.still && !errored ? (
            <>
              <img
                src={episode.still}
                alt={episode.name}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!loaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900">
              <ImageOff className="w-6 h-6 opacity-40 mb-1" />
              <span className="text-[10px] font-mono text-zinc-400">Episode {episode.number}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-md">
              <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
            </div>
          </div>
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold text-white border border-white/10 shadow-sm">
            EP {episode.number}
          </div>
        </Link>
      ) : (
        <div
          className="relative flex-shrink-0 w-full sm:w-44 aspect-video rounded-lg overflow-hidden bg-zinc-900/80 border border-zinc-850 shadow-sm cursor-not-allowed block opacity-75"
          title="Not released yet"
        >
          {episode.still && !errored ? (
            <img
              src={episode.still}
              alt={episode.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className="w-full h-full object-cover grayscale opacity-50"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900">
              <ImageOff className="w-6 h-6 opacity-30 mb-1" />
              <span className="text-[10px] font-mono text-zinc-500">Episode {episode.number}</span>
            </div>
          )}
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold text-zinc-400 border border-white/10 shadow-sm">
            {unavailable ? 'UNAVAILABLE' : `EP ${episode.number}`}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-1.5 min-w-0 w-full">
        <div className="flex items-start justify-between gap-2">
          {released ? (
            <Link
              to={watchUrl}
              className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-white transition-colors truncate"
            >
              {episode.number}. {episode.name || `Episode ${episode.number}`}
            </Link>
          ) : (
            <span className="text-xs sm:text-sm font-bold text-zinc-400 truncate">
              {episode.number}. {episode.name || `Episode ${episode.number}`}
            </span>
          )}
          {unavailable ? (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-red-950/60 border border-red-800/40 text-red-400">
              Unavailable
            </span>
          ) : released ? (
            <Link
              to={watchUrl}
              className="shrink-0 inline-flex items-center space-x-1 px-3 py-1.5 min-h-[32px] rounded-md bg-white hover:bg-zinc-200 text-black text-[11px] font-bold transition-all shadow-sm active:scale-95"
            >
              <Play className="w-3 h-3 fill-black" />
              <span>Play</span>
            </Link>
          ) : (
            <div className="relative group/ep-tooltip shrink-0">
              <button
                type="button"
                aria-disabled="true"
                tabIndex={0}
                title="Not released yet"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 min-h-[32px] rounded-md bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-500 text-[11px] font-bold cursor-not-allowed select-none transition-all"
              >
                <Play className="w-3 h-3 fill-zinc-600 text-zinc-600" />
                <span>Play</span>
              </button>
              <div
                role="tooltip"
                className="absolute bottom-full right-0 mb-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-medium text-zinc-300 shadow-xl whitespace-nowrap z-20 pointer-events-none opacity-0 group-hover/ep-tooltip:opacity-100 group-focus-within/ep-tooltip:opacity-100 transition-opacity"
              >
                Not released yet
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
          {episode.runtime ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{episode.runtime}m</span>
            </span>
          ) : null}
          {episode.airDate ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span>{episode.airDate}</span>
            </span>
          ) : null}
          {episode.rating ? (
            <span className="flex items-center gap-1 text-amber-400">
              <Star className="w-3 h-3 fill-amber-400" />
              <span>{episode.rating}</span>
            </span>
          ) : null}
        </div>

        {episode.overview && (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed pt-0.5">{episode.overview}</p>
        )}
      </div>
    </div>
  );
}

export default function TVDetailPage() {
  const { id, tmdbId } = useParams();
  const [params, setParams] = useSearchParams();
  const raw = id || tmdbId;
  const clean = mediaId(raw);

  const unavailable = Boolean(clean) && isUnavailable(clean, 'tv');
  const { data: detail, isLoading, isError, error, refetch } = useDetails(clean, 'tv', Boolean(clean) && !unavailable);

  const seasonParam = parseInt(params.get('season') || '1', 10);
  const activeSeason = Number.isNaN(seasonParam) || seasonParam < 0 ? 1 : seasonParam;

  const { data: episodes, isLoading: episodesLoading } = useSeason(clean, activeSeason, Boolean(detail) && !unavailable);

  useEffect(() => {
    if (detail?.title) {
      document.title = `${detail.title} ${detail.year ? `(${detail.year}) ` : ''}— ${SITE_NAME}`;
    }
  }, [detail?.title, detail?.year]);

  const isSaved = useIsInMyList('tv', clean);

  if (unavailable) return <NotFoundPage />;
  if (isLoading) return <DetailSkeleton />;
  if (isError || !detail || !clean) {
    return (
      <DetailsError
        title="TV Show Not Found"
        message={error instanceof Error ? error.message : 'The requested TV series could not be loaded.'}
        onRetry={() => refetch()}
      />
    );
  }

  const selectSeason = (season: number) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('season', String(season));
        return next;
      },
      { replace: true }
    );
  };

  const progress = getLatestForTitle('tv', clean);
  const canResume = Boolean(progress && !progress.completed && progress.timestamp > 15);
  const playUrl = canResume
    ? `/watch/${clean}/${progress!.season || 1}/${progress!.episode || 1}`
    : `/watch/${clean}/${activeSeason}/1`;
  const playLabel = canResume ? `Continue S${progress!.season || 1} · E${progress!.episode || 1}` : `Watch S${activeSeason} E1`;
  const remaining = progress ? formatRemaining(progress) : '';
  const resumeSubtitle = canResume
    ? remaining
      ? `Resume at ${formatTime(progress!.timestamp)} · ${remaining}`
      : `Resume at ${formatTime(progress!.timestamp)}`
    : undefined;

  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-16">
      <DetailHero
        detail={detail}
        playUrl={playUrl}
        playLabel={playLabel}
        resumeSubtitle={resumeSubtitle}
        isSaved={isSaved}
        onToggleWatchlist={() =>
          toggleMyList({
            mediaType: 'tv',
            id: clean,
            title: detail.title,
            poster: detail.poster,
            backdrop: detail.backdrop,
            year: detail.year,
          })
        }
      />

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        <section className="space-y-6">
          {detail.seasons && detail.seasons.length > 0 && (
            <SeasonSelector seasons={detail.seasons} activeSeason={activeSeason} onSelectSeason={selectSeason} />
          )}

          {episodesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((key) => (
                <div key={key} className="h-28 rounded-xl bg-zinc-900/60 border border-zinc-850 animate-pulse" />
              ))}
            </div>
          ) : !episodes || episodes.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-850 text-center text-zinc-400 text-xs font-mono">
              No episodes listed for Season {activeSeason}.
            </div>
          ) : (
            <div className="space-y-3">
              {episodes.map((episode) => (
                <EpisodeCard key={episode.id ?? episode.number} tvId={clean} seasonNumber={activeSeason} episode={episode} />
              ))}
            </div>
          )}
        </section>

        {detail.cast && detail.cast.length > 0 && <CastSection cast={detail.cast} />}
        {detail.recommendations && detail.recommendations.length > 0 && (
          <RecommendationsSection items={detail.recommendations} title="More Like This" />
        )}
      </div>
    </div>
  );
}
