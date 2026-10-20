import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
  Sparkles,
  Star,
  Tv,
} from 'lucide-react';
import EpisodeDrawer from '@/components/EpisodeDrawer';
import EpisodeNav from '@/components/EpisodeNav';
import MediaCard from '@/components/MediaCard';
import NextEpisodePrompt from '@/components/NextEpisodePrompt';
import PlayerEmbed, { type PlayerEmbedHandle } from '@/components/PlayerEmbed';
import ProviderBar from '@/components/ProviderBar';
import ShortcutsModal from '@/components/ShortcutsModal';
import WatchHeader from '@/components/WatchHeader';
import { useAnimeDetail, useDetails, useProviders, useSeason } from '@/hooks/useApiQueries';
import { SITE_NAME } from '@/lib/brand';
import { mediaId } from '@/lib/id';
import { isNotFoundPath } from '@/lib/notFound';
import { readAutoplayNext, saveAutoplayNext } from '@/lib/playerPreferences';
import { getReleaseState } from '@/lib/releaseState';
import { getProgress, saveProgress } from '@/lib/watchProgress';
import { toggleMyList, useIsInMyList } from '@/lib/watchlist';
import NotFoundPage from './NotFoundPage';

/**
 * The watch page.
 *
 * Ported 1:1 from frameXTV.xyz's `WatchPage`: a sticky watch header, an
 * `<iframe>` player pointed at the site's own `/embed/*` route and driven
 * through a `postMessage` bridge, the movie / series / anime detail blocks
 * under it, the episode strip, the episode drawer, the ten-second "Up Next"
 * countdown, the keyboard-shortcut legend, the theater-mode toggle and the
 * recommendation rails. Progress is written every 4 s; a saved timestamp over
 * 15 s shows the resume chip and seeds the embed's `&t=` parameter.
 *
 * Routing follows the reference: `/watch/:tmdbId`, `/watch/:tmdbId/:season/:episode`,
 * `/watch/anime/:anilistId/:episode`, with `?season=` / `?episode=` accepted as
 * fallbacks. A path on the reference's known-404 list renders the 404 page.
 */

type WatchType = 'movie' | 'tv' | 'anime';

const AUTOPLAY_COUNTDOWN = 10;
const NEXT_EPISODE_WINDOW = 30;

export default function WatchPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const search = new URLSearchParams(location.search);
  const isAnimePath = location.pathname.startsWith('/watch/anime');

  // --- route resolution ----------------------------------------------------

  const rawTmdbId = (params.tmdbId || '').trim();
  const rawAnilistId = (params.anilistId || '').trim();
  const querySeason = search.get('season');
  const queryEpisode = search.get('episode');

  const parsedSeason = parseInt(params.season || querySeason || '1', 10);
  const parsedEpisode = parseInt(params.episode || queryEpisode || '1', 10);
  const seasonNumber = Number.isNaN(parsedSeason) || parsedSeason < 1 ? 1 : parsedSeason;
  const episodeNumber = Number.isNaN(parsedEpisode) || parsedEpisode < 1 ? 1 : parsedEpisode;

  const tmdbId = mediaId(rawTmdbId);
  const anilistId = mediaId(rawAnilistId);
  const isTv = !isAnimePath && (Boolean(params.season) || search.has('season'));
  const mediaType: WatchType = isAnimePath ? 'anime' : isTv ? 'tv' : 'movie';
  const mediaKey = isAnimePath ? anilistId : tmdbId;

  // A bare `1234-slug` id is canonicalised to `1234` before the detail query
  // runs, keeping the URL the reference's share links produce.
  useEffect(() => {
    if (rawTmdbId && rawTmdbId.includes('-')) {
      const clean = mediaId(rawTmdbId);
      if (clean) {
        const suffix = isTv ? `/${seasonNumber}/${episodeNumber}` : '';
        navigate(`/watch/${clean}${suffix}${location.search}`, { replace: true });
      }
    }
  }, [rawTmdbId, isTv, seasonNumber, episodeNumber, location.search, navigate]);

  const embedPath = isTv ? `/embed/tv/${tmdbId}/${seasonNumber}/${episodeNumber}` : '';
  const watchPath = isTv ? `/watch/${tmdbId}/${seasonNumber}/${episodeNumber}` : '';
  const notFound =
    isNotFoundPath(rawTmdbId) ||
    (isAnimePath && Boolean(rawAnilistId) && isNotFoundPath(rawAnilistId)) ||
    isNotFoundPath(location.pathname) ||
    isNotFoundPath(typeof window !== 'undefined' ? window.location.href : '') ||
    (Boolean(embedPath) && isNotFoundPath(embedPath)) ||
    (Boolean(watchPath) && isNotFoundPath(watchPath));

  const detailId = mediaType === 'anime' ? anilistId : tmdbId;
  const movieDetail = useDetails(detailId, mediaType === 'tv' ? 'tv' : 'movie', Boolean(detailId) && !notFound);
  const animeDetail = useAnimeDetail(detailId, mediaType === 'anime' && Boolean(detailId) && !notFound);
  const detail = mediaType === 'anime' ? animeDetail.data : movieDetail.data;
  const detailLoading = mediaType === 'anime' ? animeDetail.isLoading : movieDetail.isLoading;
  const detailError = mediaType === 'anime' ? animeDetail.isError : movieDetail.isError;
  const detailErrorValue = mediaType === 'anime' ? animeDetail.error : movieDetail.error;
  const refetchDetail = mediaType === 'anime' ? animeDetail.refetch : movieDetail.refetch;

  const episodesQuery = useSeason(tmdbId, seasonNumber, mediaType === 'tv' && Boolean(tmdbId) && !notFound);
  const episodes = episodesQuery.data ?? [];

  const providersQuery = useProviders();
  const providers = providersQuery.data ?? [];

  // --- state ---------------------------------------------------------------

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSeason, setDrawerSeason] = useState(seasonNumber);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [theaterMode, setTheaterMode] = useState(() => {
    try {
      return localStorage.getItem('framextv_theater_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => readAutoplayNext());
  const [activeProvider, setActiveProvider] = useState<string | undefined>(undefined);
  const [promptVisible, setPromptVisible] = useState(false);
  const [countdown, setCountdown] = useState(AUTOPLAY_COUNTDOWN);

  // Automatic server failover. The frame owns one source; when it reports a
  // dead end the watch page moves to the next provider in the bar rather than
  // showing the viewer an error, and only surfaces the error overlay once the
  // whole provider list has been walked.
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  // Rides in the embed URL so every hop or retry forces a fresh stream request
  // instead of reusing a cached empty resolution.
  const [resolveNonce, setResolveNonce] = useState(0);
  const triedProviders = useRef<Set<string>>(new Set());

  const handlePlayerFailure = useCallback(() => {
    const tried = triedProviders.current;
    if (activeProvider) tried.add(activeProvider);
    // Prefer a provider the viewer has not been on yet this session.
    const next = providers.find((entry) => !tried.has(entry.id) && entry.id !== activeProvider);
    if (!next) {
      setFailoverNotice(null);
      setExhausted(true);
      return;
    }
    tried.add(next.id);
    setFailoverNotice(`Switching to ${next.name}…`);
    setActiveProvider(next.id);
    setResolveNonce((value) => value + 1);
  }, [activeProvider, providers]);

  const promptStarted = useRef(false);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigated = useRef(false);
  const shownPrompts = useRef(new Set<string>());
  const lastSaved = useRef(0);
  const playerRef = useRef<PlayerEmbedHandle | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    promptStarted.current = false;
  }, []);

  // The embed tells the parent when the viewer flips autoplay in the player;
  // `storage` covers a second tab flipping the same preference.
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ enabled?: boolean }>;
      if (custom.detail && typeof custom.detail.enabled === 'boolean') {
        setAutoplayEnabled(custom.detail.enabled);
        if (!custom.detail.enabled) stopCountdown();
        return;
      }
      const stored = readAutoplayNext();
      setAutoplayEnabled(stored);
      if (!stored) stopCountdown();
    };
    window.addEventListener('framextv:autoplay_preference', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('framextv:autoplay_preference', handler);
      window.removeEventListener('storage', handler);
    };
  }, [stopCountdown]);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabled((previous) => {
      const next = !previous;
      saveAutoplayNext(next);
      if (!next) stopCountdown();
      return next;
    });
  }, [stopCountdown]);

  const setAutoplay = useCallback(
    (enabled: boolean) => {
      setAutoplayEnabled(enabled);
      if (!enabled) stopCountdown();
    },
    [stopCountdown]
  );

  // Any episode change resets the prompt and its countdown.
  useEffect(() => {
    stopCountdown();
    navigated.current = false;
    setPromptVisible(false);
    setCountdown(AUTOPLAY_COUNTDOWN);
  }, [tmdbId, anilistId, seasonNumber, episodeNumber, stopCountdown]);

  useEffect(() => stopCountdown, [stopCountdown]);

  // --- derived data --------------------------------------------------------

  const drawerSeasonNumber =
    mediaType === 'anime'
      ? detail?.seasons?.find((entry) => String(entry.id) === String(anilistId))?.number || 1
      : seasonNumber;

  useEffect(() => {
    if (mediaType === 'anime') {
      const match = detail?.seasons?.find((entry) => String(entry.id) === String(anilistId));
      setDrawerSeason(match?.number || 1);
    } else {
      setDrawerSeason(seasonNumber);
    }
  }, [seasonNumber, mediaType, anilistId, detail?.seasons]);

  const activeSeasonRecord =
    mediaType === 'anime' ? detail?.seasons?.find((entry) => entry.number === drawerSeason) : undefined;
  const drawerTotalEpisodes =
    mediaType === 'anime' && activeSeasonRecord?.episodeCount && activeSeasonRecord.episodeCount > 0
      ? activeSeasonRecord.episodeCount
      : detail?.episodes || 1;

  const otherSeasonQuery = useSeason(
    tmdbId,
    drawerSeason,
    mediaType === 'tv' && Boolean(tmdbId) && drawerSeason !== seasonNumber && !notFound
  );
  const drawerEpisodes = drawerSeason === seasonNumber ? episodes : otherSeasonQuery.data ?? [];
  const drawerLoading = drawerSeason === seasonNumber ? episodesQuery.isLoading : otherSeasonQuery.isLoading;

  const isSaved = useIsInMyList(mediaType, mediaKey);
  const toggleWatchlist = useCallback(() => {
    if (!mediaKey || !detail?.title) return;
    toggleMyList({
      mediaType,
      id: mediaKey,
      title: detail.title,
      poster: detail.poster || detail.backdrop,
      year: detail.year,
    });
  }, [mediaType, mediaKey, detail?.title, detail?.poster, detail?.backdrop, detail?.year]);

  // --- prev / next episode -------------------------------------------------

  const currentEpisodeName =
    mediaType === 'tv' ? episodes.find((entry) => entry.number === episodeNumber)?.name : undefined;

  const navigation = useMemo(() => {
    if (mediaType === 'movie') return { prevUrl: null, nextUrl: null, nextEpisodeLabel: null };

    if (mediaType === 'anime') {
      const total = detail?.episodes || 1;
      const seasons = detail?.seasons || [];
      const seasonIndex = seasons.findIndex((entry) => String(entry.id) === String(anilistId));
      let prevUrl: string | null = null;
      let nextUrl: string | null = null;
      let nextEpisodeLabel: string | null = null;

      if (episodeNumber > 1) {
        prevUrl = `/watch/anime/${anilistId}/${episodeNumber - 1}`;
      } else if (seasonIndex > 0) {
        const previousSeason = seasons[seasonIndex - 1];
        prevUrl = `/watch/anime/${previousSeason.id}/${previousSeason.episodeCount || 1}`;
      }

      if (episodeNumber < total) {
        nextUrl = `/watch/anime/${anilistId}/${episodeNumber + 1}`;
        nextEpisodeLabel = `Episode ${episodeNumber + 1}`;
      } else if (seasonIndex >= 0 && seasonIndex < seasons.length - 1) {
        const nextSeason = seasons[seasonIndex + 1];
        if (nextSeason.episodeCount && nextSeason.episodeCount > 0) {
          nextUrl = `/watch/anime/${nextSeason.id}/1`;
          nextEpisodeLabel = `${nextSeason.name} • Episode 1`;
        }
      }

      return { prevUrl, nextUrl, nextEpisodeLabel };
    }

    const numbered = (detail?.seasons || []).filter((entry) => entry.number > 0);
    const currentSeasonRecord = numbered.find((entry) => entry.number === seasonNumber);
    const total = episodes.length || currentSeasonRecord?.episodeCount || 0;
    let prevUrl: string | null = null;
    let nextUrl: string | null = null;
    let nextEpisodeLabel: string | null = null;

    if (episodeNumber > 1) {
      const candidate = `/watch/${tmdbId}/${seasonNumber}/${episodeNumber - 1}`;
      if (!isNotFoundPath(candidate)) prevUrl = candidate;
    } else {
      const earlier = numbered.filter((entry) => entry.number < seasonNumber);
      if (earlier.length > 0) {
        const previousSeason = earlier[earlier.length - 1];
        const candidate = `/watch/${tmdbId}/${previousSeason.number}/${previousSeason.episodeCount || 1}`;
        if (!isNotFoundPath(candidate)) prevUrl = candidate;
      }
    }

    if (total > 0 && episodeNumber < total) {
      const candidate = `/watch/${tmdbId}/${seasonNumber}/${episodeNumber + 1}`;
      if (!isNotFoundPath(candidate)) {
        nextUrl = candidate;
        const nextEntry = episodes.find((entry) => entry.number === episodeNumber + 1);
        nextEpisodeLabel = nextEntry?.name
          ? `S${seasonNumber} · E${episodeNumber + 1} — ${nextEntry.name}`
          : `S${seasonNumber} · E${episodeNumber + 1}`;
      }
    } else if (total > 0 && episodeNumber >= total) {
      const later = numbered.filter((entry) => entry.number > seasonNumber);
      if (later.length > 0) {
        const nextSeason = later[0];
        const candidate = `/watch/${tmdbId}/${nextSeason.number}/1`;
        if (!isNotFoundPath(candidate)) {
          nextUrl = candidate;
          nextEpisodeLabel = `Season ${nextSeason.number} • Episode 1`;
        }
      }
    }

    return { prevUrl, nextUrl, nextEpisodeLabel };
  }, [mediaType, tmdbId, anilistId, seasonNumber, episodeNumber, detail?.episodes, detail?.seasons, episodes]);

  // --- progress ------------------------------------------------------------

  const savedProgress = useMemo(() => {
    const id = mediaType === 'anime' ? anilistId : tmdbId;
    if (!id) return null;
    return getProgress(mediaType, id, seasonNumber, episodeNumber);
  }, [mediaType, tmdbId, anilistId, seasonNumber, episodeNumber]);

  const resumeTime = savedProgress?.completed ? 0 : savedProgress?.timestamp || 0;
  const showResume = resumeTime > 15;

  const onTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      const now = Date.now();
      if (now - lastSaved.current >= 4000) {
        lastSaved.current = now;
        const id = mediaType === 'anime' ? anilistId : tmdbId;
        if (id && duration > 0) {
          saveProgress({
            mediaType,
            id,
            season: mediaType === 'tv' ? seasonNumber : undefined,
            episode: mediaType === 'movie' ? undefined : episodeNumber,
            timestamp: currentTime,
            duration,
            title: detail?.title,
            poster: detail?.poster || detail?.backdrop,
          });
        }
      }

      if (mediaType === 'movie' || !navigation.nextUrl) return;
      const id = mediaType === 'anime' ? anilistId : tmdbId;
      const promptKey = `${mediaType}:${id}:s${seasonNumber}:e${episodeNumber}`;
      if (shownPrompts.current.has(promptKey)) return;

      const remaining = duration - currentTime;
      const nearEnd = duration > 0 && currentTime > 0 && remaining <= NEXT_EPISODE_WINDOW && remaining >= 0;
      if (nearEnd) {
        if (!promptStarted.current && !navigated.current) {
          if (autoplayEnabled) {
            promptStarted.current = true;
            setPromptVisible(true);
            setCountdown(AUTOPLAY_COUNTDOWN);
            countdownTimer.current = setInterval(() => {
              setCountdown((value) => (value <= 1 ? 0 : value - 1));
            }, 1000);
          } else {
            setPromptVisible(true);
          }
        }
      } else if (remaining > NEXT_EPISODE_WINDOW) {
        if (promptStarted.current) stopCountdown();
        setPromptVisible(false);
        setCountdown(AUTOPLAY_COUNTDOWN);
      }
    },
    [
      mediaType,
      tmdbId,
      anilistId,
      seasonNumber,
      episodeNumber,
      detail?.title,
      detail?.poster,
      detail?.backdrop,
      navigation.nextUrl,
      autoplayEnabled,
      stopCountdown,
    ]
  );

  // --- autoplay ------------------------------------------------------------

  const goNext = useCallback(() => {
    if (navigated.current || !navigation.nextUrl || isNotFoundPath(navigation.nextUrl)) return;
    navigated.current = true;
    stopCountdown();
    setPromptVisible(false);
    navigate(navigation.nextUrl);
  }, [navigation.nextUrl, navigate, stopCountdown]);

  useEffect(() => {
    if (!promptVisible || !autoplayEnabled) return;
    if (countdown === 0 && promptStarted.current && !navigated.current) goNext();
  }, [countdown, promptVisible, autoplayEnabled, goNext]);

  const cancelPrompt = useCallback(() => {
    stopCountdown();
    setPromptVisible(false);
    const id = mediaType === 'anime' ? anilistId : tmdbId;
    if (id) shownPrompts.current.add(`${mediaType}:${id}:s${seasonNumber}:e${episodeNumber}`);
  }, [mediaType, tmdbId, anilistId, seasonNumber, episodeNumber, stopCountdown]);

  // --- keyboard ------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShortcutsOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- title / release state ----------------------------------------------

  const currentEpisode = mediaType === 'tv' ? episodes.find((entry) => entry.number === episodeNumber) : undefined;
  const releaseState = getReleaseState({
    mediaType,
    releaseDate: detail?.releaseDate,
    status: detail?.status,
    episodeAirDate: currentEpisode?.airDate,
  });
  const unreleased = Boolean(detail && !releaseState.isReleased);

  useEffect(() => {
    if (!detail?.title) return;
    if (unreleased) {
      document.title = `${detail.title} — Not Released Yet — ${SITE_NAME}`;
    } else if (mediaType === 'tv') {
      document.title = `${detail.title} S${seasonNumber}E${episodeNumber} — ${SITE_NAME}`;
    } else if (mediaType === 'anime') {
      document.title = `${detail.title} Ep ${episodeNumber} — ${SITE_NAME}`;
    } else {
      document.title = `${detail.title} — ${SITE_NAME}`;
    }
  }, [detail?.title, unreleased, mediaType, seasonNumber, episodeNumber]);

  const detailUrl = useMemo(
    () =>
      mediaType === 'anime'
        ? `/anime/${anilistId}`
        : mediaType === 'tv'
          ? `/tv/${tmdbId}?season=${seasonNumber}`
          : `/movie/${tmdbId}`,
    [mediaType, tmdbId, anilistId, seasonNumber]
  );

  const embedUrl = useMemo(() => {
    const startParam = resumeTime > 15 ? `&t=${Math.floor(resumeTime)}` : '';
    const providerParam = activeProvider ? `&provider=${encodeURIComponent(activeProvider)}` : '';
    // A resolve nonce makes every retry a new embed URL, so it is a new stream
    // request rather than a cache hit on the empty resolution that failed.
    const nonceParam = resolveNonce > 0 ? `&r=${resolveNonce}` : '';
    if (mediaType === 'anime') {
      const titleParam = detail?.title ? `&title=${encodeURIComponent(detail.title)}` : '';
      return `/embed/anime?id=${anilistId}&type=anime&season=1&episode=${episodeNumber}&sub_type=sub&autoplay=1&origin=internal${providerParam}${titleParam}${startParam}${nonceParam}`;
    }
    return isTv
      ? `/embed/${tmdbId}/${seasonNumber}/${episodeNumber}?autoplay=1&origin=internal${providerParam}${startParam}${nonceParam}`
      : `/embed/${tmdbId}?autoplay=1&origin=internal${providerParam}${startParam}${nonceParam}`;
  }, [mediaType, isTv, tmdbId, anilistId, seasonNumber, episodeNumber, resumeTime, detail?.title, activeProvider, resolveNonce]);

  const selectEpisode = useCallback(
    (targetSeason: number, targetEpisode: number) => {
      if (mediaType === 'anime') {
        const match = detail?.seasons?.find((entry) => entry.number === targetSeason);
        const id = match?.id ? String(match.id) : anilistId;
        navigate(`/watch/anime/${id}/${targetEpisode}`);
      } else {
        navigate(`/watch/${tmdbId}/${targetSeason}/${targetEpisode}`);
      }
    },
    [mediaType, detail?.seasons, anilistId, tmdbId, navigate]
  );

  // --- recommendations -----------------------------------------------------

  const recommendations = useMemo(() => {
    const list = detail?.recommendations || [];
    const seen = new Set<string>();
    return list.filter((entry) => {
      const id = String(entry?.id || '');
      if (!id || !entry?.title || seen.has(id) || id === mediaKey) return false;
      seen.add(id);
      return true;
    });
  }, [detail?.recommendations, mediaKey]);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const recTrackRef = useRef<HTMLDivElement | null>(null);

  const updateScroll = useCallback(() => {
    const element = recTrackRef.current;
    if (!element) return;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    updateScroll();
    const element = recTrackRef.current;
    if (!element) return;
    let frame = 0;
    const handler = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScroll);
    };
    element.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      element.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [recommendations, updateScroll]);

  const scrollRecs = (direction: 'left' | 'right') => {
    const element = recTrackRef.current;
    if (!element) return;
    const amount = element.clientWidth * 0.75;
    element.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const promptThumbnail = useMemo(
    () =>
      isTv
        ? episodes.find((entry) => entry.number === episodeNumber + 1)?.still || detail?.backdrop || detail?.poster
        : detail?.backdrop || detail?.poster,
    [isTv, episodes, episodeNumber, detail?.backdrop, detail?.poster]
  );

  const displayOverview = useMemo(
    () => (isTv && episodes.find((entry) => entry.number === episodeNumber)?.overview) || detail?.overview,
    [isTv, episodes, episodeNumber, detail?.overview]
  );

  const runtimeLabel = useMemo(() => {
    if (!detail?.runtime) return null;
    const hours = Math.floor(detail.runtime / 60);
    const minutes = detail.runtime % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, [detail?.runtime]);

  // --- render --------------------------------------------------------------

  if (notFound) return <NotFoundPage />;

  if (detailLoading && !detail) {
    return (
      <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col">
        <div className="h-14 w-full bg-zinc-950 border-b border-white/[0.04] animate-pulse" />
        <div className="max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="w-full aspect-video bg-zinc-900/60 rounded-2xl border border-white/[0.06] animate-pulse flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
          </div>
          <div className="h-12 w-full bg-zinc-900/40 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (detailError && !detail) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-bold text-white">Media Not Found</h2>
          <p className="text-xs text-zinc-400">
            {detailErrorValue instanceof Error ? detailErrorValue.message : 'Unable to locate media details.'}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => refetchDetail()}
            className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Retry
          </button>
          <Link
            to={detailUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Details</span>
          </Link>
        </div>
      </div>
    );
  }

  if (unreleased) {
    return (
      <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-16 overflow-x-hidden">
        <div className="w-full border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link
            to={detailUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Details</span>
          </Link>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider truncate max-w-[200px] sm:max-w-xs">
            {detail?.title}
          </span>
        </div>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6">
          <div
            data-testid="watch-unreleased-state"
            className="w-full p-6 sm:p-8 rounded-2xl bg-zinc-950/90 border border-white/[0.08] shadow-2xl flex flex-col items-center space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Not Released Yet</h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
                {detail?.releaseDate
                  ? `${detail.title} is scheduled for release on ${detail.releaseDate}. Playback will become available once officially released.`
                  : `${detail?.title || 'This content'} has not been released yet. Playback is unavailable.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to={detailUrl}
                data-testid="unreleased-back-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Details</span>
              </Link>
              <button
                type="button"
                onClick={toggleWatchlist}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all active:scale-[0.98] cursor-pointer ${
                  isSaved
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                    : 'bg-zinc-900/80 hover:bg-zinc-800 border-white/[0.06] text-zinc-300 hover:text-white'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${isSaved ? 'fill-rose-400 text-rose-400' : 'text-zinc-400'}`} />
                <span>{isSaved ? 'In My List' : 'Add to My List'}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      data-theater-mode={theaterMode ? 'true' : 'false'}
      className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-16 overflow-x-hidden"
    >
      <WatchHeader
        mediaType={mediaType}
        title={detail?.title || 'Unknown Title'}
        year={detail?.year}
        genres={detail?.genres}
        season={mediaType === 'anime' ? drawerSeasonNumber : seasonNumber}
        episode={episodeNumber}
        episodeName={currentEpisodeName}
        backUrl={detailUrl}
        isTheaterMode={theaterMode}
        onToggleTheater={() => {
          setTheaterMode((previous) => {
            const next = !previous;
            try {
              localStorage.setItem('framextv_theater_mode', String(next));
            } catch {
              /* storage disabled */
            }
            return next;
          });
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        isSaved={isSaved}
        onToggleWatchlist={toggleWatchlist}
      />

      <main className="w-full pt-1 pb-6 sm:pt-3 sm:pb-8 space-y-5 sm:space-y-6 flex-1 flex flex-col items-center">
        <div
          className={`w-full space-y-2 sm:space-y-3 transition-all duration-300 ${
            theaterMode ? 'max-w-[98vw] px-0 sm:px-2' : 'max-w-6xl px-0 sm:px-4 lg:px-6'
          }`}
        >
          <ProviderBar
            providers={providers}
            activeProvider={activeProvider}
            onSelect={setActiveProvider}
            loading={providersQuery.isLoading}
          />

          <PlayerEmbed
            ref={playerRef}
            embedUrl={embedUrl}
            title={detail?.title || `${SITE_NAME} Player`}
            posterUrl={detail?.backdrop || detail?.poster}
            backUrl={detailUrl}
            resumedTime={showResume ? resumeTime : 0}
            onTimeUpdate={onTimeUpdate}
            onAutoplayChange={setAutoplay}
            onFailure={handlePlayerFailure}
            failoverNotice={failoverNotice}
            showErrorOverlay={exhausted}
            onRetry={() => {
              // A manual retry is a brand-new attempt: re-arm the failover
              // budget and force a fresh stream resolution.
              triedProviders.current.clear();
              setExhausted(false);
              setFailoverNotice(null);
              setResolveNonce((value) => value + 1);
            }}
            onPlayerReady={() => {
              // A provider answered, so clear the hop notice and re-arm the
              // failover budget for whatever comes next.
              setFailoverNotice(null);
              setExhausted(false);
            }}
          />
        </div>

        <div className="w-full max-w-6xl px-3 sm:px-4 lg:px-6 space-y-6 sm:space-y-8">
          {mediaType === 'movie' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.04] pb-5">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                      {detail?.title}
                    </h1>
                    {detail?.rating && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{detail.rating}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                    {detail?.year && <span>{detail.year}</span>}
                    {runtimeLabel && (
                      <>
                        <span>•</span>
                        <span>{runtimeLabel}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="capitalize">Feature Film</span>
                    {detail?.genres && detail.genres.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-300">{detail.genres.slice(0, 3).join(' / ')}</span>
                      </>
                    )}
                  </div>
                  {detail?.overview && (
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">{detail.overview}</p>
                  )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => playerRef.current?.restart()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                    title="Restart from Beginning"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Restart</span>
                  </button>
                  <Link
                    to={detailUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium transition-colors active:scale-95"
                    title="View Full Details, Cast & Trailers"
                  >
                    <Info className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="hidden sm:inline">Details</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : mediaType === 'tv' ? (
            <div className="space-y-4">
              <div className="space-y-2 border-b border-white/[0.04] pb-5">
                <Link
                  to={detailUrl}
                  className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-400 hover:text-indigo-400 transition-colors"
                >
                  <Tv className="w-3 h-3" />
                  <span>{detail?.title}</span>
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
                    Season {seasonNumber} · Episode {episodeNumber}
                    {currentEpisodeName && <span className="text-zinc-400 font-normal"> — {currentEpisodeName}</span>}
                  </h1>
                  {detail?.rating && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-400 self-start sm:self-auto">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{detail.rating}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                  {detail?.year && <span>{detail.year}</span>}
                  <span>•</span>
                  <span>
                    Season {seasonNumber} of {detail?.numberOfSeasons || detail?.seasons?.length || 1}
                  </span>
                  {detail?.genres && detail.genres.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-300">{detail.genres.slice(0, 3).join(' / ')}</span>
                    </>
                  )}
                </div>
                {displayOverview && (
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">{displayOverview}</p>
                )}
              </div>
              <EpisodeNav
                mediaType="tv"
                currentSeason={seasonNumber}
                currentEpisode={episodeNumber}
                totalEpisodes={episodes.length || detail?.episodes}
                prevUrl={navigation.prevUrl}
                nextUrl={navigation.nextUrl}
                nextEpisodeLabel={navigation.nextEpisodeLabel}
                onOpenSelector={() => setDrawerOpen(true)}
                isAutoplayEnabled={autoplayEnabled}
                onToggleAutoplay={toggleAutoplay}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 border-b border-white/[0.04] pb-5">
                <Link
                  to={detailUrl}
                  className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-400 hover:text-rose-400 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>{detail?.title}</span>
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
                    {detail?.seasons && detail.seasons.length > 1 ? `Season ${drawerSeasonNumber} · ` : ''}Episode{' '}
                    {episodeNumber}
                    {detail?.episodes ? <span className="text-zinc-500 font-normal"> of {detail.episodes}</span> : ''}
                    {currentEpisodeName && <span className="text-zinc-400 font-normal"> — {currentEpisodeName}</span>}
                  </h1>
                  {detail?.rating && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-400 self-start sm:self-auto">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{detail.rating}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                  {detail?.year && <span>{detail.year}</span>}
                  <span>•</span>
                  <span>Anime Series</span>
                  {detail?.genres && detail.genres.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-300">{detail.genres.slice(0, 3).join(' / ')}</span>
                    </>
                  )}
                </div>
                {detail?.overview && (
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">{detail.overview}</p>
                )}
              </div>
              <EpisodeNav
                mediaType="anime"
                currentSeason={drawerSeasonNumber}
                currentEpisode={episodeNumber}
                totalEpisodes={detail?.episodes}
                prevUrl={navigation.prevUrl}
                nextUrl={navigation.nextUrl}
                nextEpisodeLabel={navigation.nextEpisodeLabel}
                onOpenSelector={() => setDrawerOpen(true)}
                isAutoplayEnabled={autoplayEnabled}
                onToggleAutoplay={toggleAutoplay}
              />
            </div>
          )}

          {(mediaType === 'tv' || mediaType === 'anime') && Boolean(navigation.nextUrl) && promptVisible && (
            <NextEpisodePrompt
              nextEpisodeLabel={navigation.nextEpisodeLabel}
              countdown={countdown}
              onPlayNow={goNext}
              onCancel={cancelPrompt}
              thumbnail={promptThumbnail}
              isAutoplayEnabled={autoplayEnabled}
              onToggleAutoplay={toggleAutoplay}
            />
          )}

          {mediaType === 'anime' && detail?.relatedAnime && detail.relatedAnime.length > 0 && (
            <section className="relative w-full space-y-4 pt-4 border-t border-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Franchise &amp; Related Anime
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 border border-white/[0.06] text-[10px] font-mono font-semibold text-zinc-400">
                    {detail.relatedAnime.length}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 scroll-touch">
                {detail.relatedAnime.map((entry) => (
                  <MediaCard
                    key={`related-${entry.id}`}
                    id={entry.id}
                    type="anime"
                    title={entry.title}
                    poster={entry.poster}
                    year={entry.year}
                    rating={entry.rating}
                    anilistId={entry.id}
                  />
                ))}
              </div>
            </section>
          )}

          {recommendations.length > 0 && (
            <section
              className="relative w-full space-y-4 pt-4 border-t border-white/[0.04] group/rec"
              data-testid="watch-recommendations"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {mediaType === 'movie' ? 'More Like This' : mediaType === 'tv' ? 'Similar Series' : 'Similar Anime'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 border border-white/[0.06] text-[10px] font-mono font-semibold text-zinc-400">
                    {recommendations.length}
                  </span>
                </div>
              </div>
              <div className="relative">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollRecs('left')}
                    aria-label="Scroll recommendations left"
                    className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-white/[0.1] text-white flex items-center justify-center opacity-0 group-hover/rec:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 hover:border-white/[0.2] shadow-xl cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div
                  ref={recTrackRef}
                  className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 scroll-touch"
                >
                  {recommendations.map((entry) => (
                    <MediaCard
                      key={`rec-${entry.type}-${entry.id}`}
                      id={entry.id}
                      type={entry.type}
                      title={entry.title}
                      poster={entry.poster}
                      year={entry.year}
                      rating={entry.rating}
                      anilistId={entry.type === 'anime' ? entry.id : undefined}
                    />
                  ))}
                </div>
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollRecs('right')}
                    aria-label="Scroll recommendations right"
                    className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-white/[0.1] text-white flex items-center justify-center opacity-0 group-hover/rec:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 hover:border-white/[0.2] shadow-xl cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {(mediaType === 'tv' || mediaType === 'anime') && (
        <EpisodeDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mediaType={mediaType === 'anime' ? 'anime' : 'tv'}
          tvId={tmdbId}
          title={
            mediaType === 'anime' && activeSeasonRecord && detail?.seasons && detail.seasons.length > 1
              ? `${detail?.title || 'Anime'} — ${activeSeasonRecord.name}`
              : detail?.title || 'Episodes'
          }
          seasons={detail?.seasons}
          activeSeason={drawerSeason}
          currentSeason={mediaType === 'anime' ? drawerSeasonNumber : seasonNumber}
          episodes={drawerEpisodes}
          isLoadingEpisodes={mediaType === 'anime' ? false : drawerLoading}
          onSelectSeason={(season) => setDrawerSeason(season)}
          totalEpisodes={mediaType === 'anime' ? drawerTotalEpisodes : detail?.episodes}
          currentEpisode={episodeNumber}
          onSelectEpisode={selectEpisode}
        />
      )}

      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
