import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  MonitorPlay,
  Server,
  Settings2,
  Star,
  X,
} from 'lucide-react';
import Player from '@/components/Player';
import MediaCard from '@/components/MediaCard';
import { useAnimeDetail, useDetails, useProviders, useSeason, useSubtitles } from '@/hooks/useApiQueries';
import { getStream, type MediaType } from '@/lib/api';
import { mediaId } from '@/lib/id';
import { getReleaseState } from '@/lib/releaseState';
import { getProgress, saveProgress } from '@/lib/watchProgress';
import { getDownloadInfo } from '@/lib/playerPreferences';
import { useIsInMyList, toggleMyList } from '@/lib/watchlist';
import { SITE_NAME } from '@/lib/brand';
import NotFoundPage from './NotFoundPage';

/**
 * The watch page.
 *
 * Ported 1:1 from frameXTV.xyz's `WatchPage`: the player fills the viewport
 * width, the title/episode heading sits above it, the server picker lists every
 * provider the stream response returned, prev/next episode buttons walk the
 * season (and roll into the next season), the title is badged when it is not
 * released yet, progress is written every 4 s and restored on load, and a `?`
 * keypress toggles the keyboard-shortcut legend.
 */

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / K', action: 'Play or pause' },
  { keys: '← / →', action: 'Seek 10 seconds' },
  { keys: 'J / L', action: 'Seek 10 seconds' },
  { keys: 'F', action: 'Toggle fullscreen' },
  { keys: 'M', action: 'Mute or unmute' },
  { keys: '?', action: 'Toggle this legend' },
];

export default function WatchPage() {
  const { id, tmdbId, season, episode, anilistId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const isAnime = Boolean(anilistId) || window.location.pathname.startsWith('/watch/anime');
  const mediaType: MediaType = isAnime ? 'anime' : season ? 'tv' : 'movie';
  const mediaKey = mediaId(anilistId || id || tmdbId);

  const seasonNumber = Math.max(1, parseInt(season || '1', 10) || 1);
  const episodeNumber = Math.max(1, parseInt(episode || '1', 10) || 1);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [iframeFallback, setIframeFallback] = useState(false);
  const lastSaved = useRef(0);

  const movieDetail = useDetails(mediaKey, mediaType === 'tv' ? 'tv' : 'movie', !isAnime && Boolean(mediaKey));
  const animeDetail = useAnimeDetail(mediaKey, isAnime && Boolean(mediaKey));
  const detail = isAnime ? animeDetail.data : movieDetail.data;
  const detailLoading = isAnime ? animeDetail.isLoading : movieDetail.isLoading;

  const episodesQuery = useSeason(mediaKey, seasonNumber, mediaType === 'tv' && Boolean(detail));
  const subtitlesQuery = useSubtitles(mediaKey, mediaType, seasonNumber, episodeNumber, Boolean(detail));
  const providers = useProviders();

  const stream = useQuery({
    queryKey: ['stream', mediaType, mediaKey, seasonNumber, episodeNumber, sourceIndex],
    queryFn: () =>
      getStream(mediaKey, mediaType, {
        season: mediaType === 'movie' ? undefined : seasonNumber,
        episode: mediaType === 'movie' ? undefined : episodeNumber,
      }),
    enabled: Boolean(mediaKey),
    staleTime: 600_000,
    retry: 2,
  });

  const sources = stream.data?.sources ?? [];
  const activeSource = sources[sourceIndex] || sources[0];
  const subtitles = subtitlesQuery.data?.length ? subtitlesQuery.data : stream.data?.subtitles ?? [];

  const releaseState = getReleaseState({
    mediaType,
    releaseDate: detail?.releaseDate,
    status: detail?.status,
  });

  const savedProgress = useMemo(() => {
    if (!mediaKey) return null;
    return getProgress(mediaType, mediaKey, mediaType === 'tv' ? seasonNumber : undefined, mediaType === 'movie' ? undefined : episodeNumber);
  }, [mediaKey, mediaType, seasonNumber, episodeNumber]);

  const startTime = savedProgress && !savedProgress.completed && savedProgress.timestamp > 15 ? savedProgress.timestamp : 0;
  const isSaved = useIsInMyList(mediaType, mediaKey);

  // --- prev / next episode -------------------------------------------------

  const episodes = episodesQuery.data ?? [];
  const currentEpisode = episodes.find((entry) => entry.number === episodeNumber);

  const navigation = useMemo(() => {
    if (mediaType === 'movie') return { prevUrl: undefined, nextUrl: undefined, nextLabel: undefined };

    const seasons = detail?.seasons ?? [];
    const previous = episodes.find((entry) => entry.number === episodeNumber - 1);
    const following = episodes.find((entry) => entry.number === episodeNumber + 1);

    let nextUrl: string | undefined;
    let nextLabel: string | undefined;
    if (following) {
      nextUrl = isAnime ? `/watch/anime/${mediaKey}/${following.number}` : `/watch/${mediaKey}/${seasonNumber}/${following.number}`;
      nextLabel = following.name ? `S${seasonNumber} · E${following.number} — ${following.name}` : `S${seasonNumber} · E${following.number}`;
    } else {
      const later = seasons.filter((entry) => entry.number > seasonNumber);
      if (later.length > 0) {
        nextUrl = `/watch/${mediaKey}/${later[0].number}/1`;
        nextLabel = `Season ${later[0].number} • Episode 1`;
      }
    }

    const prevUrl = previous
      ? isAnime
        ? `/watch/anime/${mediaKey}/${previous.number}`
        : `/watch/${mediaKey}/${seasonNumber}/${previous.number}`
      : undefined;

    return { prevUrl, nextUrl, nextLabel };
  }, [mediaType, episodes, detail?.seasons, episodeNumber, seasonNumber, mediaKey, isAnime]);

  // --- keyboard help -------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShowShortcuts((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (detail?.title) {
      document.title = releaseState.isReleased
        ? mediaType === 'tv'
          ? `${detail.title} S${seasonNumber}E${episodeNumber} — ${SITE_NAME}`
          : mediaType === 'anime'
            ? `${detail.title} Ep ${episodeNumber} — ${SITE_NAME}`
            : `${detail.title} — ${SITE_NAME}`
        : `${detail.title} — Not Released Yet — ${SITE_NAME}`;
    }
  }, [detail?.title, mediaType, seasonNumber, episodeNumber, releaseState.isReleased]);

  const onProgress = useCallback(
    (seconds: number, duration: number) => {
      if (!mediaKey || !duration) return;
      const now = Date.now();
      if (now - lastSaved.current < 4000) return;
      lastSaved.current = now;
      saveProgress({
        mediaType,
        id: mediaKey,
        season: mediaType === 'tv' ? seasonNumber : undefined,
        episode: mediaType === 'movie' ? undefined : episodeNumber,
        timestamp: seconds,
        duration,
        title: detail?.title,
        poster: detail?.poster || detail?.backdrop,
      });
    },
    [mediaKey, mediaType, seasonNumber, episodeNumber, detail?.title, detail?.poster, detail?.backdrop]
  );

  if (!mediaKey) return <NotFoundPage />;
  if (detailLoading) {
    return (
      <div className="w-full min-h-screen page-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="w-full min-h-screen page-bg text-zinc-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm font-semibold text-white">This title could not be loaded.</p>
        <Link to="/" className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold">
          Back to Home
        </Link>
      </div>
    );
  }

  const detailUrl = isAnime ? `/anime/${mediaKey}` : mediaType === 'tv' ? `/tv/${mediaKey}?season=${seasonNumber}` : `/movie/${mediaKey}`;
  const embedUrl = isAnime
    ? `/embed/anime?id=${mediaKey}&type=anime&season=1&episode=${episodeNumber}&sub_type=sub&autoplay=1&origin=internal${startTime > 15 ? `&t=${Math.floor(startTime)}` : ''}`
    : mediaType === 'tv'
      ? `/embed/${mediaKey}/${seasonNumber}/${episodeNumber}?autoplay=1&origin=internal${startTime > 15 ? `&t=${Math.floor(startTime)}` : ''}`
      : `/embed/${mediaKey}?autoplay=1&origin=internal${startTime > 15 ? `&t=${Math.floor(startTime)}` : ''}`;

  const download = getDownloadInfo(activeSource ? { url: activeSource.url, type: activeSource.type } : null);
  const activeProviders = (providers.data ?? []).filter((provider) => provider.id);

  return (
    <div className="w-full min-h-screen page-bg text-zinc-100">
      <div className="w-full bg-black">
        {!releaseState.isReleased ? (
          <div className="w-full aspect-video bg-zinc-950 border-b border-zinc-900 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <MonitorPlay className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-white">Not released yet</p>
            <p className="text-xs font-mono text-zinc-500">{releaseState.tooltipText || 'This title is not available to stream yet.'}</p>
          </div>
        ) : iframeFallback ? (
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={embedUrl}
              title={detail.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        ) : stream.isLoading ? (
          <div className="w-full aspect-video bg-zinc-950 border-b border-zinc-900 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <p className="text-xs font-mono text-zinc-500">Finding the best server…</p>
          </div>
        ) : (
          <Player
            src={activeSource?.url}
            sourceType={activeSource?.type}
            poster={detail.backdrop || detail.poster}
            title={
              mediaType === 'tv'
                ? `${detail.title} — S${seasonNumber} · E${episodeNumber}${currentEpisode?.name ? ` — ${currentEpisode.name}` : ''}`
                : mediaType === 'anime'
                  ? `${detail.title} — Episode ${episodeNumber}`
                  : detail.title
            }
            subtitles={subtitles}
            sources={sources}
            activeSourceIndex={sourceIndex}
            onSelectSource={setSourceIndex}
            onProgress={onProgress}
            onNext={navigation.nextUrl ? () => navigate(navigation.nextUrl as string) : undefined}
            onPrev={navigation.prevUrl ? () => navigate(navigation.prevUrl as string) : undefined}
            startTime={startTime}
          />
        )}
      </div>

      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={detailUrl}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to details</span>
              </Link>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold tracking-wider text-zinc-300 uppercase">
                {mediaType === 'anime' ? 'Anime' : mediaType === 'tv' ? 'TV Series' : 'Movie'}
              </span>
              {detail.rating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{detail.rating}</span>
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white truncate">{detail.title}</h1>

            {mediaType !== 'movie' && (
              <p className="text-xs sm:text-sm font-mono text-zinc-400">
                {mediaType === 'tv' ? `Season ${seasonNumber} • Episode ${episodeNumber}` : `Episode ${episodeNumber}`}
                {currentEpisode?.name ? ` — ${currentEpisode.name}` : ''}
              </p>
            )}

            {detail.overview && <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl line-clamp-3">{detail.overview}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(navigation.prevUrl || detailUrl)}
              disabled={!navigation.prevUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(navigation.nextUrl || detailUrl)}
              disabled={!navigation.nextUrl}
              title={navigation.nextLabel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-black text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                toggleMyList({
                  mediaType,
                  id: mediaKey,
                  title: detail.title,
                  poster: detail.poster,
                  backdrop: detail.backdrop,
                  year: detail.year,
                })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-400' : ''}`} />
              <span>{isSaved ? 'In My List' : 'Add to My List'}</span>
            </button>
            <Link
              to={detailUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Details</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-rose-500" />
              <h2 className="text-xs font-bold text-zinc-200">Stream Servers</h2>
              {stream.data?.provider && (
                <span className="text-[10px] font-mono text-zinc-500">active: {stream.data.provider}</span>
              )}
            </div>

            {stream.isLoading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((key) => (
                  <div key={key} className="h-8 w-28 rounded-lg bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400">
                  No direct source was returned. The built-in embed player can still play this title.
                </p>
                <button
                  type="button"
                  onClick={() => setIframeFallback(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-bold"
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span>Use embed player</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sources.map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    onClick={() => {
                      setSourceIndex(index);
                      setIframeFallback(false);
                    }}
                    className={`inline-flex flex-col items-start px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      index === sourceIndex
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{source.quality || `Server ${index + 1}`}</span>
                    {source.server && (
                      <span className={`text-[10px] font-mono ${index === sourceIndex ? 'text-zinc-600' : 'text-zinc-500'}`}>
                        {source.server}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {activeProviders.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04] space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Provider directory</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeProviders.map((provider) => (
                    <span
                      key={provider.id}
                      title={provider.tagline}
                      className="px-2 py-0.5 rounded bg-zinc-900/60 border border-white/[0.06] text-[10px] font-mono text-zinc-400"
                    >
                      {provider.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-950/60 border border-white/[0.05] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-rose-500" />
              <h2 className="text-xs font-bold text-zinc-200">Playback</h2>
            </div>
            <dl className="space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-500">Subtitles</dt>
                <dd className="text-zinc-300">{subtitles.length} track{subtitles.length === 1 ? '' : 's'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-500">Download</dt>
                <dd className={download.canDownload ? 'text-emerald-400' : 'text-zinc-400'}>
                  {download.canDownload ? 'Available' : 'Unavailable'}
                </dd>
              </div>
              {!download.canDownload && download.reason && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">{download.reason}</p>
              )}
              {download.canDownload && download.downloadUrl && (
                <a
                  href={download.downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-bold"
                >
                  Download file
                </a>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-500">Shortcuts</dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => setShowShortcuts(true)}
                    className="text-zinc-300 hover:text-white underline decoration-dotted transition-colors cursor-pointer"
                  >
                    press ?
                  </button>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {navigation.nextUrl && (
          <Link
            to={navigation.nextUrl}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-900/70 border border-zinc-850 hover:border-zinc-800 transition-all"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Up next</p>
              <p className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">{navigation.nextLabel}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          </Link>
        )}

        {detail.recommendations && detail.recommendations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white tracking-tight">More Like This</h2>
            <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-none scroll-touch">
              {detail.recommendations.slice(0, 12).map((item) => (
                <MediaCard
                  key={`watch-rec-${item.id}`}
                  id={item.id}
                  type={item.type || mediaType}
                  title={item.title}
                  poster={item.poster || item.image}
                  year={item.year}
                  rating={item.rating}
                  anilistId={item.type === 'anime' || mediaType === 'anime' ? item.anilistId || item.id : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              aria-label="Close shortcuts"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-white mb-3">Keyboard shortcuts</h2>
            <dl className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between gap-3 text-xs">
                  <dt className="font-mono text-zinc-300 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {shortcut.keys}
                  </dt>
                  <dd className="text-zinc-400">{shortcut.action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
