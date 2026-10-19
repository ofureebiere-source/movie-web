import React, { useRef, useEffect, forwardRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { FaPlay } from 'react-icons/fa';
import LoadingSpinnerVideoPlayer from '../loading/loading-spiner-video-player';
import VideoControlsOverlay from './video-controls';
import ProgresswatchNotification from './progress-watch-notification';
import { isTouchDevice, requestVideoFullscreen } from 'utils/mobile-fullscreen';
import { createAdFilteringPlaylistLoader } from 'lib/hls-ad-filter';
import { useHlsController } from 'hooks/useHlsController';
import { useAudioProcessing } from 'hooks/useAudioProcessing';
import type {
  NextEpisodePreview,
  PlayerMeta,
  PlayerProviderOption,
  PlayerServer,
  PlayerSubtitleOption,
} from './video-controls/player-context';

/** Resume-prompt data, surfaced as a top-center card inside the player. */
export type ResumePrompt = {
  show: boolean;
  position: number;
  episodeIndex: number;
  isMultiEpisode: boolean;
  onAccept: () => void;
  onReject: () => void;
};

type VideoPlayerProps = {
  videoUrl: string;
  /**
   * Start playback as soon as the stream is ready, without a second press.
   *
   * Set when the player is opened from a Play button elsewhere on the page
   * (the detail page's "Watch", the carousel's "Watch now"). The viewer has
   * already made the decision, so the pre-play poster must not ask again —
   * it would otherwise demand a second press after the resolver finishes,
   * which is the pause the viewer actually notices.
   *
   * Left off for a cold load of `/movies/watch/<slug>`, where the poster is
   * the first thing the viewer sees and is the right thing to show.
   */
  autoPlay?: boolean;
  thumbnail: string;
  /** Responsive candidates for `thumbnail` (TMDB backdrops), when available. */
  thumbnailSrcSet?: string;
  videoProgress: number | null;
  meta: PlayerMeta;
  resume: ResumePrompt;

  // Phase 2 — passes through to VideoControlsOverlay
  servers: PlayerServer[];
  currentServerIndex: number;
  onSwitchLanguage: (newServerIndex: number) => void;
  nextEpisode: NextEpisodePreview | null;
  onNextEpisode: () => void;

  /**
   * Catalogue subtitle tracks. Rendered as `<track>` children of the <video>,
   * which is the only place they can live — the controls overlay deliberately
   * does not own the element's markup.
   */
  subtitles?: PlayerSubtitleOption[];

  // Server (aggregator provider) selection — passes through to the overlay.
  playbackProviders: PlayerProviderOption[];
  currentPlaybackProviderId: string | null;
  onSelectPlaybackProvider: (id: string | null) => void;
  /**
   * The stream could not be loaded (manifest/network error, or the native
   * player gave up). The watch page decides what to do: retry, another
   * server, or the fallback source.
   */
  onFatalError?: (detail: string) => void;
};

/**
 * One loader class for the app's lifetime. hls.js instantiates it per
 * request, so a module-level class costs nothing and keeps the config
 * object stable across re-inits.
 */
const AdFilteringPlaylistLoader = createAdFilteringPlaylistLoader();

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      videoUrl,
      autoPlay = false,
      thumbnail,
      thumbnailSrcSet,
      videoProgress,
      meta,
      resume,
      servers,
      currentServerIndex,
      onSwitchLanguage,
      nextEpisode,
      onNextEpisode,
      subtitles = [],
      playbackProviders,
      currentPlaybackProviderId,
      onSelectPlaybackProvider,
      onFatalError,
    },
    videoRef
  ) => {
    const overlay = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Quality / audio-track / subtitle-track lists, read straight off hls.js.
    const hls = useHlsController();
    // Equaliser + loudness maximiser, on the Web Audio graph.
    const audio = useAudioProcessing(videoRef as React.RefObject<HTMLVideoElement | null>);
    const [isCanPlay, setIsCanPlay] = useState<boolean>(false);
    // Becomes true on first user interaction with the pre-play poster. Until
    // then, the custom controls overlay stays disabled so the poster + FaPlay
    // CTA owns the surface (matches the previous UX).
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    // Guards the auto-start so it fires once per stream. Reset whenever the
    // stream changes, so an episode or language switch auto-starts too.
    const autoStarted = useRef(false);
    const onFatalErrorRef = useRef(onFatalError);
    onFatalErrorRef.current = onFatalError;

    const getVideo = useCallback(() => {
      return videoRef && 'current' in videoRef ? videoRef.current : null;
    }, [videoRef]);

    // Stable identity for `hls.attach`, so the HLS-init effect does not tear
    // down and rebuild the stream on every render.
    const hlsRef = useRef(hls.attach);
    hlsRef.current = hls.attach;

    // Initialize HLS — reruns only when videoUrl changes (not tied to videoProgress)
    useEffect(() => {
      if (!videoUrl) return;
      const video = getVideo();
      if (!video) return;

      setIsCanPlay(false);
      autoStarted.current = false;
      // Only reset hasStarted when there's no pending resume. A language
      // switch sets `videoProgress` to the previous currentTime to preserve
      // playback context — in that case we want to skip the poster.
      if (!videoProgress) setHasStarted(false);
      overlay.current?.classList.remove('hidden');

      let hls: Hls | null = null;
      let detachHls: (() => void) | null = null;
      const onNativeError = () => onFatalErrorRef.current?.('native media error');
      if (Hls.isSupported()) {
        // The catalog splices a video ad into its playlists; the custom playlist
        // loader cuts it out before hls.js parses them (lib/hls-ad-filter).
        hls = new Hls({ pLoader: AdFilteringPlaylistLoader });
        detachHls = hlsRef.current(hls);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Decoder hiccups are usually recoverable in place.
            hls?.recoverMediaError();
            return;
          }
          onFatalErrorRef.current?.(`${data.type}:${data.details}`);
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (older iOS). The ad filter can't reach this path.
        video.src = videoUrl;
        video.addEventListener('error', onNativeError);
      }

      return () => {
        video.removeEventListener('error', onNativeError);
        detachHls?.();
        hls?.destroy();
        if (video.src || hls) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
        overlay.current?.classList.remove('hidden');
      };
      // videoProgress is intentionally not a dep — checked once at setup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoUrl, getVideo]);

    // Seek + autoplay when videoProgress is set (user accepts resume or
    // language switch). Split effect to avoid HLS re-init.
    useEffect(() => {
      if (!videoProgress || videoProgress <= 0) return;
      const video = getVideo();
      if (!video) return;

      const applyProgress = () => {
        video.currentTime = videoProgress;
        video.play().catch(() => {});
        overlay.current?.classList.add('hidden');
        setHasStarted(true);
      };

      if (video.readyState >= 2) {
        applyProgress();
      } else {
        video.addEventListener('canplay', applyProgress, { once: true });
        return () => video.removeEventListener('canplay', applyProgress);
      }
    }, [videoProgress, getVideo]);

    // Auto-start for an externally-triggered open. Waits for the stream to be
    // genuinely playable rather than firing at mount, so `play()` is not
    // rejected for lack of data — that rejection is what would strand the
    // viewer on the poster and force the second press this exists to remove.
    useEffect(() => {
      if (!autoPlay || autoStarted.current) return;
      const video = getVideo();
      if (!video || !videoUrl) return;
      if (video.readyState < 3 && !isCanPlay) return;

      autoStarted.current = true;
      video
        .play()
        .then(() => {
          overlay.current?.classList.add('hidden');
          setHasStarted(true);
          // Mirror the manual Play path: on touch, the press that opened the
          // player also lands it in fullscreen-landscape.
          if (isTouchDevice()) requestVideoFullscreen(containerRef.current, video);
        })
        .catch(() => {
          // Refused (e.g. a cold load with no user activation yet). Hand the
          // poster CTA back so the viewer is never stuck on a silent still.
          autoStarted.current = false;
        });
    }, [autoPlay, isCanPlay, videoUrl, getVideo]);

    const handleCanPlayThrough = useCallback(() => {
      setIsCanPlay(true);
    }, []);

    const handlePlayVideo = () => {
      const video = getVideo();
      video?.play();
      overlay.current?.classList.add('hidden');
      setHasStarted(true);
      // Mobile: tapping Play enters fullscreen-landscape (this runs inside the
      // tap gesture, so the fullscreen request is allowed). Orientation lock is
      // handled centrally on `fullscreenchange` in usePlayerState.
      if (isTouchDevice()) requestVideoFullscreen(containerRef.current, video);
    };

    useEffect(() => {
      const video = getVideo();
      if (!video) return;

      video.addEventListener('canplaythrough', handleCanPlayThrough);
      return () => video.removeEventListener('canplaythrough', handleCanPlayThrough);
    }, [handleCanPlayThrough, getVideo]);

    return (
      // `isolate` creates a new stacking context so the overlay's internal
      // z-indexes (controls z-10, poster z-20, next-ep z-20, resume prompt
      // z-30, settings z-30, help z-40, lock z-40) stay scoped to the player.
      // The resume prompt sits at z-30 so it stays visible above the pre-play
      // poster (z-20) during the poster phase.
      //
      // The frame itself is upstream's player shell verbatim: full-bleed on a
      // phone, a rounded 2xl card from `sm` up, with the same 1px edge and
      // shadow. `overflow-hidden` is what lets the corners clip the video.
      <div
        ref={containerRef}
        className="on-artwork relative isolate aspect-video w-full overflow-hidden border-y border-line bg-black shadow-2xl sm:rounded-2xl sm:border"
      >
        <video
          ref={videoRef}
          playsInline
          // Required for the equaliser. `createMediaElementSource` outputs
          // SILENCE for a cross-origin element unless the element itself
          // requested the media with CORS — so without this attribute
          // `useAudioProcessing` detects the muted graph and disables the EQ
          // entirely ("unavailable"). The catalogue's CDN answers with
          // `access-control-allow-origin: *`, so the request succeeds.
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full"
        >
          {/* Catalogue subtitles. `default` is left off every track: the
              overlay decides which one shows (and remembers it), so the
              element must not pick one itself. */}
          {subtitles.map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={track.src}
              srcLang={track.lang}
              label={track.label}
            />
          ))}
        </video>

        <VideoControlsOverlay
          videoRef={videoRef as React.RefObject<HTMLVideoElement | null>}
          containerRef={containerRef}
          meta={meta}
          servers={servers}
          currentServerIndex={currentServerIndex}
          onSwitchLanguage={onSwitchLanguage}
          nextEpisode={nextEpisode}
          onNextEpisode={onNextEpisode}
          hls={hls}
          audio={audio}
          playbackProviders={playbackProviders}
          currentPlaybackProviderId={currentPlaybackProviderId}
          onSelectPlaybackProvider={onSelectPlaybackProvider}
          subtitles={subtitles}
          disabled={!hasStarted}
        />

        {/* Pre-play poster + spinner. Sits above the controls overlay (z-20)
            until the user clicks Play. Then it hides via classList. */}
        <div
          ref={overlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black"
        >
          <img
            src={thumbnail}
            srcSet={thumbnailSrcSet}
            sizes={thumbnailSrcSet ? '100vw' : undefined}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          {isCanPlay ? (
            <FaPlay
              className="absolute z-10 cursor-pointer text-ink-primary transition-all duration-200 hover:scale-125"
              size={40}
              onClick={handlePlayVideo}
            />
          ) : (
            <LoadingSpinnerVideoPlayer />
          )}
          <div className="absolute inset-0 bg-red-600 opacity-5"></div>
        </div>

        {/* Resume prompt — top-center, above the poster. Stays inside the
            player surface instead of floating over the page. */}
        <ProgresswatchNotification
          show={resume.show}
          position={resume.position}
          episodeIndex={resume.episodeIndex}
          isMultiEpisode={resume.isMultiEpisode}
          onAccept={resume.onAccept}
          onReject={resume.onReject}
        />
      </div>
    );
  }
);

// Set a display name for the component
VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
