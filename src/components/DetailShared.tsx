import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/**
 * The trailer player, morphed into the backdrop's own panel.
 *
 * Clicking Watch Trailer does not open a dialog: the wide backdrop panel itself
 * becomes the video, so the trailer plays in exactly the area the artwork
 * occupied and nothing is layered over it — no scrim, no chrome, no close
 * button. The poster and the Watch Movie / Add to My List row below stay
 * visible throughout; only Watch Trailer greys out for the duration.
 *
 * `slotRef` is the backdrop panel and `posterRef` the `<img>` inside it, so the
 * player animates from the artwork's on-screen rect to the panel's. That is
 * what makes the morph track the real layout instead of a hard-coded start size.
 *
 * Closing is driven by the video, not by the viewer: the trailer auto-replays
 * itself twice and, when it finishes with those replays spent, the panel returns
 * to the backdrop on its own and the rail's play button slides out "Watch Now"
 * (see the parent's `onTrailerFinish`).
 */
export function TrailerInline({
  video,
  onFinish,
  replayNonce,
  slotRef,
  posterRef,
  title,
}: {
  video: FxVideo;
  /** The trailer reached its end. The parent owns the replay/exhaust decision. */
  onFinish: () => void;
  /** Bumped by the parent to restart the same trailer from the top. */
  replayNonce: number;
  slotRef: React.RefObject<HTMLDivElement | null>;
  posterRef: React.RefObject<HTMLImageElement | null>;
  title?: string;
}) {
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Escape is handled by the parent, which has to cancel any pending
  // auto-replay at the same time; there is still deliberately no on-screen close
  // affordance.

  // The trailer's end is reported to the parent, which decides whether to
  // replay. With `enablejsapi=1` the embed answers `{"event":"listening"}` with
  // player state changes, so state 0 (ended) is the signal. `onFinish` is held
  // in a ref so a rebuilt handler never double-fires on a re-render.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      let payload: { event?: string; info?: unknown } | null = null;
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload && payload.event === 'onStateChange' && payload.info === 0) onFinishRef.current();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Transform the panel from the artwork's rect to the panel's own, then release
  // it. Kept in a layout effect so the start transform is applied before the
  // first paint — otherwise the panel would flash at full size first.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const slot = slotRef.current;
    if (!panel || !slot) return;
    const to = panel.getBoundingClientRect();
    const fromEl = posterRef.current ?? slot;
    const from = fromEl.getBoundingClientRect();
    if (!to.width || !to.height || !from.width || !from.height) return;

    const scaleX = from.width / to.width;
    const scaleY = from.height / to.height;
    panel.style.transition = 'none';
    panel.style.transformOrigin = 'top left';
    panel.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scaleX}, ${scaleY})`;
    panel.style.opacity = '0.6';

    const frame = requestAnimationFrame(() => {
      panel.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out';
      panel.style.transform = 'translate(0, 0) scale(1, 1)';
      panel.style.opacity = '1';
    });
    const done = window.setTimeout(() => {
      panel.style.transition = '';
      panel.style.transform = '';
      panel.style.transformOrigin = '';
      panel.style.opacity = '';
    }, 480);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
  }, [slotRef, posterRef]);

  if (!video.key) return null;

  return (
    <div
      ref={panelRef}
      data-testid="trailer-inline"
      role="region"
      aria-label={title ? `${title} trailer` : 'Media trailer'}
      className={`absolute inset-0 z-20 overflow-hidden bg-black ${entered ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Keyed on the replay nonce so a replay is a genuine remount: the embed
          must start from 0:00, and re-setting src on the same element is not a
          reliable restart. */}
      <iframe
        key={replayNonce}
        ref={frameRef}
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
        title={video.name || `${title || 'Title'} Official Trailer`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      />
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
  /**
   * Resolve and warm the title's stream in the background. Fired on mount
   * (after a short grace period) and again when the trailer opens, so the
   * stream and every provider in the server bar are resolved before playback.
   * The detail page owns this because it alone knows the id, type and
   * season/episode the watch page will ask for.
   */
  onWarmStream?: () => void;
}

export function DetailHero({
  detail,
  playUrl,
  playLabel = 'Watch Now',
  resumeSubtitle,
  isSaved = false,
  onToggleWatchlist,
  onWarmStream,
}: DetailHeroProps) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterErrored, setPosterErrored] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  // The trailer auto-replays twice. `replays` counts how many of those two have
  // been spent and `replayNonce` is bumped to remount the embed for each one.
  // When it finishes with both spent we stop looping, close the panel, and
  // leave the rail's pill on screen with its "Watch Now" label out.
  const [replays, setReplays] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [watchNowReady, setWatchNowReady] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const posterSlotRef = useRef<HTMLDivElement | null>(null);
  const posterImgRef = useRef<HTMLImageElement | null>(null);
  // The backdrop panel is the trailer's morph target: the wide artwork becomes
  // the video, while the poster keeps its own slot and stays on screen.
  const backdropSlotRef = useRef<HTMLDivElement | null>(null);

  const { isReleased } = getReleaseState({
    mediaType: detail.type,
    releaseDate: detail.releaseDate,
    status: detail.status,
  });

  const videos = detail.videos || [];
  const trailer = pickTrailer(videos);
  const runtimeLabel = formatRuntime(detail.runtime);
  const typeLabel = detail.type === 'anime' ? 'Anime' : detail.type === 'tv' ? 'TV Series' : 'Movie';
  // Closing is driven by the video, not the viewer: the trailer auto-replays
  // itself twice and, when it finishes with those replays spent, the panel
  // returns to the backdrop on its own and the rail's pill stays on screen with
  // its "Watch Now" label out (see the parent's `onTrailerFinish`).
  const showWatchNowLabel = watchNowReady;
  // The pill has two reasons to be on screen: the trailer is playing, or it has
  // run its course and is asking the viewer to watch the film instead.
  const showRailActions = trailerOpen || watchNowReady;

  const openTrailer = () => {
    setReplays(0);
    setReplayNonce((nonce) => nonce + 1);
    setTrailerOpen(true);
  };

  // The trailer reached its end. Spend an auto-replay if any are left and
  // remount the embed for it; otherwise this was the third play, so stop looping,
  // close the panel, and surface the label out on the rail.
  const onTrailerFinish = () => {
    if (replays < 2) {
      setReplays((count) => count + 1);
      setReplayNonce((nonce) => nonce + 1);
      return;
    }
    setTrailerOpen(false);
    setWatchNowReady(true);
  };

  // Resolve the film while the trailer holds the viewer's attention, so Watch
  // Now is a local start rather than a fresh resolve. The effect is keyed on
  // `trailerOpen` so it fires once per open, not once per replay, and the grace
  // period means a viewer who bounces off the trailer never pays for a resolve
  // they will not use. `onWarmStream` is held in a ref so a rebuilt callback
  // cannot re-trigger the resolve mid-trailer.
  const onWarmStreamRef = useRef(onWarmStream);
  onWarmStreamRef.current = onWarmStream;
  useEffect(() => {
    if (!trailerOpen) return;
    const timer = window.setTimeout(() => onWarmStreamRef.current?.(), 1500);
    return () => window.clearTimeout(timer);
  }, [trailerOpen]);

  // Resolve on the detail page itself, not only when the trailer opens. The
  // viewer is reading the synopsis and cast for a few seconds before they press
  // play, and that time is enough to resolve the stream and every provider the
  // server bar offers — so Watch Now, and any later server switch, are instant.
  // The grace period keeps a viewer who bounces straight back out from paying
  // for a resolve they will not use; a repeated resolve is cheap because every
  // already-warmed provider is skipped.
  useEffect(() => {
    const timer = window.setTimeout(() => onWarmStreamRef.current?.(), 800);
    return () => window.clearTimeout(timer);
  }, []);

  // Escape is a hard stop at any point in the three plays. It clears the flag so
  // the label cannot appear from a course the viewer abandoned.
  useEffect(() => {
    if (!trailerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTrailerOpen(false);
      setReplays(0);
      setWatchNowReady(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trailerOpen]);

  return (
    <div className="media-surface relative w-full overflow-hidden bg-black text-white">
      {/* The backdrop is the hero's fill, not a blurred wash. It spans the whole
          hero at 16:9 so the wide artwork reads edge to edge, and it doubles as
          the trailer's stage: Watch Trailer morphs this panel into the video,
          which is the landscape-friendly area, while the poster keeps its own
          small slot at the bottom-left and stays visible throughout. */}
      <div
        ref={backdropSlotRef}
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      >
        {detail.backdrop ? (
          <img
            src={detail.backdrop}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-zinc-950" />
        )}
        {/* Scrims keep the copy legible over the artwork without hiding it. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
      </div>

      {/* The morphing trailer sits above the backdrop but below the copy, so the
          text stays readable while the video plays. The morph starts at the
          poster's rect and expands to the backdrop panel, so the artwork reads
          as unfolding into the video inside the backdrop's own area. */}
      {trailerOpen && trailer && trailer.key && (
        <TrailerInline
          video={trailer}
          title={detail.title}
          slotRef={backdropSlotRef}
          posterRef={posterImgRef}
          replayNonce={replayNonce}
          onFinish={onTrailerFinish}
        />
      )}

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-8 sm:pb-12 z-30">
        <div className="flex flex-col-reverse md:flex-row items-start gap-6 sm:gap-8 lg:gap-10">
          <div className="flex-1 space-y-4 text-left w-full min-w-0">
            <div
              className={`space-y-4 transition-opacity duration-300 ${
                trailerOpen ? 'opacity-0' : 'opacity-100'
              }`}
            >
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
            </div>

            {/* The action row is the resting home of the buttons. While the
                trailer plays it hides (still occupying its space, so nothing
                reflows) because the same actions reappear as icons in the
                top-right rail; when the trailer ends the row fades back in
                exactly where it was. Once the trailer has run its three-play
                course the rail's pill keeps the play and save actions, so the
                row drops its own copies to avoid showing the same control twice
                — Watch Trailer stays put so the trailer can still be replayed. */}
            <div
              className={`flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2 w-full md:min-w-[11rem] transition-opacity duration-300 ${
                trailerOpen ? 'invisible opacity-0' : 'visible opacity-100'
              }`}
            >
              <div
                aria-hidden={showWatchNowLabel}
                className={`relative inline-flex flex-col gap-1 group/unreleased w-full xs:w-auto transition-opacity duration-300 ${
                  showWatchNowLabel ? 'invisible opacity-0' : 'visible opacity-100'
                }`}
              >
                {isReleased ? (
                  <Link
                    to={playUrl}
                    data-testid="detail-play-btn"
                    className="accent-active inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-[0.98] cursor-pointer w-full xs:w-auto"
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
                    showWatchNowLabel ? 'invisible opacity-0' : 'visible opacity-100'
                  } ${
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
                  data-testid="detail-trailer-btn"
                  onClick={openTrailer}
                  aria-pressed={trailerOpen}
                  disabled={trailerOpen}
                  className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all self-stretch xs:self-start w-full xs:w-auto ${
                    trailerOpen
                      ? 'bg-zinc-900/50 border-zinc-800/60 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>{trailerOpen ? 'Playing Trailer…' : 'Watch Trailer'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right rail: the poster sits in the top-right corner, and while the
              trailer plays the primary actions collapse to icon-only buttons
              that stack directly beneath it — again hard against the top-right
              corner. The rail is `items-end` so every child is right-aligned.
              It is `self-end` on the stacked (mobile) layout to pin it right,
              and `md:self-stretch` so in the row layout it spans the hero's
              full height and "top" always means the corner regardless of how
              tall the copy column gets. */}
          <div className="flex shrink-0 flex-col items-end gap-3 self-end md:self-stretch">
            <div
              ref={posterSlotRef}
              data-testid="detail-poster-slot"
              className="w-28 sm:w-32 md:w-40 lg:w-48 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl relative"
            >
              {detail.poster && !posterErrored ? (
                <>
                  <img
                    ref={posterImgRef}
                    src={detail.poster}
                    alt={detail.title}
                    onLoad={() => setPosterLoaded(true)}
                    onError={() => setPosterErrored(true)}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!posterLoaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-zinc-600 bg-zinc-900">
                  <ImageOff className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[10px] font-mono text-zinc-500 line-clamp-2">{detail.title}</span>
                </div>
              )}
            </div>

            {/* Icon-only action cluster, held directly beneath the poster. The
                two actions stack vertically inside a frosted (glassmorphism)
                pill. It stays mounted so it can fade in and out, but when
                closed it contributes no height and no hover targets, so the
                rail's height is driven purely by the poster and the buttons
                always sit exactly under it. */}
            <div
              data-testid="trailer-action-cluster"
              aria-hidden={!showRailActions}
              className={`inline-flex flex-col items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-md shadow-2xl transition-opacity duration-300 ease-out ${
                showRailActions ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'
              }`}
            >
              {isReleased && (
                // The play button owns the sliding label, so it is the one that
                // has to clip its own overflow.
                <Link
                  to={playUrl}
                  aria-label={playLabel}
                  title={playLabel}
                  className="group/railplay relative inline-flex items-center justify-center h-8 min-w-8 px-2.5 rounded-full bg-white hover:bg-zinc-200 text-black shadow-lg transition-all active:scale-95 overflow-hidden"
                >
                  <Play className="w-3.5 h-3.5 fill-black shrink-0 relative z-10" />
                  {/* Slides out from behind the icon once the trailer has run
                      its three-play course. Width and margin both animate from
                      zero, so the collapsed state leaves no stray gap. */}
                  <span
                    data-testid="watch-now-label"
                    aria-hidden={!showWatchNowLabel}
                    className={`inline-flex items-center whitespace-nowrap rounded-full text-[10px] font-bold leading-none text-black transition-all duration-300 ease-out ${
                      showWatchNowLabel
                        ? 'ml-1 max-w-[7rem] px-1 py-0.5 opacity-100 animate-watch-now-pulse'
                        : 'ml-0 max-w-0 px-0 opacity-0'
                    }`}
                  >
                    Watch Now
                  </span>
                </Link>
              )}
              {onToggleWatchlist && (
                <button
                  type="button"
                  onClick={onToggleWatchlist}
                  aria-label={isSaved ? `Remove ${detail.title} from My List` : `Add ${detail.title} to My List`}
                  title={isSaved ? 'In My List' : 'Add to My List'}
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all active:scale-95 ${
                    isSaved
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                      : 'bg-white/5 hover:bg-white/15 border-white/15 text-zinc-200 hover:text-white'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-400 text-rose-400' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CastMemberCard({ member }: { member: FxCastMember }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // A cast member's `id` is their TMDB person id, which is what the profile
  // page resolves from. The name rides along in `?name=` so a person Wikidata
  // has not linked to a TMDB id can still be found by label.
  const profileId = String(member.id ?? '').trim();
  const linkable = Boolean(profileId);
  const href = `/person/${encodeURIComponent(profileId)}?name=${encodeURIComponent(member.name ?? '')}`;

  const card = (
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

  if (!linkable) return card;
  return (
    <Link to={href} aria-label={`View ${member.name}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded-lg">
      {card}
    </Link>
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
    <div className="w-full min-h-screen page-bg text-zinc-100 flex flex-col animate-pulse select-none">
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
