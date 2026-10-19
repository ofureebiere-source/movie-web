import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AUDIO_BOOSTS,
  readAspectRatio,
  readAudioBoost,
  readAutoplayNext,
  readSubtitlePreferences,
  saveAspectRatio,
  saveAudioBoost,
  saveAutoplayNext,
  saveSubtitlePreferences,
  type AspectRatio,
  type AudioBoost,
} from '@/lib/playerPreferences';
import { formatTime } from '@/lib/watchProgress';
import type { FxStreamSource, FxSubtitle } from '@/lib/api';

/**
 * The video player.
 *
 * Ported 1:1 from frameXTV.xyz's `Player` chunk: a native `<video>` element
 * (not an iframe) fed either an HLS playlist through hls.js or a progressive
 * MP4, with a bottom control bar (play/pause, -10s, +10s, next, volume, the
 * current time / duration, aspect ratio, audio boost, subtitle picker, quality,
 * fullscreen), keyboard shortcuts, and a resume prompt. The
 * `playerPreferences` values are the same keys the reference persists.
 */

const CONTROLS_TIMEOUT = 3000;

const ASPECT_CLASS: Record<AspectRatio, string> = {
  auto: '',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '21:9': 'aspect-[21/9]',
  '1:1': 'aspect-square',
};

export interface PlayerProps {
  src?: string;
  sourceType?: string;
  poster?: string;
  title?: string;
  subtitles?: FxSubtitle[];
  sources?: FxStreamSource[];
  activeSourceIndex?: number;
  onSelectSource?: (index: number) => void;
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  startTime?: number;
  autoPlay?: boolean;
}

export default function Player({
  src,
  sourceType,
  poster,
  title,
  subtitles = [],
  sources = [],
  activeSourceIndex = 0,
  onSelectSource,
  onProgress,
  onEnded,
  onNext,
  onPrev,
  startTime = 0,
  autoPlay = true,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const resumeApplied = useRef(false);
  const lastReport = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<'none' | 'settings' | 'subs' | 'speed'>('none');

  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [prefs, setPrefs] = useState(() => readSubtitlePreferences());
  const [aspect, setAspect] = useState<AspectRatio>(() => readAspectRatio());
  const [boost, setBoost] = useState<AudioBoost>(() => readAudioBoost());
  const [autoplayNext, setAutoplayNext] = useState(() => readAutoplayNext());
  const [playbackRate, setPlaybackRate] = useState(1);

  // --- source wiring -------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    resumeApplied.current = false;

    const isHls = sourceType === 'hls' || /\.m3u8(\?|$)/i.test(src);

    if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
      // hls.js is loaded lazily; only an HLS stream on a browser without
      // native support pays for it.
      let destroy: (() => void) | null = null;
      let cancelled = false;
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          video.src = src;
          return;
        }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError(`Playback error: ${data.details || 'unknown'}`);
        });
        destroy = () => hls.destroy();
      });
      return () => {
        cancelled = true;
        destroy?.();
      };
    }

    video.src = src;
    return undefined;
  }, [src, sourceType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, volume);
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, CONTROLS_TIMEOUT);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError('Autoplay was blocked. Press play to start.'));
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.requestFullscreen?.();
  }, []);

  // --- keyboard shortcuts --------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          seekBy(-10);
          break;
        case 'ArrowRight':
          seekBy(10);
          break;
        case 'j':
          seekBy(-10);
          break;
        case 'l':
          seekBy(10);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          setMuted((prev) => !prev);
          break;
        default:
          break;
      }
      showControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, toggleFullscreen, showControls]);

  // --- progress reporting --------------------------------------------------

  const report = useCallback(
    (seconds: number, total: number) => {
      if (!onProgress || !total) return;
      const now = Date.now();
      // The reference throttles writes to one every 4 s.
      if (now - lastReport.current < 4000) return;
      lastReport.current = now;
      onProgress(seconds, total);
    },
    [onProgress]
  );

  const totalHours = Math.floor(duration / 3600);
  const progressPercent = duration > 0 ? (current / duration) * 100 : 0;

  if (!src) {
    return (
      <div className="w-full aspect-video bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
            <Play className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-xs font-mono text-zinc-500">No playable source found for this title.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      data-testid="video-player"
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className={`relative w-full bg-black overflow-hidden ${ASPECT_CLASS[aspect] || 'aspect-video'} group`}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full object-contain bg-black"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration || 0);
          if (!resumeApplied.current && startTime > 15) {
            resumeApplied.current = true;
            video.currentTime = startTime;
          }
          if (autoPlay) void video.play().catch(() => undefined);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrent(video.currentTime);
          report(video.currentTime, video.duration || 0);
        }}
        onEnded={() => {
          const video = videoRef.current;
          if (video) report(video.duration || 0, video.duration || 0);
          if (autoplayNext && onNext) onNext();
          else onEnded?.();
        }}
        onError={() => setError('This stream could not be played. Try another server.')}
      >
        {subtitleIndex >= 0 && subtitles[subtitleIndex] && (
          <track
            key={subtitles[subtitleIndex].url}
            kind="subtitles"
            src={subtitles[subtitleIndex].url}
            srcLang={subtitles[subtitleIndex].lang || subtitles[subtitleIndex].language || 'en'}
            label={subtitles[subtitleIndex].label || 'Subtitles'}
            default
          />
        )}
      </video>

      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-sm text-center space-y-3">
            <p className="text-sm font-semibold text-white">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                const video = videoRef.current;
                if (video && src) {
                  video.load();
                  void video.play().catch(() => undefined);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {title && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{title}</p>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-2 sm:px-3 pt-6">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={current}
            onChange={(event) => {
              const video = videoRef.current;
              if (video) video.currentTime = Number(event.target.value);
            }}
            aria-label="Seek"
            className="w-full h-1 accent-rose-500 cursor-pointer"
            style={{ backgroundSize: `${progressPercent}% 100%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-1 px-2 sm:px-3 py-2">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous episode"
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next episode"
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted((prev) => !prev)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
            >
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                setVolume(Number(event.target.value));
                setMuted(Number(event.target.value) === 0);
              }}
              aria-label="Volume"
              className="w-16 sm:w-20 accent-white cursor-pointer hidden sm:block"
            />
            <span className="text-[11px] font-mono text-zinc-300 pl-1 tabular-nums">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            {sources.length > 1 && onSelectSource && (
              <div className="hidden sm:flex items-center gap-1 mr-1">
                {sources.slice(0, 4).map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    onClick={() => onSelectSource(index)}
                    title={source.server || source.quality}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      index === activeSourceIndex
                        ? 'bg-white text-black font-bold'
                        : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    }`}
                  >
                    {source.quality || `S${index + 1}`}
                  </button>
                ))}
              </div>
            )}

            {subtitles.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((prev) => (prev === 'subs' ? 'none' : 'subs'))}
                  aria-label="Subtitles"
                  className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
                {menu === 'subs' && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 max-h-64 overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSubtitleIndex(-1);
                        setMenu('none');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      Off
                    </button>
                    {subtitles.map((subtitle, index) => (
                      <button
                        key={`${subtitle.url}-${index}`}
                        type="button"
                        onClick={() => {
                          setSubtitleIndex(index);
                          saveSubtitlePreferences({ preferredLanguage: subtitle.lang || null });
                          setMenu('none');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer truncate ${
                          index === subtitleIndex ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        {subtitle.label || subtitle.lang || `Track ${index + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((prev) => (prev === 'settings' ? 'none' : 'settings'))}
                aria-label="Settings"
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
              {menu === 'settings' && (
                <div className="absolute bottom-full right-0 mb-2 w-52 bg-zinc-950/98 border border-zinc-800 rounded-xl p-2 shadow-2xl space-y-2.5">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Aspect ratio</p>
                    <div className="flex flex-wrap gap-1">
                      {(['auto', '16:9', '4:3', '21:9', '1:1'] as AspectRatio[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setAspect(option);
                            saveAspectRatio(option);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            aspect === option ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Audio boost</p>
                    <div className="flex flex-wrap gap-1">
                      {AUDIO_BOOSTS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setBoost(option);
                            saveAudioBoost(option);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            boost === option ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {option === 'dialogue' ? 'dialogue' : option === 'off' ? 'off' : `${option}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Speed</p>
                    <div className="flex flex-wrap gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setPlaybackRate(rate)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            playbackRate === rate ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {rate}×
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Subtitle size</p>
                    <div className="flex flex-wrap gap-1">
                      {(['sm', 'md', 'lg', 'xl', '3xl'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setPrefs((prev) => ({ ...prev, fontSize: size }));
                            saveSubtitlePreferences({ fontSize: size });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            prefs.fontSize === size ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer pt-0.5">
                    <span>Autoplay next</span>
                    <input
                      type="checkbox"
                      checked={autoplayNext}
                      onChange={(event) => {
                        setAutoplayNext(event.target.checked);
                        saveAutoplayNext(event.target.checked);
                      }}
                      className="accent-rose-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Subtitle styling is driven by the persisted preferences. */}
      <style>{`
        video::cue {
          font-size: ${{ sm: '0.75rem', md: '0.9rem', lg: '1.1rem', xl: '1.4rem', '3xl': '2rem' }[prefs.fontSize] || '0.9rem'};
          color: ${prefs.textColor === 'yellow' ? '#fde047' : prefs.textColor === 'cyan' ? '#67e8f9' : '#ffffff'};
          background-color: ${prefs.bgOpacity === 'solid' ? 'rgba(0,0,0,1)' : prefs.bgOpacity === 'dark' ? 'rgba(0,0,0,0.7)' : prefs.bgOpacity === 'semi' ? 'rgba(0,0,0,0.4)' : 'transparent'};
        }
      `}</style>
    </div>
  );
}
