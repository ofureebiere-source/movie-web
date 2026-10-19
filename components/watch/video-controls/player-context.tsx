'use client';

import { createContext, useContext } from 'react';
import type { PlayerActions, PlayerState } from 'hooks/usePlayerState';
import type { HlsController } from 'hooks/useHlsController';
import type { AudioController } from 'hooks/useAudioProcessing';

/**
 * Local PlayerContext — scoped INSIDE <VideoPlayer>. Lives and dies with the
 * player instance. Not a global app context. Avoids prop-drilling through
 * ~8 sub-components without polluting the wider app state.
 */
export interface PlayerMeta {
  title: string;
  /** Human label for the current episode, e.g. "Ep 3". Empty for single-episode films. */
  episodeLabel?: string;
}

/**
 * server (= language variant). Passed in from the watch page so
 * the in-player Audio/Language menu can switch among them while preserving
 * `currentTime`.
 */
export interface PlayerServer {
  name: string;
  /** Episode count in this server. Used to clamp episodeIndex on switch. */
  episodeCount: number;
}

export interface NextEpisodePreview {
  /** 0-based index in the current server. */
  index: number;
  label: string;
  thumbnail: string;
}

/** How the video fills the player box. */
export type FitMode = 'contain' | 'cover';

/** Subtitle appearance, applied to the native cue box via CSS variables. */
export interface SubtitleStyle {
  /** Font scale, 0.75–2. */
  scale: number;
  /** Cue background strength, 0–1. */
  background: number;
  /** Vertical position, 0 (bottom) – 1 (top). */
  position: number;
}

export interface PlayerContextValue {
  state: PlayerState;
  actions: PlayerActions;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  meta: PlayerMeta;

  // ---- Phase 2: server / episode / preferences ----
  /** List of servers (Vietsub / Thuyết Minh / …) for the language menu. */
  servers: PlayerServer[];
  /** Currently active server index. */
  currentServerIndex: number;
  /** Switch language while preserving currentTime + clamping episodeIndex. */
  onSwitchLanguage: (newServerIndex: number) => void;
  /** Next episode preview (null when on the last episode). */
  nextEpisode: NextEpisodePreview | null;
  /** Triggered by NextEpisodeCard countdown end and by the N keyboard shortcut. */
  onNextEpisode: () => void;
  /** Persisted preference: auto-advance when an episode ends. */
  autoPlayNext: boolean;
  setAutoPlayNext: (v: boolean) => void;

  // ---- Phase 2: lock screen ----
  isLocked: boolean;
  setIsLocked: (v: boolean) => void;

  // ---- Phase 3: quality / tracks / fit / subtitles ----
  /**
   * hls.js's own rendition + track lists. Empty for native HLS and the backup
   * iframe, which is what the settings menu uses to decide whether to offer
   * the panels at all.
   */
  hls: HlsController;
  /** How the video fills the box: letterboxed (`contain`) or cropped (`cover`). */
  fitMode: FitMode;
  setFitMode: (mode: FitMode) => void;
  /** Subtitle appearance, shared with the CSS applied to the cue box. */
  subtitleStyle: SubtitleStyle;
  setSubtitleStyle: (style: Partial<SubtitleStyle>) => void;
  /** Skip the intro/recap, when the title declares one. Null hides the button. */
  skipSegment: { label: string; end: number } | null;
  /** Live one-line status for screen readers (announces state changes). */
  liveMessage: string;

  // ---- Phase 3: audio processing (equaliser + loudness) ----
  /** Graphic EQ + volume maximiser, driven by the Web Audio graph. */
  audio: AudioController;

  // ---- Server (aggregator provider) selection ----
  /**
   * The upstream servers this title can be resolved through. Empty when the
   * registry could not be read, which hides the picker rather than showing an
   * empty one.
   */
  playbackProviders: PlayerProviderOption[];
  /** The pinned server id, or null to let the aggregator choose. */
  currentPlaybackProviderId: string | null;
  /** Pin a server (or null to unpin). Re-resolves the current episode. */
  onSelectPlaybackProvider: (id: string | null) => void;
}

/** One selectable upstream server. */
export interface PlayerProviderOption {
  id: string;
  name: string;
  /** The provider's own one-line description, e.g. "4K Ultra Multi-Server". */
  tagline?: string;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  value,
  children,
}: {
  value: PlayerContextValue;
  children: React.ReactNode;
}) {
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer() must be called inside <PlayerProvider>');
  }
  return ctx;
}
