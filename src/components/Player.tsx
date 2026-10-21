import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AudioLines,
  Cast,
  Check,
  Download,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Server,
  Settings,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Subtitles,
  Tv,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  AUDIO_BOOST_PRESETS,
  readAspectRatio,
  readAudioBoost,
  readAutoplayNext,
  readEqualizer,
  readSubtitlePreferences,
  saveAspectRatio,
  saveAudioBoost,
  saveAutoplayNext,
  saveEqualizer,
  saveSubtitlePreferences,
  getDownloadInfo,
  type AspectRatio,
  type AudioBoost,
  type SubtitleBgOpacity,
  type SubtitleFontSize,
  type SubtitlePosition,
  type SubtitleTextColor,
} from '@/lib/playerPreferences';
import { applyAudioProcessing, EQ_BANDS, EQ_DEFAULT, EQ_PRESETS, resumeAudio } from '@/lib/audioEngine';
import { createCachingFragmentLoader, prefetchPlaylist } from '@/lib/segmentCache';
import { parseSubtitles, shiftCues, subtitleUrl, type ParsedCue } from '@/lib/subtitles';
import { useCast } from '@/hooks/useCast';
import { useHolder } from '@/hooks/HolderContext';
import TokenGateModal, { type TokenGateMode } from '@/components/TokenGateModal';
import { downloadUrlFor, isNetwebEnabled, proxiedUrl } from '@/lib/netweb';
import {
  downloadFilename,
  qualitiesFromSource,
  subtitleFilename,
  type DownloadQuality,
} from '@/lib/downloadOptions';
import { vidboltEmbedUrl, isBackupProvider } from '@/lib/vidbolt';
import SeekBar from '@/components/SeekBar';
import { formatTime } from '@/lib/watchProgress';
import type { FxProvider, FxStreamSource, FxSubtitle } from '@/lib/api';

/**
 * The video player.
 *
 * Ported from frameXTV.xyz's `Player` chunk, with the parts our port had
 * stubbed out now actually wired:
 *
 *  - Subtitles are fetched through the backend's subtitle proxy, parsed into
 *    cues and drawn by an overlay we control. Handing a cross-origin
 *    `application/x-subrip` URL to `<track src>` renders nothing, which is why
 *    the reference proxies and parses instead. In-stream tracks, uploaded
 *    `.srt`/`.vtt` files, a sync offset and auto-advance to the next working
 *    track are supported.
 *  - Audio boost builds the reference's Web Audio graph for real. On top of it
 *    sits our own ten-band equaliser with presets and a pre-amp.
 *  - Switching servers re-requests the stream from the chosen provider and
 *    re-seeks to the same playhead, instead of only swapping between the
 *    qualities of whichever provider answered first.
 */

const CONTROLS_TIMEOUT = 3000;

const ASPECT_CLASS: Record<AspectRatio, string> = {
  auto: '',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '21:9': 'aspect-[21/9]',
  '1:1': 'aspect-square',
};

const FONT_PX: Record<SubtitleFontSize, string> = {
  sm: '14px',
  md: '17px',
  lg: '22px',
  xl: '28px',
  '3xl': '36px',
};

const TEXT_COLOR: Record<SubtitleTextColor, string> = {
  white: '#ffffff',
  yellow: '#facc15',
  cyan: '#22d3ee',
};

const BG_COLOR: Record<SubtitleBgOpacity, string> = {
  none: 'transparent',
  semi: 'rgba(0,0,0,0.45)',
  solid: '#000000',
  dark: 'rgba(0,0,0,0.85)',
};

export interface PlayerProps {
  src?: string;
  sourceType?: string;
  /**
   * The source the Download button saves.
   *
   * This is the gateway's own stream, not `src`: `src` is already a `/proxy`
   * URL, which returns HLS with rewritten segment URLs and is not a file to
   * hand to the browser. `/v1/download` fetches the upstream stream itself and
   * remuxes it. When absent the button falls back to `src`.
   */
  downloadSource?: { url: string; type?: string; headers?: Record<string, string> };
  /**
   * Every quality the gateway resolved, for the Download row's picker.
   *
   * The player only plays the first source, so without this the save would be
   * locked to whatever quality happened to be first. When empty the row falls
   * back to `downloadSource` alone.
   */
  downloadQualities?: DownloadQuality[];
  /** Title year, so the saved file is named `Movie (2024) 1080p.mp4`. */
  year?: string;
  poster?: string;
  title?: string;
  subtitles?: FxSubtitle[];
  sources?: FxStreamSource[];
  activeSourceIndex?: number;
  onSelectSource?: (index: number) => void;
  /** The aggregator's provider list, for the in-player server switcher. */
  providers?: FxProvider[];
  activeProvider?: string;
  onSelectProvider?: (provider: string | undefined) => void;
  connecting?: boolean;
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  startTime?: number;
  autoPlay?: boolean;
  /** `controls=0` in the embed URL: render the video only, no chrome. */
  hideControls?: boolean;
  /** `muted=1`: start muted, as browsers require for unmuted autoplay. */
  startMuted?: boolean;
  /** `speed=1.25`: initial playback rate. */
  initialSpeed?: number;
  /** Title identifiers, used to build the Vidbolt backup-player URL. */
  mediaType?: 'movie' | 'tv' | 'anime';
  tmdbId?: string;
  season?: number;
  episode?: number;
  anilistId?: string;
  malId?: string;
  /** Whether the fallback player should auto-advance to the next episode. */
  autoNext?: boolean;
}

type Menu = 'none' | 'settings' | 'subs' | 'eq' | 'servers' | 'cast';

export default function Player({
  src,
  sourceType,
  downloadSource,
  downloadQualities = [],
  year,
  poster,
  title,
  subtitles = [],
  sources = [],
  activeSourceIndex = 0,
  onSelectSource,
  providers = [],
  activeProvider,
  onSelectProvider,
  connecting = false,
  onProgress,
  onEnded,
  onNext,
  onPrev,
  startTime = 0,
  autoPlay = true,
  hideControls = false,
  startMuted = false,
  initialSpeed = 1,
  mediaType = 'movie',
  tmdbId,
  season = 1,
  episode = 1,
  anilistId,
  malId,
  autoNext = true,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const resumeApplied = useRef(false);
  const lastReport = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const seekAfterReload = useRef(0);
  const failoverCount = useRef(0);
  // Stall recovery. `stallLast` is the playhead at the previous watchdog tick
  // and `stallTicks` counts consecutive ticks it has not moved; `resumePoll`
  // holds the pending buffer-resume timer, and `hlsInstance` lets the watchdog
  // reach the live hls.js instance to recover without a server switch.
  const stallLast = useRef(0);
  const stallTicks = useRef(0);
  const resumePoll = useRef<number | null>(null);
  const hlsInstance = useRef<{ recoverMediaError: () => void; startLoad: () => void } | null>(null);
  // hls.js recovery budget, reset whenever the stream proves healthy (manifest
  // parsed / fragment loaded). Ported from the reference: a transient network
  // blip is retried in place before the viewer is moved to another server.
  const hlsNetworkRetry = useRef(0);
  const hlsMediaRetry = useRef(0);
  // Tap-to-seek gesture state: how many taps the current gesture has seen and
  // on which side, plus the timers that reset it and clear the indicator.
  const tapRef = useRef<{ last: number; side: 'left' | 'right' | null; count: number }>({
    last: 0,
    side: null,
    count: 0,
  });
  const tapResetTimer = useRef<number | null>(null);
  const indicatorTimer = useRef<number | null>(null);
  const bufferingSince = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(startMuted);
  const [volume, setVolume] = useState(startMuted ? 0 : 1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  // True once the current source has produced a frame. Drives the staged
  // loading overlay: before the first frame the viewer sees the connect stages,
  // after it they only see the light buffering spinner.
  const [hasStarted, setHasStarted] = useState(false);
  // The reference splits "the source answered" from "frames are flowing": once
  // metadata has loaded but before the first frame it shows a second stage,
  // "Analyzing stream & audio channels...". `analyzing` is that window.
  const [analyzing, setAnalyzing] = useState(false);
  const [buffered, setBuffered] = useState<Array<[number, number]>>([]);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<Menu>('none');
  // Mirrors `menu` for callbacks that must not re-create on every menu change
  // (notably the auto-hide timer).
  const menuRef = useRef<Menu>('none');
  // Named in the staged loading overlay ("Connecting to …").
  const activeProviderEntry = activeProvider ? providers.find((entry) => entry.id === activeProvider) : undefined;

  const [prefs, setPrefs] = useState(() => readSubtitlePreferences());
  const [aspect, setAspect] = useState<AspectRatio>(() => readAspectRatio());
  const [boost, setBoost] = useState<AudioBoost>(() => readAudioBoost());
  const [autoplayNext, setAutoplayNext] = useState(() => readAutoplayNext());
  const [playbackRate, setPlaybackRate] = useState(initialSpeed);
  const [eq, setEq] = useState(() => readEqualizer());

  // --- subtitles -----------------------------------------------------------

  const [trackIndex, setTrackIndex] = useState<number | null>(null);
  const [cues, setCues] = useState<ParsedCue[]>([]);
  const [uploaded, setUploaded] = useState<{ label: string; cues: ParsedCue[] } | null>(null);
  const [subSync, setSubSync] = useState(0);
  const [subError, setSubError] = useState<string | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<string | null>(null);
  const [bufferElapsed, setBufferElapsed] = useState(0);
  // A transient "switching servers" notice, shown while an automatic failover
  // is in flight so the hop is visible without looking like an error.
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);

  // --- casting, backup player, holder perks --------------------------------

  const { holderStatus, connect: connectWallet } = useHolder();
  const [tokenGate, setTokenGate] = useState<TokenGateMode | null>(null);
  // The fallback iframe is engaged either by an explicit `backup` provider or
  // automatically once every native server has been walked without a source.
  const [useVidbolt, setUseVidbolt] = useState(() => isBackupProvider(activeProvider));
  useEffect(() => {
    if (isBackupProvider(activeProvider)) setUseVidbolt(true);
    else if (activeProvider) setUseVidbolt(false);
  }, [activeProvider]);

  const vidboltUrl = useMemo(
    () => vidboltEmbedUrl({ mediaType, tmdbId, season, episode, anilistId, malId, autoPlay, startTime, autoNext }),
    [mediaType, tmdbId, season, episode, anilistId, malId, autoPlay, startTime, autoNext]
  );

  const downloadInfo = getDownloadInfo(src ? { url: src, type: sourceType } : null);

  /**
   * The qualities the viewer can save.
   *
   * The player plays one source, but the gateway resolved several — one per
   * quality — and the picker offers all of them. When the caller supplies none
   * (the aggregator path, or an embed with no gateway) the row falls back to
   * the single source it does have.
   */
  const [qualityKey, setQualityKey] = useState<string>('');
  /**
   * Qualities read off the stream itself when the caller supplied none.
   *
   * The API does not always describe a source per quality — an aggregator
   * source is one master playlist that already lists every rendition. Probing
   * it client-side is what puts a real quality pill in front of the viewer on
   * that path instead of a lone `Auto`, and each pill saves its own rendition.
   */
  const [probedQualities, setProbedQualities] = useState<DownloadQuality[]>([]);

  const qualityProbeSource = downloadSource ?? (src ? { url: src, type: sourceType } : null);

  useEffect(() => {
    // Nothing to probe when the caller already listed the qualities.
    if (downloadQualities.length || !qualityProbeSource?.url) {
      setProbedQualities([]);
      return;
    }
    let cancelled = false;
    // Read through the gateway when one is configured: the CDN may require a
    // Referer, or may not send CORS headers at all, and the proxy supplies both.
    const fetchUrl = isNetwebEnabled() ? proxiedUrl(qualityProbeSource) : undefined;
    void qualitiesFromSource(qualityProbeSource, fetchUrl).then((found) => {
      if (!cancelled) setProbedQualities(found);
    });
    return () => {
      cancelled = true;
    };
  }, [downloadQualities.length, qualityProbeSource?.url, qualityProbeSource?.type]);

  const qualities = useMemo<DownloadQuality[]>(() => {
    if (downloadQualities.length) return downloadQualities;
    // The master playlist's own renditions beat the single fallback entry.
    if (probedQualities.length) return probedQualities;
    const source = downloadSource ?? (src ? { url: src, type: sourceType } : null);
    if (!source?.url) return [];
    return [
      {
        key: 'auto',
        height: 0,
        label: 'Auto',
        size: 0,
        sizeLabel: '',
        url: source.url,
        type: source.type,
        headers: source.headers,
      },
    ];
  }, [downloadQualities, probedQualities, downloadSource, src, sourceType]);

  // Follow the list: the first entry is the best resolution, which is what the
  // viewer expects to be preselected, and a re-resolve (new provider, new
  // episode) replaces the list wholesale.
  useEffect(() => {
    if (!qualities.length) {
      setQualityKey('');
      return;
    }
    setQualityKey((current) =>
      qualities.some((entry) => entry.key === current) ? current : qualities[0].key
    );
  }, [qualities]);

  const selectedQuality =
    qualities.find((entry) => entry.key === qualityKey) ?? qualities[0] ?? null;

  /** Whether an English subtitle track is worth asking the gateway for. */
  const hasEnglishSubs = useMemo(
    () =>
      subtitles.some((track) => {
        const code = (track.lang || track.language || '').toLowerCase();
        const label = (track.label || '').toLowerCase();
        return code.startsWith('en') || code === 'eng' || label.includes('english');
      }),
    [subtitles]
  );

  /** Title identifiers, so the gateway can look the English track up itself. */
  const downloadIdentifiers = useMemo(
    () => ({
      tmdbId: mediaType === 'anime' ? undefined : tmdbId,
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      season: mediaType === 'tv' ? season : undefined,
      episode: mediaType === 'tv' ? episode : undefined,
      title: title || undefined,
      year: year ? String(year) : undefined,
    }),
    [mediaType, tmdbId, season, episode, title, year]
  );

  /**
   * The name the device's save dialog shows, e.g. `Movie Name (2024) 1080p.mp4`.
   *
   * Built from the title and the chosen quality rather than left to the
   * gateway's default, so the dialog names the file the viewer picked instead
   * of offering a generic `video.mp4`.
   */
  const saveName = useMemo(
    () =>
      downloadFilename({
        title,
        year,
        season,
        episode,
        quality: selectedQuality?.label,
        isTv: mediaType === 'tv',
      }),
    [title, year, season, episode, selectedQuality, mediaType]
  );

  /**
   * What the Download button saves, and how.
   *
   * The gateway's `/v1/download` remuxes an HLS stream to a single MP4 with
   * ffmpeg and returns it as an attachment, so a plain navigation saves the
   * file. That is the whole path: no wallet, no holder perk, no client-side
   * downloader. The `downloadSource` is the upstream stream (not the `/proxy`
   * URL the player itself loads), because the gateway must fetch the segments
   * itself to remux them.
   *
   * The title's English track is embedded when one exists, so the saved file
   * arrives with subtitles rather than bare.
   */
  const saveUrl = useMemo(() => {
    if (!selectedQuality?.url || isBackupProvider(activeProvider)) return null;
    if (isNetwebEnabled() && downloadSource) {
      return downloadUrlFor(selectedQuality, saveName, {
        subtitles: hasEnglishSubs,
        subLang: 'en',
        identifiers: downloadIdentifiers,
      });
    }
    // No gateway: only a plain file container can be saved directly.
    return downloadInfo.canDownload ? downloadInfo.downloadUrl ?? null : null;
  }, [
    selectedQuality,
    downloadSource,
    saveName,
    hasEnglishSubs,
    downloadIdentifiers,
    downloadInfo,
    activeProvider,
  ]);

  /**
   * The English sidecar the save was muxed with, so a player that will not read
   * an embedded track can still fetch the matching `.srt`.
   */
  const subtitleSaveName = hasEnglishSubs ? subtitleFilename(saveName, 'en') : '';

  /**
   * Why the Download row is disabled.
   *
   * With the gateway in play the row's state is `saveUrl`, not
   * `getDownloadInfo`'s verdict — that helper only understands direct files and
   * calls an HLS playlist "in private preview". Reporting its reason next to a
   * disabled row would name the wrong cause, so the gateway's own reason is
   * used whenever it is the one that would have served the save.
   */
  const downloadBlockedReason =
    isNetwebEnabled() && downloadSource
      ? 'The gateway could not resolve a saveable stream for this title.'
      : downloadInfo.reason;

  const cast = useCast(videoRef, {
    onRemoteTimeUpdate: (time, duration) => {
      setCurrent(time);
      if (duration) setDuration(duration);
      onProgress?.(time, duration);
    },
    onRemotePlayStateChange: (playing) => setPlaying(playing),
    onRemoteVolumeChange: (level, isMuted) => {
      setVolume(level);
      setMuted(isMuted);
    },
    onCastDisconnected: (time) => {
      const video = videoRef.current;
      if (video && time > 0) {
        video.currentTime = time;
        seekAfterReload.current = time;
      }
    },
  });

  const activeTrack = trackIndex !== null ? subtitles[trackIndex] : undefined;

  // A provider switch returns a fresh subtitle list, and the old index then
  // points into it — a different language, or past the end entirely. The menu
  // labels a track "In-Stream", so the selection has to follow the list: match
  // the same language if it is still offered, otherwise drop to Off. This is
  // the bug where subtitles did not match the movie after changing servers.
  const trackListKey = subtitles.map((track) => `${track.language || track.lang || ''}|${track.url}`).join(';');
  const lastTrackListKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastTrackListKey.current;
    lastTrackListKey.current = trackListKey;
    if (previous === null || previous === trackListKey) return;

    setTrackIndex((index) => {
      if (index === null) return null;
      const wanted = subtitles[index];
      if (!wanted) return null;
      const language = (wanted.language || wanted.lang || '').toLowerCase();
      if (!language) return null;
      const match = subtitles.findIndex(
        (entry) => (entry.language || entry.lang || '').toLowerCase() === language
      );
      return match >= 0 ? match : null;
    });
    // A track from the old server cannot be trusted to line up with the new
    // stream, so the offset resets with it.
    setSubSync(0);
  }, [trackListKey, subtitles]);

  // Fetch and parse the selected track. `<track src>` cannot be used: the
  // hosts answer with SRT and no usable cross-origin track semantics, so the
  // browser renders nothing. Proxy + parse is the reference's approach.
  useEffect(() => {
    if (uploaded || !activeTrack?.url) {
      if (!uploaded) setCues([]);
      return;
    }
    let cancelled = false;
    setSubError(null);
    const url = subtitleUrl(activeTrack.url);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Subtitle fetch failed: ${response.status}`);
        return response.text();
      })
      .then((body) => {
        if (cancelled) return;
        if (body.includes('Error') && body.length < 100) throw new Error('Invalid subtitle response body');
        const parsed = parseSubtitles(body);
        if (parsed.length === 0) throw new Error('Zero valid cues parsed');
        setCues(parsed);
        failoverCount.current = 0;
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.warn(`Subtitle load error for "${activeTrack.label}":`, reason);
        setSubError('This subtitle track could not be loaded.');
        // Advance to the next track in the same language, twice at most, so a
        // dead host does not turn into an endless shuffle.
        if (failoverCount.current < 2 && subtitles.length > 1) {
          failoverCount.current += 1;
          const lang = (activeTrack.language || activeTrack.lang || 'en').toLowerCase().slice(0, 2);
          let next = subtitles.findIndex(
            (entry, index) =>
              index > (trackIndex ?? -1) &&
              (entry.language || entry.lang || 'en').toLowerCase().startsWith(lang)
          );
          if (next <= (trackIndex ?? -1)) next = (trackIndex ?? 0) + 1;
          if (next < subtitles.length) setTrackIndex(next);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTrack, trackIndex, uploaded, subtitles]);

  // Cues are shifted at render time so changing the offset refetches nothing.
  const shiftedCues = useMemo(
    () => (uploaded ? uploaded.cues : shiftCues(cues, subSync)),
    [uploaded, cues, subSync]
  );
  const activeCue = shiftedCues.find((cue) => current >= cue.start && current <= cue.end) ?? null;
  const subtitlesOn = Boolean(uploaded) || trackIndex !== null;

  // --- audio graph ---------------------------------------------------------

  useEffect(() => {
    applyAudioProcessing(videoRef.current, boost, eq);
  }, [boost, eq, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const resume = () => resumeAudio(video);
    video.addEventListener('play', resume);
    return () => video.removeEventListener('play', resume);
  }, [src]);

  // --- buffering recovery --------------------------------------------------

  // Resume from inside the buffer once enough is ahead. The reference polls
  // every 100 ms and waits for 0.5 s of forward buffer, but it only watches the
  // element it was handed. Ours also jumps the sub-second hole that sits
  // *behind* the playhead — the case a seek or a provider hop leaves behind —
  // because that is the one that makes the spinner hang forever.
  const resumeFromBuffer = useCallback((video: HTMLVideoElement, need = 0.5) => {
    if (resumePoll.current !== null) window.clearTimeout(resumePoll.current);
    const tick = () => {
      if (videoRef.current !== video) return;
      for (let i = 0; i < video.buffered.length; i += 1) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);
        // Straddling the playhead: nudge across a hole no more than half a
        // second wide, then wait for the forward buffer to fill.
        if (video.currentTime < start && start - video.currentTime <= 0.5) {
          video.currentTime = start + 0.02;
        }
        if (video.currentTime >= start && video.currentTime <= end && end - video.currentTime >= need) {
          setBuffering(false);
          void video.play().catch(() => undefined);
          return;
        }
      }
      resumePoll.current = window.setTimeout(tick, 100);
    };
    tick();
  }, []);

  // --- source wiring -------------------------------------------------------

  // A fresh source list means a fresh start: a new title, or the viewer picked
  // a provider themselves, so the failover budget is restored. Automatic hops
  // between sources do not change this list, so their counter persists.
  useEffect(() => {
    failoverCount.current = 0;
    setFailoverNotice(null);
  }, [sources]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setHasStarted(false);
    setAnalyzing(false);
    resumeApplied.current = false;

    const restore = () => {
      if (seekAfterReload.current > 0) {
        video.currentTime = seekAfterReload.current;
        seekAfterReload.current = 0;
      }
      if (autoPlay) void video.play().catch(() => undefined);
    };

    const isHls = sourceType === 'hls' || /\.m3u8(\?|$)/i.test(src);

    // Prefer hls.js for HLS whenever MSE is available, rather than deferring to
    // the browser's native support. Chromium answers `canPlayType` for
    // `application/vnd.apple.mpegurl` without really supporting it, so the old
    // `&& !video.canPlayType(...)` guard took the native path there — which
    // bypassed this module's caching loader and prefetcher entirely, leaving
    // every seek network-bound. hls.js is supported on every browser we target
    // (Safari included); the native path below remains for the rest.
    if (isHls) {
      // hls.js is loaded lazily; only an HLS stream on a browser without
      // native support pays for it.
      let destroy: (() => void) | null = null;
      let stopPrefetch: (() => void) | null = null;
      let cancelled = false;
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          video.src = src;
          video.addEventListener('loadeddata', restore, { once: true });
          return;
        }
        // Segments are cached in Cache Storage so a rewind or a scrub back
        // into a region already played is served from disk, not the network.
        // hls.js types the constructor as the full `Loader` class (it also
        // carries `context`/`stats` fields our subclass never touches), so the
        // cast is on the constructor, not on the config.
        const CachingLoader = createCachingFragmentLoader(
          Hls as unknown as Parameters<typeof createCachingFragmentLoader>[0]
        ) as unknown as typeof Hls.DefaultConfig.fLoader;
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          // Buffer sizing follows the "netflix" profile: a minute of forward
          // buffer with a two-minute ceiling, and two minutes retained behind
          // the playhead. It is a deliberate middle ground — the reference's
          // 30 s forward / 30 s back cap is what made every seek feel
          // network-bound, while our old 300 s / 600 s targets let a single
          // title balloon to hundreds of megabytes of MSE memory. Anything
          // older than the back buffer is still served from Cache Storage by
          // the fragment loader below, so neither direction of seek has to hit
          // the network after the prefetcher has run.
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 120,
          maxBufferSize: 60 * 1000 * 1000,
          startFragPrefetch: true,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 3,
          // Ported from the reference's player config: start on the first
          // level, sit out the small gaps a provider leaves at a segment
          // boundary, and keep the ABR estimates conservative so a momentary
          // dip does not trigger a needless downshift.
          startLevel: -1,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          abrEwmaFastLive: 2,
          abrEwmaSlowLive: 6,
          abrBandWidthFactor: 0.9,
          abrBandWidthUpFactor: 0.7,
          fragLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 800,
          fragLoadingMaxRetryTimeout: 12000,
          fLoader: CachingLoader,
        });
        hlsInstance.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          restore();
          // The manifest is in: if playback was waiting for buffer, poll until
          // there is enough ahead and resume, rather than leaving the spinner
          // up. Resets the recovery budget — the stream is demonstrably alive.
          hlsNetworkRetry.current = 0;
          hlsMediaRetry.current = 0;
          if (autoPlay) resumeFromBuffer(video);
        });
        // A fragment that made it through resets the recovery budget, so a
        // single blip early in the stream does not exhaust the retries.
        hls.on(Hls.Events.FRAG_LOADED, () => {
          hlsNetworkRetry.current = 0;
          hlsMediaRetry.current = 0;
        });
        // Once a level's playlist is loaded, mirror the whole thing into Cache
        // Storage in the background. This is what makes a scrub forward into an
        // unwatched region, and any later rewind past the memory buffer, local
        // rather than network-bound: after playback starts the only remaining
        // traffic is this prefetcher finishing the file. Live playlists are
        // skipped — they are a sliding window, so there is nothing to complete.
        hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
          if (data.details.live || stopPrefetch) return;
          const url = data.details.url;
          if (!url) return;
          void prefetchPlaylist(url).then((stop) => {
            if (cancelled) stop();
            else stopPrefetch = stop;
          });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          // Fatal errors are tiered, ported from the reference: a network blip
          // is retried in place, a media error is recovered on the existing
          // instance, and only an exhausted budget moves the viewer to another
          // server. This is what stops a one-second hiccup from costing the
          // whole stream.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hlsNetworkRetry.current < 2) {
            hlsNetworkRetry.current += 1;
            window.setTimeout(() => hls.startLoad(), 1000);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsMediaRetry.current < 2) {
            hlsMediaRetry.current += 1;
            hls.recoverMediaError();
            return;
          }
          if (!autoFailover()) {
            setError(`Playback error: ${data.details || 'unknown'}`);
          }
        });
        destroy = () => {
          hlsInstance.current = null;
          hls.destroy();
        };
      });
      return () => {
        cancelled = true;
        stopPrefetch?.();
        destroy?.();
      };
    }

    video.src = src;
    video.addEventListener('loadeddata', restore, { once: true });
    return undefined;
  }, [src, sourceType, autoPlay, resumeFromBuffer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, volume);
    video.muted = muted;
  }, [volume, muted]);

  // Mirror the video element's buffered ranges into state so the seek bar can
  // draw them. `progress` fires as the buffer fills; `timeupdate` is also
  // listened to because a seek can change which range is buffered without a
  // progress event.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      const ranges: Array<[number, number]> = [];
      for (let i = 0; i < video.buffered.length; i += 1) {
        ranges.push([video.buffered.start(i), video.buffered.end(i)]);
      }
      setBuffered(ranges);
    };
    sync();
    video.addEventListener('progress', sync);
    video.addEventListener('timeupdate', sync);
    video.addEventListener('loadedmetadata', sync);
    return () => {
      video.removeEventListener('progress', sync);
      video.removeEventListener('timeupdate', sync);
      video.removeEventListener('loadedmetadata', sync);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Never hide the chrome out from under an open menu: the viewer is
      // mid-interaction and the panel would vanish with the bar. The timer is
      // re-armed by whatever closes the menu.
      if (menuRef.current !== 'none') return;
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, CONTROLS_TIMEOUT);
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    []
  );

  // An open menu pins the controls: the panel is anchored to the bar, so the
  // bar must not fade while the viewer is choosing a track or a band. Closing
  // the menu re-arms the ordinary auto-hide timer.
  useEffect(() => {
    menuRef.current = menu;
    if (menu !== 'none') {
      setControlsVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      showControls();
    }
  }, [menu, showControls]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      resumeAudio(video);
      void video.play().catch(() => setError('Autoplay was blocked. Press play to start.'));
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  }, []);

  // --- tap to seek ---------------------------------------------------------

  // Double-tapping a side of the video seeks by 10 s. Tapping again *before*
  // the gesture resets stacks another 10 s and extends the same gesture, so a
  // quick run of taps lands at 20 s, 30 s, 40 s — the YouTube behaviour the
  // reference approximates with a single fixed 10 s hop. The window is the
  // same 320 ms the reference uses.
  const showSeekIndicator = useCallback((delta: number) => {
    setSeekIndicator(delta < 0 ? `◀◀ ${Math.abs(delta)}s` : `${delta}s ▶▶`);
    if (indicatorTimer.current) window.clearTimeout(indicatorTimer.current);
    indicatorTimer.current = window.setTimeout(() => setSeekIndicator(null), 700);
  }, []);

  const handleTap = useCallback(
    (side: 'left' | 'right', event: React.SyntheticEvent) => {
      event.stopPropagation();
      const now = Date.now();
      const withinWindow = tapRef.current.side === side && now - tapRef.current.last < 320;
      const count = withinWindow ? tapRef.current.count + 1 : 1;

      tapRef.current = { last: now, side, count };
      if (tapResetTimer.current) window.clearTimeout(tapResetTimer.current);
      tapResetTimer.current = window.setTimeout(() => {
        tapRef.current = { last: 0, side: null, count: 0 };
      }, 320);

      // A single tap only arms the gesture; the first seek happens on the
      // second tap, matching YouTube (and the reference).
      if (count >= 2) {
        const delta = (side === 'left' ? -10 : 10) * (count - 1);
        seekBy(delta);
        showSeekIndicator(delta);
      }
      showControls();
    },
    [seekBy, showControls, showSeekIndicator]
  );

  useEffect(
    () => () => {
      if (tapResetTimer.current) window.clearTimeout(tapResetTimer.current);
      if (indicatorTimer.current) window.clearTimeout(indicatorTimer.current);
      if (resumePoll.current !== null) window.clearTimeout(resumePoll.current);
    },
    []
  );

  // Buffering can last long enough that a bare spinner reads as "stuck". Once
  // it passes a few seconds, surface how long it has been going and what is
  // happening, so a slow provider is distinguishable from a hung player.
  useEffect(() => {
    if (!buffering) {
      bufferingSince.current = null;
      setBufferElapsed(0);
      return;
    }
    if (bufferingSince.current === null) bufferingSince.current = Date.now();
    const timer = window.setInterval(() => {
      if (bufferingSince.current !== null) {
        setBufferElapsed(Math.floor((Date.now() - bufferingSince.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [buffering]);

  // Picture-in-Picture, ported from the reference's `togglePiP`: flip the
  // document's single PiP element rather than tracking state ourselves, so the
  // button stays correct when the viewer leaves PiP with the browser's own
  // control. `requestPictureInPicture` rejects when the document is not allowed
  // to enter PiP (no user gesture, or a browser that does not support it), so
  // the rejection is swallowed — the button is simply a no-op there.
  const togglePiP = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
      return;
    }
    void video.requestPictureInPicture().catch(() => undefined);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.requestFullscreen?.();
  }, []);

  // --- cast, download, boost ----------------------------------------------

  /** Send the current stream (or the fallback) to a Cast device. */
  const handleCast = useCallback(() => {
    if (cast.isCasting) {
      void cast.stopCasting();
      return;
    }
    const video = videoRef.current;
    if (useVidbolt || !src) {
      // The fallback iframe cannot be mirrored; the reference opens the picker
      // so the viewer can still route the tab's audio/video where supported.
      cast.triggerAirPlay();
      return;
    }
    void cast.triggerChromecast({
      source: { url: src, type: sourceType },
      playableUrl: src,
      mediaTitle: title,
      mediaCategory: mediaType === 'tv' ? 'TV Series' : mediaType === 'anime' ? 'Anime' : 'Movie',
      posterUrl: poster,
      subtitles,
      activeSubtitleIdx: trackIndex,
      currentTime: video?.currentTime ?? startTime,
      autoPlay: true,
    });
  }, [
    cast,
    useVidbolt,
    src,
    sourceType,
    title,
    mediaType,
    poster,
    subtitles,
    trackIndex,
    startTime,
  ]);

  /** Open the token gate when the perk is locked, else run the action. */
  const gateOr = useCallback(
    (allowed: boolean, mode: TokenGateMode, action: () => void) => {
      if (!allowed) {
        setTokenGate(mode);
        return;
      }
      action();
    },
    []
  );

  /**
   * Save the stream. The gateway returns the file as an attachment, so a
   * navigation is the download; there is no gate in front of it.
   */
  const handleDownload = useCallback(() => {
    if (!saveUrl) return;
    const anchor = document.createElement('a');
    anchor.href = saveUrl;
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [saveUrl]);

  const handleSelectAudioBoost = useCallback(
    (preset: AudioBoost) => {
      const entry = AUDIO_BOOST_PRESETS.find((item) => item.id === preset);
      if (entry?.gated) {
        gateOr(holderStatus.canBoostAudio, 'audio_boost', () => {
          setBoost(preset);
          saveAudioBoost(preset);
        });
        return;
      }
      setBoost(preset);
      saveAudioBoost(preset);
    },
    [gateOr, holderStatus.canBoostAudio]
  );

  // Engage the fallback player automatically when no native source is left.
  useEffect(() => {
    if (useVidbolt) return;
    if (sources.length > 0 || src) return;
    if (vidboltUrl) {
      console.info('⚡ All native servers exhausted without sources. Auto-activating backup fallback iframe.');
      setUseVidbolt(true);
    }
  }, [useVidbolt, sources.length, src, vidboltUrl]);

  // Push the local subtitle choice to the receiver while casting.
  useEffect(() => {
    if (!cast.isCasting) return;
    cast.setRemoteActiveSubtitle(trackIndex);
  }, [cast, trackIndex]);

  const selectSource = useCallback(
    (index: number) => {
      const video = videoRef.current;
      // Keep the playhead across a server switch — a new provider means a new
      // stream URL, so the element reloads from zero otherwise.
      if (video && video.currentTime > 1) seekAfterReload.current = video.currentTime;
      onSelectSource?.(index);
    },
    [onSelectSource]
  );

  /**
   * Move to another resolved source after the current one fails.
   *
   * A provider that resolves but then 403s on the first segment, or serves a
   * dead manifest, should not become the viewer's problem. Instead of showing
   * "could not be played, try another server", this hops to the next source on
   * its own and only surfaces an error once every source has been tried.
   *
   * Returns true when a hop was made, false when the sources are exhausted.
   */
  const autoFailover = useCallback((): boolean => {
    if (!onSelectSource || sources.length < 2) return false;
    if (failoverCount.current >= sources.length - 1) return false;
    failoverCount.current += 1;
    const next = (activeSourceIndex + 1) % sources.length;
    const video = videoRef.current;
    if (video && video.currentTime > 1) seekAfterReload.current = video.currentTime;
    // Brief, non-blocking notice so the switch is visible but not a dialog.
    setError(null);
    setFailoverNotice('Switching to another server…');
    onSelectSource(next);
    return true;
  }, [onSelectSource, sources.length, activeSourceIndex]);

  // A stall is not the same as a slow segment. When the playhead has not moved
  // for ten seconds the network is not coming back on its own, so this nudges
  // the buffer, then asks hls.js to recover the media pipeline, and only then
  // hands off to the source failover. The reference's watchdog stops at the
  // nudge; ours escalates because a stalled viewer is already lost.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || buffering) {
        stallTicks.current = 0;
        return;
      }
      if (Math.abs(video.currentTime - stallLast.current) < 0.01) {
        stallTicks.current += 1;
        if (stallTicks.current === 2) {
          // 5 s: the decoder is behind the buffer, so step forward off the hole.
          if (video.buffered.length > 0) video.currentTime += 0.05;
        } else if (stallTicks.current >= 4) {
          stallTicks.current = 0;
          if (hlsInstance.current) hlsInstance.current.recoverMediaError();
          else autoFailover();
        }
      } else {
        stallTicks.current = 0;
        stallLast.current = video.currentTime;
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [buffering, autoFailover]);

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
        case 'j':
          event.preventDefault();
          seekBy(-10);
          break;
        case 'ArrowRight':
        case 'l':
          event.preventDefault();
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

  // --- postMessage SDK -----------------------------------------------------

  // The reference's embed contract, in both directions. Outbound: `ready` on
  // mount and on first play, `timeupdate` on every tick, `ended` at the end,
  // plus an `autoplay_preference` notice when the viewer flips the toggle.
  // Inbound: the documented `action` vocabulary, so a host page can drive the
  // player without touching the DOM.
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ event: 'frameXTV:ready' }, '*');
    }
  }, []);

  // Tell a host page when playback has genuinely failed — every source tried
  // and none worked — so an embedding watch page can hop servers instead of
  // showing the viewer a dead end.
  useEffect(() => {
    if (!error) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ event: 'frameXTV:error', message: error }, '*');
    }
  }, [error]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ event: 'frameXTV:ready' }, '*');
      }
    };
    const onTime = () => {
      if (!window.parent || window.parent === window) return;
      window.parent.postMessage(
        { event: 'frameXTV:timeupdate', currentTime: video.currentTime, duration: video.duration || 0 },
        '*'
      );
    };
    const onEnded = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ event: 'frameXTV:ended' }, '*');
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return;
      const video = videoRef.current;
      const action = data.action;
      switch (action) {
        case 'play':
          resumeAudio(video);
          void video?.play().catch(() => {});
          break;
        case 'pause':
          video?.pause();
          break;
        case 'togglePlay':
          togglePlay();
          break;
        case 'seek':
          if (typeof data.time === 'number' && video) video.currentTime = data.time;
          break;
        case 'seekBy':
          if (typeof data.seconds === 'number') seekBy(data.seconds);
          break;
        case 'setVolume':
          if (typeof data.volume === 'number') {
            const next = Math.max(0, Math.min(1, data.volume));
            setVolume(next);
            setMuted(next === 0);
          }
          break;
        case 'mute':
          setMuted(true);
          break;
        case 'unmute':
          setMuted(false);
          break;
        case 'setProvider':
          if (typeof data.provider === 'string') onSelectProvider?.(data.provider);
          break;
        case 'setSubtitle':
          if (typeof data.index === 'number') setTrackIndex(data.index);
          break;
        case 'setSpeed':
          if (typeof data.speed === 'number') setPlaybackRate(data.speed);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [togglePlay, seekBy, onSelectProvider]);

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

  // --- subtitle track selection --------------------------------------------

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSubtitles(String(reader.result ?? ''));
      if (parsed.length === 0) return;
      setUploaded({ label: file.name.replace(/\.(srt|vtt|ass|ssa)$/i, ''), cues: parsed });
      setTrackIndex(null);
      setMenu('none');
    };
    reader.readAsText(file);
  };

  const selectTrack = (index: number | null) => {
    setUploaded(null);
    setTrackIndex(index);
    failoverCount.current = 0;
    if (index === null) {
      saveSubtitlePreferences({ preferredLanguage: 'off' });
    } else {
      const track = subtitles[index];
      if (track) saveSubtitlePreferences({ preferredLanguage: track.language || track.lang || 'en' });
    }
    setMenu('none');
  };

  // The backup player replaces the whole surface: when every native server is
  // out, the reference hands off to the Vidbolt iframe rather than a dead frame.
  // It is checked before the no-source guard because in backup mode there is no
  // native `src` at all.
  if (useVidbolt && vidboltUrl) {
    return (
      <div
        data-testid="video-player"
        className={`media-surface relative w-full bg-black overflow-hidden ${ASPECT_CLASS[aspect] || 'aspect-video'} group`}
      >
        <iframe
          src={vidboltUrl}
          title={title || 'Backup player'}
          className="w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
        {!hideControls && (
          <button
            type="button"
            onClick={() => setUseVidbolt(false)}
            aria-label="Back to native players"
            className="absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-white/10 text-zinc-300 hover:text-white text-[11px] font-medium backdrop-blur transition-colors cursor-pointer"
          >
            Native player
          </button>
        )}
      </div>
    );
  }

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
      onMouseLeave={() => playing && menuRef.current === 'none' && setControlsVisible(false)}
      className={`media-surface relative w-full bg-black overflow-hidden ${ASPECT_CLASS[aspect] || 'aspect-video'} group`}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full object-contain bg-black"
        onClick={togglePlay}
        onDoubleClick={() => {
          // Native double-click-to-fullscreen is off for the video surface so
          // it does not fight the double-tap-to-seek zones layered over it.
          toggleFullscreen();
        }}
        onPlay={() => {
          setPlaying(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => {
          setBuffering(true);
          const video = videoRef.current;
          if (!video) return;
          // The reference's waiting handler: when playback stops against the
          // edge of a buffered range, step across a small hole so the decoder
          // is never left parked just short of a segment boundary. We then hand
          // off to the resume poll, which waits for real forward buffer.
          for (let i = 0; i < video.buffered.length; i += 1) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            if (video.currentTime < start && start - video.currentTime <= 0.5) {
              video.currentTime = start + 0.02;
              break;
            }
            if (
              video.currentTime >= start &&
              video.currentTime <= end &&
              end - video.currentTime < 0.05 &&
              i + 1 < video.buffered.length
            ) {
              video.currentTime = video.buffered.start(i + 1) + 0.02;
              break;
            }
          }
          resumeFromBuffer(video);
        }}
        onPlaying={() => {
          setBuffering(false);
          setHasStarted(true);
          setAnalyzing(false);
          // Buffer is flowing again, so stop polling for it.
          if (resumePoll.current !== null) {
            window.clearTimeout(resumePoll.current);
            resumePoll.current = null;
          }
          // The current source is genuinely playing, so the failover budget is
          // restored and any "switching servers" notice is dismissed.
          failoverCount.current = 0;
          setFailoverNotice(null);
        }}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setAnalyzing(true);
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
        onError={() => {
          // Try the next resolved source before troubling the viewer. Only when
          // every source has failed does the error overlay appear.
          if (!autoFailover()) {
            setError('This stream could not be played. Try another server.');
          }
        }}
      />

      {/* Double-tap-to-seek zones. The outer thirds seek; the middle third is
          left transparent to the video so a single tap still toggles play and
          a double-click still goes fullscreen. Inset vertically so the zones
          never sit over the control bar or the title. */}
      {!hideControls && (
        <div className="absolute inset-y-16 inset-x-0 flex z-20 pointer-events-none">
          <div
            className="w-1/3 h-full pointer-events-auto cursor-pointer"
            onTouchEnd={(event) => handleTap('left', event)}
            onDoubleClick={(event) => handleTap('left', event)}
          />
          <div className="w-1/3 h-full pointer-events-none" />
          <div
            className="w-1/3 h-full pointer-events-auto cursor-pointer"
            onTouchEnd={(event) => handleTap('right', event)}
            onDoubleClick={(event) => handleTap('right', event)}
          />
        </div>
      )}

      {seekIndicator && (
        <div
          role="status"
          aria-live="polite"
          data-testid="seek-indicator"
          className={`absolute top-1/2 -translate-y-1/2 ${
            seekIndicator.startsWith('◀') ? 'left-4 sm:left-16' : 'right-4 sm:right-16'
          } z-30 flex items-center justify-center p-2.5 sm:p-4 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white font-mono font-bold text-xs sm:text-base animate-fade-in pointer-events-none shadow-2xl`}
        >
          {seekIndicator}
        </div>
      )}

      {/* Center play/pause affordance, shown with the rest of the chrome. */}
      {!hideControls && !error && !buffering && (
        <div
          className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-200 pointer-events-none ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              togglePlay();
            }}
            aria-label={playing ? 'Pause Stream' : 'Play Stream'}
            title={playing ? 'Pause Stream' : 'Play Stream'}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 border border-white/20 hover:border-white/40 backdrop-blur-md cursor-pointer pointer-events-auto"
          >
            {playing ? (
              <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-white" />
            ) : (
              <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-white" />
            )}
          </button>
        </div>
      )}

      {activeCue && subtitlesOn && (
        <div
          data-testid="subtitle-cue"
          aria-live="off"
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center px-3.5 py-1.5 rounded-lg max-w-[88%] font-sans font-medium tracking-wide shadow-2xl"
          style={{
            fontSize: FONT_PX[prefs.fontSize],
            bottom: prefs.position === 'top' ? '80%' : prefs.position === 'mid' ? '75px' : '28px',
            color: TEXT_COLOR[prefs.textColor],
            backgroundColor: BG_COLOR[prefs.bgOpacity],
            textShadow: '0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)',
            lineHeight: 1.35,
          }}
        >
          {activeCue.text.split('\n').map((line, index, all) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < all.length - 1 && <br />}
            </span>
          ))}
        </div>
      )}

      {failoverNotice && !error && (
        <div
          role="status"
          aria-live="polite"
          data-testid="failover-notice"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-mono text-zinc-200 shadow-2xl animate-fade-in"
        >
          <span className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
          {failoverNotice}
        </div>
      )}

      {/* Staged loading overlay, ported from the reference. Before the first
          frame the viewer gets the full "connecting" card — a spinner with the
          fX badge, the provider being contacted, and the establishing line —
          rather than a bare spinner. Once a frame has been shown the overlay
          drops back to the light buffering spinner so a mid-playback stall is
          not mistaken for a fresh load. */}
      {buffering && !error && !hasStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-30 space-y-4 animate-fade-in p-4">
          <div className="relative z-10 flex flex-col items-center space-y-3 p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-white/[0.08] shadow-2xl backdrop-blur-xl max-w-xs sm:max-w-sm w-full text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-rose-500/20 border-t-rose-500 animate-spin" />
              <div className="absolute w-6 h-6 rounded-lg bg-gradient-to-br from-rose-600 to-red-700 text-white font-bold font-mono text-[10px] flex items-center justify-center shadow-lg shadow-rose-500/30 border border-rose-400/30">
                fX
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                {activeProviderEntry ? `Connecting to ${activeProviderEntry.name}` : 'Decrypting Stream'}
              </p>
              <p className="text-[11px] font-mono text-zinc-400 animate-pulse">
                {bufferElapsed >= 3 ? `${bufferElapsed}s — still establishing…` : 'Establishing stream connection...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Second stage, straight from the reference: the source has answered but
          frames have not arrived yet, so the copy moves on to "Analyzing stream
          & audio channels..." instead of repeating the connecting card. */}
      {!hasStarted && analyzing && !error && !buffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-30 space-y-4 animate-fade-in p-4">
          <div className="relative z-10 flex flex-col items-center space-y-3 p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-white/[0.08] shadow-2xl backdrop-blur-xl max-w-xs sm:max-w-sm w-full text-center">
            <div className="w-10 h-10 rounded-full border-2 border-rose-500/20 border-t-rose-500 animate-spin" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-white animate-pulse">
              Analyzing stream &amp; audio channels...
            </p>
          </div>
        </div>
      )}

      {buffering && !error && hasStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none bg-black/20">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          {bufferElapsed >= 3 && (
            <div className="text-center space-y-0.5 px-4 animate-fade-in">
              <p className="text-xs font-semibold text-zinc-200 tracking-wide">Buffering stream…</p>
              <p className="text-[11px] font-mono text-zinc-400">
                {bufferElapsed}s elapsed — try another server if this stalls
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-6 text-center animate-fade-in"
        >
          <div className="flex flex-col items-center space-y-3 sm:space-y-4 p-5 sm:p-8 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl max-w-xs sm:max-w-md w-full">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight">Stream Not Found</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-sans leading-relaxed">{error}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 w-full justify-center">
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
                className="flex items-center justify-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
              {sources.length > 1 && onSelectSource && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    selectSource((activeSourceIndex + 1) % sources.length);
                  }}
                  className="flex items-center justify-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Try Next Source</span>
                </button>
              )}
              {onSelectProvider && providers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMenu('servers')}
                  className="flex items-center justify-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Switch Server</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {title && !hideControls && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{title}</p>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } ${hideControls ? 'hidden' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div className="px-2 sm:px-3 pt-6">
          <SeekBar
            current={current}
            duration={duration}
            buffered={buffered}
            onSeek={(seconds) => {
              const video = videoRef.current;
              if (video) video.currentTime = seconds;
            }}
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
            {connecting && (
              <span className="hidden sm:inline-flex items-center gap-1.5 mr-1 text-[10px] font-mono text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin" />
                connecting…
              </span>
            )}

            {/* Server switcher: re-requests the stream from another provider. */}
            {onSelectProvider && providers.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((prev) => (prev === 'servers' ? 'none' : 'servers'))}
                  aria-label="Switch server"
                  title="Switch server"
                  className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                    activeProvider ? 'text-rose-500' : 'text-white'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </button>
                {menu === 'servers' && (
                  <div className="absolute bottom-full right-0 mb-2 w-[min(16rem,calc(100vw-1.5rem))] max-h-[min(18rem,60vh)] overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-1.5 shadow-2xl">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={!activeProvider}
                      onClick={() => {
                        onSelectProvider(undefined);
                        setMenu('none');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                        !activeProvider ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <span>Auto (best available)</span>
                      {!activeProvider && <Check className="w-3 h-3" />}
                    </button>
                    {providers.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={activeProvider === entry.id}
                        onClick={() => {
                          onSelectProvider(entry.id);
                          setMenu('none');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                          activeProvider === entry.id ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="truncate">
                          {entry.name}
                          {entry.tagline ? ` — ${entry.tagline}` : ''}
                        </span>
                        {activeProvider === entry.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sources.length > 1 && onSelectSource && (
              <div className="hidden sm:flex items-center gap-1 mr-1">
                {sources.slice(0, 4).map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    onClick={() => selectSource(index)}
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

            {/* Subtitles: uploaded file, in-stream tracks, sync offset. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((prev) => (prev === 'subs' ? 'none' : 'subs'))}
                aria-label="Subtitles"
                className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                  subtitlesOn ? 'text-rose-500' : 'text-white'
                }`}
              >
                <Subtitles className="w-4 h-4" />
              </button>
              {menu === 'subs' && (
                <div className="absolute bottom-full right-0 mb-2 w-[min(16rem,calc(100vw-1.5rem))] max-h-[min(18rem,60vh)] overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-1.5 shadow-2xl">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={!subtitlesOn}
                    onClick={() => selectTrack(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                      !subtitlesOn ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <span>Off</span>
                    {!subtitlesOn && <Check className="w-3 h-3" />}
                  </button>

                  {uploaded && (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked
                      onClick={() => setMenu('none')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] bg-white text-black font-bold flex items-center justify-between"
                    >
                      <span className="truncate">{uploaded.label} (Uploaded)</span>
                      <Check className="w-3 h-3" />
                    </button>
                  )}

                  {subtitles.map((track, index) => (
                    <button
                      key={`${track.url}-${index}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={trackIndex === index}
                      onClick={() => selectTrack(index)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                        trackIndex === index ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="truncate">
                        {track.label || track.lang || `Track ${index + 1}`} (In-Stream)
                      </span>
                      {trackIndex === index && <Check className="w-3 h-3" />}
                    </button>
                  ))}

                  {subError && <p className="px-2.5 py-1 text-[10px] text-amber-400">{subError}</p>}

                  <div className="border-t border-zinc-800/80 pt-1 mt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenu('none');
                        fileInput.current?.click();
                      }}
                      className="w-full text-left px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload .srt / .vtt</span>
                    </button>
                    {subtitlesOn && (
                      <div className="px-2 py-1 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>Sync offset</span>
                          <span className="tabular-nums">
                            {subSync > 0 ? `+${subSync.toFixed(1)}` : subSync.toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSubSync((value) => Math.round((value - 0.5) * 10) / 10)}
                            className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono hover:text-white cursor-pointer"
                          >
                            −0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubSync(0)}
                            className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono hover:text-white cursor-pointer"
                          >
                            reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubSync((value) => Math.round((value + 0.5) * 10) / 10)}
                            className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-mono hover:text-white cursor-pointer"
                          >
                            +0.5s
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".srt,.vtt,text/vtt,application/x-subrip"
                className="hidden"
                onChange={(event) => onUpload(event.target.files?.[0])}
              />
            </div>

            {/* Our own equaliser, on top of the reference's audio boost. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((prev) => (prev === 'eq' ? 'none' : 'eq'))}
                aria-label="Equaliser"
                title="Equaliser"
                className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                  eq.enabled ? 'text-rose-500' : 'text-white'
                }`}
              >
                <AudioLines className="w-4 h-4" />
              </button>
              {menu === 'eq' && (
                <div className="absolute bottom-full right-0 mb-2 w-[min(18rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-2.5 shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3 h-3" /> Equaliser
                    </p>
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eq.enabled}
                        onChange={(event) => {
                          const next = { ...eq, enabled: event.target.checked };
                          setEq(next);
                          saveEqualizer(next);
                        }}
                        className="accent-rose-500 cursor-pointer"
                      />
                      <span>On</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {EQ_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const next = { ...eq, enabled: true, gains: [...preset.gains] };
                          setEq(next);
                          saveEqualizer(next);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...eq, enabled: false, gains: [...EQ_DEFAULT.gains], preamp: 0 };
                        setEq(next);
                        saveEqualizer(next);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      reset
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-0.5 sm:gap-1 h-24 sm:h-28">
                    {EQ_BANDS.map((frequency, index) => (
                      <div key={frequency} className="flex flex-col items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
                        <span className="text-[9px] font-mono text-zinc-500 tabular-nums">
                          {eq.gains[index] > 0 ? `+${eq.gains[index]}` : eq.gains[index]}
                        </span>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={1}
                          value={eq.gains[index]}
                          aria-label={`${frequency} Hz`}
                          // Deliberately not `disabled`: a disabled range never
                          // fires `onChange`, so dragging a band with the EQ off
                          // did nothing. The handler turns the EQ on, which is
                          // the behaviour the panel's copy already promised.
                          onChange={(event) => {
                            const gains = [...eq.gains];
                            gains[index] = Number(event.target.value);
                            const next = { ...eq, enabled: true, gains };
                            setEq(next);
                            saveEqualizer(next);
                          }}
                          className={`accent-rose-500 cursor-pointer ${eq.enabled ? '' : 'opacity-40'}`}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '12px', height: '56px' }}
                        />
                        <span className="text-[9px] font-mono text-zinc-600">
                          {frequency >= 1000 ? `${frequency / 1000}k` : frequency}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">Pre-amp</span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={eq.preamp}
                      aria-label="Pre-amp"
                      // See the band sliders: `disabled` would swallow the very
                      // drag that is meant to switch the EQ on.
                      onChange={(event) => {
                        const next = { ...eq, enabled: true, preamp: Number(event.target.value) };
                        setEq(next);
                        saveEqualizer(next);
                      }}
                      className={`flex-1 accent-rose-500 cursor-pointer ${eq.enabled ? '' : 'opacity-40'}`}
                    />
                    <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-9 text-right">
                      {eq.preamp > 0 ? `+${eq.preamp}` : eq.preamp}dB
                    </span>
                  </div>
                </div>
              )}
            </div>

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
                <div className="absolute bottom-full right-0 mb-2 w-[min(14rem,calc(100vw-1.5rem))] max-h-[min(18rem,60vh)] overflow-y-auto bg-zinc-950/98 border border-zinc-800 rounded-xl p-2 shadow-2xl space-y-2.5">
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Audio boost</p>
                      {!holderStatus.canBoostAudio && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded font-semibold">
                          &gt;150% Gated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {AUDIO_BOOST_PRESETS.map((preset) => {
                        const locked = preset.gated && !holderStatus.canBoostAudio;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            title={preset.boostText}
                            onClick={() => handleSelectAudioBoost(preset.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer inline-flex items-center gap-1 ${
                              boost === preset.id
                                ? 'bg-white text-black font-bold'
                                : locked
                                  ? 'bg-zinc-900 text-zinc-600'
                                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {preset.id === 'dialogue' ? 'dialogue' : preset.id === 'off' ? 'off' : `${preset.id}%`}
                            {locked && <span aria-hidden="true">🔒</span>}
                          </button>
                        );
                      })}
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
                      {(['sm', 'md', 'lg', 'xl', '3xl'] as SubtitleFontSize[]).map((size) => (
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
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Subtitle position</p>
                    <div className="flex flex-wrap gap-1">
                      {(['bottom', 'mid', 'top'] as SubtitlePosition[]).map((position) => (
                        <button
                          key={position}
                          type="button"
                          onClick={() => {
                            setPrefs((prev) => ({ ...prev, position }));
                            saveSubtitlePreferences({ position });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            prefs.position === position ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {position}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Subtitle colour</p>
                    <div className="flex flex-wrap gap-1">
                      {(['white', 'yellow', 'cyan'] as SubtitleTextColor[]).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setPrefs((prev) => ({ ...prev, textColor: color }));
                            saveSubtitlePreferences({ textColor: color });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            prefs.textColor === color ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Subtitle background</p>
                    <div className="flex flex-wrap gap-1">
                      {(['dark', 'semi', 'none', 'solid'] as SubtitleBgOpacity[]).map((opacity) => (
                        <button
                          key={opacity}
                          type="button"
                          onClick={() => {
                            setPrefs((prev) => ({ ...prev, bgOpacity: opacity }));
                            saveSubtitlePreferences({ bgOpacity: opacity });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            prefs.bgOpacity === opacity ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {opacity}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label
                    data-testid="player-autoplay-toggle"
                    className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer pt-0.5"
                  >
                    <span>Autoplay next</span>
                    <input
                      type="checkbox"
                      checked={autoplayNext}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setAutoplayNext(enabled);
                        saveAutoplayNext(enabled);
                        if (window.parent && window.parent !== window) {
                          window.parent.postMessage({ event: 'frameXTV:autoplay_preference', enabled }, '*');
                        }
                      }}
                      className="accent-rose-500 cursor-pointer"
                    />
                  </label>

                  {/* Download: saves through our own gateway, with no holder
                      perk and no token gate in front of it. The qualities the
                      gateway resolved are offered as a horizontally scrolling
                      strip of pills, so the viewer picks the resolution and the
                      size they want before saving rather than getting whichever
                      one happened to resolve first. */}
                  <div
                    data-testid="player-download"
                    className="w-full flex items-center gap-2 p-1.5 rounded-lg"
                  >
                    <button
                      type="button"
                      data-testid="player-download-button"
                      onClick={handleDownload}
                      disabled={!saveUrl}
                      title={
                        saveUrl
                          ? `Download ${saveName}${hasEnglishSubs ? ' (with English subtitles)' : ''}`
                          : downloadBlockedReason
                      }
                      className={`flex items-center gap-2 shrink-0 rounded-lg px-2 py-1 transition-colors ${
                        saveUrl
                          ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer'
                          : 'text-zinc-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Download</span>
                    </button>

                    {saveUrl ? (
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        {/* The pill strip. One entry per resolution, best
                            first, scrolling sideways when they overflow. */}
                        <div
                          data-testid="player-download-qualities"
                          className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth"
                        >
                          {qualities.map((entry) => {
                            const selected = entry.key === selectedQuality?.key;
                            return (
                              <button
                                key={entry.key}
                                type="button"
                                data-testid={`player-download-quality-${entry.key}`}
                                aria-pressed={selected}
                                onClick={() => setQualityKey(entry.key)}
                                title={
                                  entry.sizeLabel
                                    ? `${entry.label} · ${entry.sizeLabel}`
                                    : entry.label
                                }
                                className={`shrink-0 flex flex-col items-center leading-none px-2 py-1 rounded-full border text-[10px] font-mono transition-colors cursor-pointer ${
                                  selected
                                    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
                                    : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                                }`}
                              >
                                <span className="font-bold">{entry.label}</span>
                                {/* What the save will weigh, when the extractor
                                    reported a size for this resolution. */}
                                {entry.sizeLabel && (
                                  <span className="text-[9px] opacity-70 mt-0.5">{entry.sizeLabel}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Whether the English track rides along with the save. */}
                        {hasEnglishSubs && (
                          <span
                            data-testid="player-download-subs"
                            title="The English subtitle track is embedded in the saved file"
                            className="shrink-0 flex items-center gap-1 text-[9px] font-mono text-emerald-400/80"
                          >
                            <Subtitles className="w-3 h-3" />
                            EN
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500 truncate">
                        {downloadInfo.sourceType === 'none'
                          ? 'Unavailable'
                          : downloadInfo.sourceType.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* The exact name the device's save dialog will offer, so the
                      viewer is not surprised by it. */}
                  {saveUrl && (
                    <p
                      data-testid="player-download-filename"
                      className="px-1.5 -mt-0.5 text-[9px] font-mono text-zinc-600 truncate"
                      title={saveName}
                    >
                      {saveName}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Cast to a TV. Shown whenever the Cast framework or AirPlay is
                present; the label flips to a disconnect once connected. */}
            {(cast.isCastAvailable || cast.isAirPlayAvailable) && (
              <button
                type="button"
                onClick={handleCast}
                aria-label={cast.isCasting ? `Disconnect Cast (${cast.castDeviceName})` : 'Cast to TV / Chromecast'}
                title={cast.isCasting ? `Disconnect Cast (${cast.castDeviceName})` : 'Cast to TV / Chromecast'}
                className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                  cast.isCasting ? 'text-rose-500' : 'text-white'
                }`}
              >
                <Cast className="w-4 h-4" />
              </button>
            )}

            {cast.isAirPlayAvailable && (
              <button
                type="button"
                onClick={cast.triggerAirPlay}
                aria-label="AirPlay"
                title="AirPlay"
                className={`p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex ${
                  cast.isAirPlayActive ? 'text-rose-500' : 'text-white'
                }`}
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={togglePiP}
              aria-label="Picture in Picture"
              title="Picture in Picture"
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

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

      {/* While casting, the picture is on the TV; this overlay names the device
          and carries the remote controls the reference exposes. */}
      {cast.isCasting && !hideControls && (
        <div
          role="region"
          aria-label="Casting to"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm text-center px-4"
        >
          <Cast className="w-8 h-8 text-rose-500" />
          <p className="text-sm text-white font-semibold">
            Casting to <span className="text-rose-400">{cast.castDeviceName || 'Chromecast TV'}</span>
          </p>
          <p className="text-[11px] text-zinc-400">Playback is on your TV. Use the controls below.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cast.remotePlayOrPause}
              aria-label={playing ? 'Pause on TV' : 'Play on TV'}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => cast.remoteSeek(Math.max(0, current - 10))}
              aria-label="Back 10 seconds on TV"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cast.remoteSeek(current + 10)}
              aria-label="Forward 10 seconds on TV"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cast.remoteSetVolume(Math.max(0, volume - 0.1))}
              aria-label="Volume down on TV"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <VolumeX className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cast.remoteSetVolume(Math.min(1, volume + 0.1))}
              aria-label="Volume up on TV"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void cast.stopCasting()}
              aria-label="Disconnect Cast"
              className="p-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {tokenGate && <TokenGateModal mode={tokenGate} onClose={() => setTokenGate(null)} />}
    </div>
  );
}
