/**
 * Player preferences, in `localStorage` — ported from frameXTV.xyz's
 * `playerPreferences` chunk. Same keys, same allowed values, same defaults.
 */

import { EQ_BANDS, EQ_DEFAULT, type EqualizerSettings } from '@/lib/audioEngine';

const SUBTITLE_KEY = 'framextv_subtitle_preferences';
const ASPECT_KEY = 'framextv_aspect_ratio';
const AUTOPLAY_KEY = 'framextv_autoplay_next';
const AUDIO_BOOST_KEY = 'framextv_audio_boost';
const EQ_KEY = 'framextv_equalizer';
const DOWNLOADER_KEY = 'framextv_enable_downloader';

export type SubtitleFontSize = 'sm' | 'md' | 'lg' | 'xl' | '3xl';
export type SubtitlePosition = 'bottom' | 'mid' | 'top';
export type SubtitleBgOpacity = 'dark' | 'semi' | 'none' | 'solid';
export type SubtitleTextColor = 'white' | 'yellow' | 'cyan';

export interface SubtitlePreferences {
  fontSize: SubtitleFontSize;
  position: SubtitlePosition;
  bgOpacity: SubtitleBgOpacity;
  textColor: SubtitleTextColor;
  preferredLanguage: string | null;
}

const SUBTITLE_DEFAULTS: SubtitlePreferences = {
  fontSize: 'md',
  position: 'bottom',
  bgOpacity: 'dark',
  textColor: 'white',
  preferredLanguage: null,
};

const FONT_SIZES: SubtitleFontSize[] = ['sm', 'md', 'lg', 'xl', '3xl'];
const POSITIONS: SubtitlePosition[] = ['bottom', 'mid', 'top'];
const BG_OPACITIES: SubtitleBgOpacity[] = ['dark', 'semi', 'none', 'solid'];
const TEXT_COLORS: SubtitleTextColor[] = ['white', 'yellow', 'cyan'];

const ASPECTS = ['auto', '16:9', '4:3', '21:9', '1:1'] as const;
export type AspectRatio = (typeof ASPECTS)[number];

const AUDIO_BOOSTS = ['off', '150', '200', '300', 'dialogue'] as const;
export type AudioBoost = (typeof AUDIO_BOOSTS)[number];

function store(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* disabled */
  }
  return null;
}

export function readSubtitlePreferences(): SubtitlePreferences {
  const storage = store();
  if (!storage) return { ...SUBTITLE_DEFAULTS };
  try {
    const raw = storage.getItem(SUBTITLE_KEY);
    if (!raw) return { ...SUBTITLE_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SubtitlePreferences>;
    if (typeof parsed !== 'object' || !parsed) return { ...SUBTITLE_DEFAULTS };
    return {
      fontSize: FONT_SIZES.includes(parsed.fontSize as SubtitleFontSize)
        ? (parsed.fontSize as SubtitleFontSize)
        : SUBTITLE_DEFAULTS.fontSize,
      position: POSITIONS.includes(parsed.position as SubtitlePosition)
        ? (parsed.position as SubtitlePosition)
        : SUBTITLE_DEFAULTS.position,
      bgOpacity: BG_OPACITIES.includes(parsed.bgOpacity as SubtitleBgOpacity)
        ? (parsed.bgOpacity as SubtitleBgOpacity)
        : SUBTITLE_DEFAULTS.bgOpacity,
      textColor: TEXT_COLORS.includes(parsed.textColor as SubtitleTextColor)
        ? (parsed.textColor as SubtitleTextColor)
        : SUBTITLE_DEFAULTS.textColor,
      preferredLanguage:
        typeof parsed.preferredLanguage === 'string' || parsed.preferredLanguage === null
          ? parsed.preferredLanguage
          : SUBTITLE_DEFAULTS.preferredLanguage,
    };
  } catch {
    return { ...SUBTITLE_DEFAULTS };
  }
}

export function saveSubtitlePreferences(patch: Partial<SubtitlePreferences>): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(SUBTITLE_KEY, JSON.stringify({ ...readSubtitlePreferences(), ...patch }));
  } catch {
    /* quota */
  }
}

export function readAspectRatio(): AspectRatio {
  const storage = store();
  if (!storage) return 'auto';
  try {
    const raw = storage.getItem(ASPECT_KEY);
    return raw && (ASPECTS as readonly string[]).includes(raw) ? (raw as AspectRatio) : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveAspectRatio(value: AspectRatio): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(ASPECT_KEY, value);
  } catch {
    /* disabled */
  }
}

export function readAutoplayNext(): boolean {
  const storage = store();
  if (!storage) return true;
  try {
    const raw = storage.getItem(AUTOPLAY_KEY);
    return raw === null || raw === 'true';
  } catch {
    return true;
  }
}

export function saveAutoplayNext(enabled: boolean): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(AUTOPLAY_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('framextv:autoplay_preference', { detail: { enabled } }));
  } catch {
    /* disabled */
  }
}

export function readAudioBoost(): AudioBoost {
  const storage = store();
  if (!storage) return 'off';
  try {
    const raw = storage.getItem(AUDIO_BOOST_KEY);
    return raw && (AUDIO_BOOSTS as readonly string[]).includes(raw) ? (raw as AudioBoost) : 'off';
  } catch {
    return 'off';
  }
}

export function saveAudioBoost(value: AudioBoost): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(AUDIO_BOOST_KEY, value);
    window.dispatchEvent(new CustomEvent('framextv:audio_boost_preference', { detail: { boost: value } }));
  } catch {
    /* disabled */
  }
}

export interface DownloadCapability {
  canDownload: boolean;
  sourceType: 'iframe' | 'hls' | 'mp4' | 'none';
  reason: string;
  downloadUrl?: string;
}

/** Whether the browser exposes a local downloader (reference `isDownloaderEnabled`). */
export function isDownloaderEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = (params.get('downloader') || params.get('download') || '').toLowerCase();
    if (flag === '1' || flag === 'true' || flag === 'on') return true;
    if (flag === '0' || flag === 'false' || flag === 'off') return false;
  } catch {
    /* malformed query */
  }
  const storage = store();
  if (storage) {
    try {
      const stored = storage.getItem(DOWNLOADER_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      /* disabled */
    }
  }
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === 'framextv-fe.hybrows.workers.dev';
}

/** The saved equaliser, clamped to ten bands and a sane pre-amp. */
export function readEqualizer(): EqualizerSettings {
  const storage = store();
  if (!storage) return { ...EQ_DEFAULT, gains: [...EQ_DEFAULT.gains] };
  try {
    const raw = storage.getItem(EQ_KEY);
    if (!raw) return { ...EQ_DEFAULT, gains: [...EQ_DEFAULT.gains] };
    const parsed = JSON.parse(raw) as Partial<EqualizerSettings>;
    if (typeof parsed !== 'object' || !parsed) return { ...EQ_DEFAULT, gains: [...EQ_DEFAULT.gains] };
    const gains = Array.isArray(parsed.gains)
      ? EQ_BANDS.map((_, index) => {
          const value = Number(parsed.gains?.[index]);
          return Number.isFinite(value) ? Math.max(-12, Math.min(12, value)) : 0;
        })
      : [...EQ_DEFAULT.gains];
    const preamp = Number(parsed.preamp);
    return {
      enabled: Boolean(parsed.enabled),
      gains,
      preamp: Number.isFinite(preamp) ? Math.max(-12, Math.min(12, preamp)) : 0,
    };
  } catch {
    return { ...EQ_DEFAULT, gains: [...EQ_DEFAULT.gains] };
  }
}

export function saveEqualizer(value: EqualizerSettings): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(EQ_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('framextv:equalizer_preference', { detail: value }));
  } catch {
    /* disabled */
  }
}

/** Whether the active source can be downloaded directly (reference `getDownloadInfo`). */
export function getDownloadInfo(source: { url?: string; type?: string } | null): DownloadCapability {
  if (!source || !source.url) {
    return { canDownload: false, sourceType: 'none', reason: 'No active media source loaded.' };
  }
  const url = source.url.toLowerCase();
  if (url.includes('/embed/') || url.includes('iframe') || source.type === 'iframe') {
    return {
      canDownload: false,
      sourceType: 'iframe',
      reason: 'Direct download is unavailable for embed-based sources.',
    };
  }
  if (source.type === 'hls' || url.includes('.m3u8') || url.includes('m3u8=') || url.includes('/hls/')) {
    if (isDownloaderEnabled()) {
      return { canDownload: true, sourceType: 'hls', reason: '', downloadUrl: source.url };
    }
    return {
      canDownload: false,
      sourceType: 'hls',
      reason: 'Client-side downloader is in private preview.',
    };
  }
  if (source.type === 'mp4' || /\.(mp4|m4v|webm|mkv|avi|mov)($|\?)/i.test(source.url)) {
    return { canDownload: true, sourceType: 'mp4', reason: '', downloadUrl: source.url };
  }
  return {
    canDownload: false,
    sourceType: 'none',
    reason: 'Direct download is unavailable for this stream format.',
  };
}

export { ASPECTS, AUDIO_BOOSTS };
