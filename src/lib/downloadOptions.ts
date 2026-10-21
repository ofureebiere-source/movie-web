/**
 * What the Download row offers, and what the saved file is called.
 *
 * The gateway resolves a title to several sources, one per quality, but the
 * player only ever plays the first. Saving therefore needs its own view of the
 * source list: a quality the viewer picks, and a file name that says which
 * title and quality they are getting, because the browser's own dialog has
 * nothing but the attachment header to go on.
 */

import type { NetwebSource } from '@/lib/netweb';

/** One selectable quality, with the source that would be saved for it. */
export interface DownloadQuality {
  /** Stable key for the picker: the height, or `auto` when none is known. */
  key: string;
  /** Resolution height, or `0` when the gateway did not report one. */
  height: number;
  /** Short label for the picker, e.g. `1080p`. */
  label: string;
  /** Reported size in bytes, or `0` when the extractor did not say. */
  size: number;
  /** That size as a short label, e.g. `2.3 GB`, or `''` when unknown. */
  sizeLabel: string;
  /** The stream the gateway should remux for this quality. */
  url: string;
  type?: string;
  headers?: Record<string, string>;
}

/**
 * The distinct qualities in a resolved source list, best first.
 *
 * One entry per resolution: the gateway returns a source per provider/quality,
 * and offering every one of them would repeat 1080p three times. The first
 * source at a resolution wins (the gateway already orders them best-first), but
 * the size shown is the largest reported at that resolution, so the viewer is
 * not told a 2 GB download is 700 MB because a worse mirror was listed first.
 *
 * A source list with no reported resolutions collapses to a single `Auto`
 * entry, so the picker never renders empty.
 */
export function downloadQualities(sources: NetwebSource[]): DownloadQuality[] {
  const byHeight = new Map<number, DownloadQuality>();
  const unknown: DownloadQuality[] = [];

  for (const source of sources) {
    if (!source?.url) continue;
    const height = Number(source.qualityHeight) || 0;
    const size = Number(source.size) || 0;
    if (!height) {
      unknown.push({
        key: 'auto',
        height: 0,
        label: source.qualityLabel || 'Auto',
        size,
        sizeLabel: source.sizeLabel || '',
        url: source.url,
        type: source.type,
        headers: source.headers,
      });
      continue;
    }
    const existing = byHeight.get(height);
    if (!existing) {
      byHeight.set(height, {
        key: String(height),
        height,
        label: source.qualityLabel || `${height}p`,
        size,
        sizeLabel: source.sizeLabel || '',
        url: source.url,
        type: source.type,
        headers: source.headers,
      });
      continue;
    }
    if (size > existing.size) {
      existing.size = size;
      existing.sizeLabel = source.sizeLabel || '';
    }
  }

  const ordered = [...byHeight.values()].sort((a, b) => b.height - a.height);
  return ordered.length ? ordered : unknown;
}

/** Characters a file name cannot carry on Windows, macOS or Linux. */
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Collapse the whitespace a stripped name can leave behind. */
function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * The name the device's save dialog shows: `Movie Name (2024) 1080p.mp4`.
 *
 * The gateway sets this in the attachment header, so the dialog offers the
 * title and quality rather than a generic `video.mp4` — the browser has no
 * other way to know what is being saved. Season and episode are included for
 * television, and a missing year or quality is simply left out rather than
 * printed as `(undefined)`.
 */
export function downloadFilename(opts: {
  title?: string;
  year?: string | number;
  season?: number;
  episode?: number;
  quality?: string;
  isTv?: boolean;
}): string {
  const parts: string[] = [];
  const title = tidy((opts.title || 'Video').replace(UNSAFE, ' '));
  parts.push(title || 'Video');
  const year = tidy(String(opts.year ?? ''));
  if (year) parts.push(`(${year})`);
  if (opts.isTv && opts.season != null && opts.episode != null) {
    const season = String(opts.season).padStart(2, '0');
    const episode = String(opts.episode).padStart(2, '0');
    parts.push(`S${season}E${episode}`);
  }
  const quality = tidy(opts.quality || '');
  if (quality) parts.push(quality);
  return `${parts.join(' ').slice(0, 120).trim()}.mp4`;
}

/**
 * The filename for a saved subtitle sidecar: `Movie Name (2024) 1080p.en.srt`.
 *
 * Built from the same parts as the video name, so the two files sort next to
 * each other and it is obvious which subtitle belongs to which save.
 */
export function subtitleFilename(videoFilename: string, lang = 'en'): string {
  return `${videoFilename.replace(/\.mp4$/i, '')}.${lang}.srt`;
}
