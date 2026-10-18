'use client';

import { useCallback, useRef, useState } from 'react';
import Hls from 'hls.js';

/**
 * Bridges the hls.js instance into React state, so the controls overlay can
 * offer quality, audio-track and subtitle-track selection.
 *
 * hls.js owns those three lists and mutates them as it parses the manifest;
 * nothing in React can see them otherwise, because the instance is created
 * inside `video-player.tsx` and never leaves that effect. `attach()` subscribes
 * to the events that change them and mirrors the result into state; `detach()`
 * drops the listeners when the stream is torn down.
 *
 * Non-HLS playback (native Safari HLS, or the vidsrc iframe) simply never
 * attaches, and every list stays empty — the menus then hide themselves rather
 * than offering switches that cannot work.
 */

export interface MediaTrackOption {
  /** hls.js track id. `-1` is reserved for "Auto" / "Off". */
  id: number;
  label: string;
}

export interface HlsCapabilities {
  /** Video quality rungs. Empty when the manifest has a single rendition. */
  levels: MediaTrackOption[];
  /** Selected rung, or -1 for automatic (ABR). */
  currentLevel: number;
  /** Alternate audio tracks (dubs). Empty when the manifest has one. */
  audioTracks: MediaTrackOption[];
  currentAudioTrack: number;
  /** Subtitle tracks. Empty when the manifest has none. */
  subtitleTracks: MediaTrackOption[];
  /** Selected subtitle track, or -1 when subtitles are off. */
  currentSubtitleTrack: number;
  /** True once an hls.js instance is driving the element. */
  attached: boolean;
}

const EMPTY: HlsCapabilities = {
  levels: [],
  currentLevel: -1,
  audioTracks: [],
  currentAudioTrack: -1,
  subtitleTracks: [],
  currentSubtitleTrack: -1,
  attached: false,
};

/** Human label for a quality rung: "1080p" when the height is known, else the bitrate. */
function levelLabel(level: { height?: number; bitrate?: number; name?: string }): string {
  if (level.name) return level.name;
  if (level.height) return `${level.height}p`;
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`;
  return '—';
}

/** Human label for an audio/subtitle track: "Tiếng Việt (vie)" style. */
function trackLabel(track: { name?: string; lang?: string }): string {
  const name = track.name?.trim();
  const lang = track.lang?.trim();
  if (name && lang && name.toLowerCase() !== lang.toLowerCase()) return `${name} (${lang})`;
  return name || lang || '—';
}

export interface HlsController extends HlsCapabilities {
  /** Register the instance created by the player. Returns a detach function. */
  attach: (hls: Hls) => () => void;
  setLevel: (id: number) => void;
  setAudioTrack: (id: number) => void;
  setSubtitleTrack: (id: number) => void;
}

export function useHlsController(): HlsController {
  const hlsRef = useRef<Hls | null>(null);
  const [caps, setCaps] = useState<HlsCapabilities>(EMPTY);

  const attach = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    const sync = () => {
      if (hlsRef.current !== hls) return;
      setCaps({
        attached: true,
        levels: hls.levels.map((l, i) => ({ id: i, label: levelLabel(l) })),
        currentLevel: hls.autoLevelEnabled ? -1 : hls.currentLevel,
        audioTracks: (hls.audioTracks ?? []).map((t, i) => ({ id: i, label: trackLabel(t) })),
        currentAudioTrack: hls.audioTrack,
        subtitleTracks: (hls.subtitleTracks ?? []).map((t, i) => ({ id: i, label: trackLabel(t) })),
        // hls.js reports the off state as track id -1 (or 0 with display off
        // on some builds), so normalise on `subtitleDisplay` too.
        currentSubtitleTrack: hls.subtitleDisplay ? hls.subtitleTrack : -1,
      });
    };

    hls.on(Hls.Events.MANIFEST_PARSED, sync);
    hls.on(Hls.Events.LEVEL_SWITCHED, sync);
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, sync);
    hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, sync);
    sync();

    return () => {
      if (hlsRef.current === hls) hlsRef.current = null;
      hls.off(Hls.Events.MANIFEST_PARSED, sync);
      hls.off(Hls.Events.LEVEL_SWITCHED, sync);
      hls.off(Hls.Events.AUDIO_TRACK_SWITCHED, sync);
      hls.off(Hls.Events.SUBTITLE_TRACK_SWITCH, sync);
      setCaps(EMPTY);
    };
  }, []);

  const setLevel = useCallback((id: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    // `-1` re-enables ABR; a concrete id pins the rung.
    hls.currentLevel = id;
    setCaps((c) => ({ ...c, currentLevel: id }));
  }, []);

  const setAudioTrack = useCallback((id: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = id;
    setCaps((c) => ({ ...c, currentAudioTrack: id }));
  }, []);

  const setSubtitleTrack = useCallback((id: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (id < 0) {
      hls.subtitleDisplay = false;
      hls.subtitleTrack = -1;
    } else {
      hls.subtitleDisplay = true;
      hls.subtitleTrack = id;
    }
    setCaps((c) => ({ ...c, currentSubtitleTrack: id }));
  }, []);

  return { ...caps, attach, setLevel, setAudioTrack, setSubtitleTrack };
}
