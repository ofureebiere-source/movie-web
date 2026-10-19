'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerState } from 'hooks/usePlayerState';
import { useAutoHideControls } from 'hooks/useAutoHideControls';
import { useKeyboardShortcuts } from 'hooks/useKeyboardShortcuts';
import { usePlayerPersistence } from 'hooks/usePlayerPersistence';
import { useMobileGestures } from 'hooks/useMobileGestures';
import {
  PlayerProvider,
  type FitMode,
  type NextEpisodePreview,
  type PlayerMeta,
  type PlayerProviderOption,
  type PlayerServer,
  type PlayerSubtitleOption,
  type SubtitleStyle,
} from './player-context';
import type { HlsController } from 'hooks/useHlsController';
import type { AudioController } from 'hooks/useAudioProcessing';
import TopBar from './top-bar';
import CenterControls from './center-controls';
import BottomBar from './bottom-bar';
import BufferingSpinner from './buffering-spinner';
import SettingsMenu from './settings-menu';
import NextEpisodeCard from './next-episode-card';
import LockScreen from './lock-screen';
import KeyboardHint from './keyboard-hint';
import EqualizerPanel from './equalizer-panel';
import { formatTime } from './progress-bar';
import { SkipSegmentIcon, VolumeHighIcon, BrightnessIcon } from './icons';

const DOUBLE_TAP_MS = 280;
const SEEK_FEEDBACK_MS = 600;

export interface VideoControlsOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  meta: PlayerMeta;

  // Phase 2 — server/episode controls
  servers: PlayerServer[];
  currentServerIndex: number;
  onSwitchLanguage: (newServerIndex: number) => void;
  nextEpisode: NextEpisodePreview | null;
  onNextEpisode: () => void;

  /** hls.js rendition / track lists, for the quality and subtitle panels. */
  hls: HlsController;
  /** Equaliser + loudness maximiser controller. */
  audio: AudioController;

  /** Upstream servers the viewer can pin, and the current choice. */
  playbackProviders: PlayerProviderOption[];
  currentPlaybackProviderId: string | null;
  onSelectPlaybackProvider: (id: string | null) => void;

  /** Catalogue subtitle tracks for the current stream. */
  subtitles: PlayerSubtitleOption[];

  /** When true (initial state before stream is ready), overlay sits dormant. */
  disabled?: boolean;
}

/**
 * Custom controls overlay. Renders absolute over the <video> element. Owns the
 * player state, keyboard shortcuts, auto-hide, tap/double-tap gestures,
 * settings menu, next-episode card, mobile gestures, and lock screen.
 *
 * IMPORTANT: this component MUST NOT replace, wrap, or proxy the <video>
 * element. `useVideoProgress` and `useWatchAnalytics` listen directly on the
 * `videoRef` and rely on the element identity being stable.
 */
export default function VideoControlsOverlay({
  videoRef,
  containerRef,
  meta,
  servers,
  currentServerIndex,
  onSwitchLanguage,
  nextEpisode,
  onNextEpisode,
  hls,
  audio,
  playbackProviders,
  currentPlaybackProviderId,
  onSelectPlaybackProvider,
  subtitles,
  disabled = false,
}: VideoControlsOverlayProps) {
  const { state, actions } = usePlayerState(videoRef);
  const { autoPlayNext, setAutoPlayNext, preferredServerName, setPreferredServerName } =
    usePlayerPersistence(videoRef);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  // The EQ lives on the player surface, not in the settings menu.
  const [eqOpen, setEqOpen] = useState(false);

  // ---- Fit mode (letterbox vs crop) --------------------------------------
  // `cover` is for the phone case: a 16:9 box on a 20:9 screen wastes a lot of
  // height on black bars, and viewers would rather lose the edges. Persisted
  // because it is a per-person taste, not a per-title one.
  const [fitMode, setFitModeState] = useState<FitMode>('contain');
  useEffect(() => {
    const saved = window.localStorage.getItem('mw_player_fit');
    if (saved === 'contain' || saved === 'cover') setFitModeState(saved);
  }, []);
  const setFitMode = useCallback((mode: FitMode) => {
    setFitModeState(mode);
    try {
      window.localStorage.setItem('mw_player_fit', mode);
    } catch {
      /* private mode */
    }
  }, []);

  // ---- Subtitle appearance ------------------------------------------------
  const [subtitleStyle, setSubtitleStyleState] = useState<SubtitleStyle>({
    scale: 1,
    background: 0.55,
    position: 0,
  });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('mw_player_subs');
      if (raw) setSubtitleStyleState((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore malformed */
    }
  }, []);
  const setSubtitleStyle = useCallback((patch: Partial<SubtitleStyle>) => {
    setSubtitleStyleState((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem('mw_player_subs', JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  // ---- Catalogue subtitles ------------------------------------------------
  // Which catalogue track is on. Persisted per browser, like the fit mode: it
  // is a preference about the viewer, not about the title. Defaults to the
  // first Vietnamese track when there is one — the app is Vietnamese-first —
  // and otherwise stays off so a foreign track is never forced on.
  const [currentSubtitleId, setCurrentSubtitleIdState] = useState(-1);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem('mw_player_subtitle');
    } catch {
      /* private mode */
    }
    if (saved !== null) {
      const id = Number(saved);
      if (Number.isInteger(id) && (id === -1 || subtitles.some((s) => s.id === id))) {
        setCurrentSubtitleIdState(id);
        return;
      }
    }
    const vi = subtitles.find((s) => s.lang === 'vi');
    setCurrentSubtitleIdState(vi ? vi.id : -1);
    // Only re-derive the default when the track list itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles.map((s) => s.id).join(',')]);

  const setSubtitleId = useCallback((id: number) => {
    setCurrentSubtitleIdState(id);
    try {
      window.localStorage.setItem('mw_player_subtitle', String(id));
    } catch {
      /* private mode */
    }
  }, []);

  // `mode="showing"` on the <track> renders it; the element also needs the
  // matching `textTracks` entry set, which is what actually drives the cue
  // box in every browser we target.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === currentSubtitleId ? 'showing' : 'disabled';
    }
  }, [currentSubtitleId, subtitles, videoRef]);

  // ---- Skip-intro ---------------------------------------------------------
  // Titles do not declare intro ranges in the catalogue, so the window is a
  // conservative heuristic: offer the skip between 20s and 2m30s in, and only
  // on multi-minute content. Wrong guesses are worse than no button, so it
  // errs on the narrow side.
  const skipSegment =
    state.duration > 300 && state.currentTime >= 20 && state.currentTime <= 150
      ? { label: 'Bỏ qua mở đầu', end: 90 }
      : null;

  // Announce only transitions a screen-reader user needs, not every tick.
  const liveMessage = !state.isPlaying
    ? 'Tạm dừng'
    : state.isBuffering
      ? 'Đang tải'
      : state.isEnded
        ? 'Đã kết thúc'
        : `Đang phát ${formatTime(state.currentTime)} trên ${formatTime(state.duration)}`;

  const { brightness, hud, adjusting } = useMobileGestures({
    containerRef,
    state,
    actions,
    enabled: !disabled && !isLocked,
  });

  // A vertical drag is a deliberate adjustment, so the chrome stays up for
  // its duration instead of auto-hiding out from under the meter.
  const { visible, bindContainer } = useAutoHideControls({
    isPlaying: state.isPlaying,
    isBuffering: state.isBuffering,
    isEnded: state.isEnded,
    forceVisible: settingsOpen || helpOpen || eqOpen || adjusting,
  });

  useKeyboardShortcuts({
    containerRef,
    state,
    actions,
    onNextEpisode,
    onToggleHelp: () => setHelpOpen((v) => !v),
  });

  // Apply gesture-driven brightness to the <video> via CSS filter. Real device
  // brightness is not web-accessible — this is a visual approximation.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.style.filter = brightness === 1 ? '' : `brightness(${brightness})`;
  }, [brightness, videoRef]);

  // Fit mode is applied to the element rather than through a wrapper class,
  // because the <video> is rendered by the parent and the overlay must not
  // take over its markup (the progress/analytics hooks key on its identity).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.style.objectFit = fitMode;
  }, [fitMode, videoRef]);

  // Honor preferred-server-name once on mount: if it matches a server name and
  // differs from current, switch automatically. Saves the user from manually
  // re-selecting "Thuyết Minh" every visit.
  const preferredAppliedRef = useRef(false);
  useEffect(() => {
    if (preferredAppliedRef.current) return;
    if (!preferredServerName) return;
    if (servers.length <= 1) return;
    const target = servers.findIndex((s) => s.name === preferredServerName);
    if (target >= 0 && target !== currentServerIndex) {
      onSwitchLanguage(target);
    }
    preferredAppliedRef.current = true;
  }, [preferredServerName, servers, currentServerIndex, onSwitchLanguage]);

  // Save preferred server when user explicitly switches via the in-player menu.
  const handleSwitchLanguage = (index: number) => {
    const target = servers[index];
    if (target) setPreferredServerName(target.name);
    onSwitchLanguage(index);
  };

  // Tap/double-tap state for the click-through layer.
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<'left' | 'right' | null>(null);

  // Hide the native cursor only during ACTIVE idle playback (overlay enabled
  // + controls auto-hidden). When the overlay is disabled (pre-play poster
  // phase between episode switches), the user needs the cursor to find the
  // Play button. Cleanup resets the cursor on unmount so it never gets stuck
  // on `none`.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = disabled || visible ? '' : 'none';
    return () => {
      if (container) container.style.cursor = '';
    };
  }, [visible, disabled, containerRef]);

  if (disabled) return null;

  /**
   * Desktop UX: single click → instant toggle play/pause; double-click → enter
   * fullscreen. To avoid a 280ms delay on every single click (waiting to see
   * if a second click arrives), we toggle on EVERY click. On a real
   * double-click, the second click toggles again — net-zero play state — and
   * then we fire fullscreen. Result: zero perceived delay on single clicks;
   * brief play→pause→play flicker on double-clicks (same pattern as YouTube).
   *
   * Mobile UX: single tap reveals controls (via auto-hide's touchstart
   * binding); double-tap → ±10s seek with ripple. No "tap to toggle" on
   * mobile because users would accidentally pause when trying to dismiss
   * controls.
   */
  const handleTapSurface = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if (e.target !== e.currentTarget) return;

    const now = performance.now();
    const last = lastTapRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    const isDouble =
      last !== null &&
      now - last.time < DOUBLE_TAP_MS &&
      Math.abs(x - last.x) < 40 &&
      Math.abs(y - last.y) < 40;

    if (isDouble) {
      lastTapRef.current = null;
      if (e.pointerType === 'touch') {
        // Mobile: zone-based seek (first tap did nothing — nothing to undo).
        const isLeft = x - rect.left < rect.width / 2;
        actions.seekBy(isLeft ? -10 : 10);
        setSeekFlash(isLeft ? 'left' : 'right');
        setTimeout(() => setSeekFlash(null), SEEK_FEEDBACK_MS);
      } else {
        // Desktop: enter fullscreen. The first click already toggled play/
        // pause — undo it here so net play state is preserved.
        actions.toggle();
        actions.toggleFullscreen(containerRef.current);
      }
      return;
    }

    lastTapRef.current = { time: now, x, y };
    if (e.pointerType !== 'touch') {
      // Instant desktop toggle. No delay.
      actions.toggle();
    }
  };

  const contextValue = {
    state,
    actions,
    videoRef,
    containerRef,
    meta,
    servers,
    currentServerIndex,
    onSwitchLanguage: handleSwitchLanguage,
    nextEpisode,
    onNextEpisode,
    autoPlayNext,
    setAutoPlayNext,
    isLocked,
    setIsLocked,
    hls,
    fitMode,
    setFitMode,
    subtitleStyle,
    setSubtitleStyle,
    subtitles,
    currentSubtitleId,
    setSubtitleId,
    skipSegment,
    liveMessage,
    audio,
    playbackProviders,
    currentPlaybackProviderId,
    onSelectPlaybackProvider,
  };

  return (
    <PlayerProvider value={contextValue}>
      {/* Applies the viewer's subtitle sizing/placement to the native cue box.
          CSS variables on the container are the only lever the spec gives for
          styling ::cue from outside a stylesheet. */}
      <style>{`
        .nw-player video::cue {
          font-size: ${Math.round(subtitleStyle.scale * 100)}%;
          background-color: rgba(0, 0, 0, ${subtitleStyle.background});
          line-height: 1.35;
        }
      `}</style>
      <div
        className="absolute inset-0 z-10 select-none"
        onPointerDown={handleTapSurface}
        {...bindContainer}
      >
        {/* Screen-reader status. Visually hidden but always mounted, so the
            announcement is not swallowed by a late mount. */}
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>

        {/* Skip-intro, when the heuristic fires. Bottom-right, above the bar. */}
        {skipSegment && !isLocked && (
          <button
            type="button"
            onClick={() => actions.seek(skipSegment.end)}
            className="pointer-events-auto absolute bottom-24 right-4 z-20 flex items-center gap-2 rounded-md border border-white/25 bg-black/75 px-3 py-2 text-sm font-semibold text-ink-primary backdrop-blur-sm transition-colors hover:bg-black/90 lg:bottom-28 lg:right-6"
          >
            <SkipSegmentIcon size={16} />
            {skipSegment.label}
          </button>
        )}
        {/* Gesture HUD. A vertical drag shows a side-anchored meter — the
            side you touched is the side it appears on, which is what makes the
            gesture self-explanatory. A horizontal drag keeps the centred
            time readout. */}
        {hud && hud.kind === 'scrub' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg bg-black/70 px-4 py-2 text-sm font-semibold text-ink-primary backdrop-blur-sm">
              <span className="tabular-nums">{formatTime(hud.targetTime)}</span>
              <span className="ml-2 text-ink-secondary tabular-nums">
                {hud.delta >= 0 ? '+' : '−'}
                {Math.abs(Math.round(hud.delta))}s
              </span>
            </div>
          </div>
        )}
        {hud && (hud.kind === 'volume' || hud.kind === 'brightness') && (
          <div
            className={`pointer-events-none absolute inset-y-0 flex items-center ${
              hud.kind === 'volume' ? 'right-0 pr-5' : 'left-0 pl-5'
            }`}
          >
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/70 px-3 py-3 backdrop-blur-sm">
              {hud.kind === 'volume' ? (
                <VolumeHighIcon size={18} className="text-ink-primary" />
              ) : (
                <BrightnessIcon size={18} className="text-ink-primary" />
              )}
              {/* Meter. Fills from the bottom; the tick marks make a small
                  change visible even when the bar barely moves. */}
              <div className="relative h-32 w-2.5 overflow-hidden rounded-full bg-white/25">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-full bg-brand transition-[height] duration-75"
                  style={{
                    height: `${Math.round(
                      (hud.kind === 'volume' ? hud.value : (hud.value - 0.3) / 1.2) * 100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-ink-primary">
                {Math.round(hud.value * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Double-tap seek-ripple */}
        {seekFlash && (
          <div
            className={`pointer-events-none absolute inset-y-0 flex items-center justify-center ${
              seekFlash === 'left' ? 'left-0 w-1/2' : 'right-0 w-1/2'
            }`}
          >
            <div className="rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-ink-primary backdrop-blur-sm">
              {seekFlash === 'left' ? '−10s' : '+10s'}
            </div>
          </div>
        )}

        {/* Controls chrome. `pointer-events-none` on the wrapper lets clicks on
            the empty middle area (and on the top/bottom gradient backgrounds)
            pass through to the tap surface for click-anywhere-to-toggle. The
            actual buttons inside set `pointer-events-auto` to stay clickable. */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out-expo ${
            visible && !isLocked ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <TopBar />
          {/* Center controls hidden during buffering so the spinner has the
              stage to itself (and not behind the play button). */}
          {!state.isBuffering && (!state.isPlaying || visible) && <CenterControls />}
          <BottomBar
            onOpenSettings={() => {
              setEqOpen(false);
              setSettingsOpen(true);
            }}
            onToggleEqualizer={() => {
              setSettingsOpen(false);
              setEqOpen((v) => !v);
            }}
            equalizerOpen={eqOpen}
          />
        </div>

        {/* Buffering spinner rendered AFTER the chrome so it sits on top in
            source order. Pointer-events-none keeps it from blocking taps. */}
        <BufferingSpinner />

        <NextEpisodeCard />
        <EqualizerPanel open={eqOpen} onClose={() => setEqOpen(false)} />
        <SettingsMenu
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onShowShortcuts={() => setHelpOpen(true)}
        />
        <KeyboardHint open={helpOpen} onClose={() => setHelpOpen(false)} />
        <LockScreen />
      </div>
    </PlayerProvider>
  );
}
