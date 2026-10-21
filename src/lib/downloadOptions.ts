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
  /**
   * The single-rendition URL to save, when it differs from `url`.
   *
   * For a quality the gateway recovered from a multi-variant master playlist,
   * this is that rendition's own playlist, so saving it produces the quality
   * the viewer picked instead of whichever rendition the remuxer prefers.
   */
  downloadUrl?: string;
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
 * entry, so the picker never renders empty. Several mirrors can each report no
 * resolution, so those entries are de-duplicated by URL and given distinct
 * keys: a picker keyed on a repeated `auto` would select the wrong row.
 */
export function downloadQualities(sources: NetwebSource[]): DownloadQuality[] {
  const byHeight = new Map<number, DownloadQuality>();
  const unknown: DownloadQuality[] = [];
  const unknownUrls = new Set<string>();

  for (const source of sources) {
    if (!source?.url) continue;
    const height = Number(source.qualityHeight) || 0;
    const size = Number(source.size) || 0;
    if (!height) {
      if (unknownUrls.has(source.url)) continue;
      unknownUrls.add(source.url);
      unknown.push({
        key: unknown.length === 0 ? 'auto' : `auto-${unknown.length + 1}`,
        height: 0,
        label: source.qualityLabel || 'Auto',
        size,
        sizeLabel: source.sizeLabel || '',
        url: source.url,
        downloadUrl: source.downloadUrl,
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
        downloadUrl: source.downloadUrl,
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

/**
 * The variants of an HLS master playlist, best first.
 *
 * The gateway returns one source per quality, but not every source is one: an
 * aggregator source is often a single master playlist that already carries a
 * rendition per resolution. When the API reports no per-quality rows — which is
 * exactly what happens on the aggregator fallback — the qualities still exist,
 * they are just inside the playlist. Reading them here is what lets the picker
 * offer the real list client-side instead of a lone `Auto`.
 *
 * `downloadUrl` is the rendition's own playlist, so saving a pick downloads
 * that rendition rather than whichever one the remuxer would have chosen. The
 * entry's `url` stays the master, because that is what the player loads.
 */
export function parseMasterPlaylist(text: string, masterUrl: string): DownloadQuality[] {
  if (!text || !/#EXT-X-STREAM-INF/.test(text)) return [];

  const qualities: DownloadQuality[] = [];
  const seen = new Set<number>();
  const lines = text.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

    // The URI is the next non-comment, non-blank line.
    let uri = '';
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate || candidate.startsWith('#')) continue;
      uri = candidate;
      break;
    }
    if (!uri) continue;

    const height = Number(/RESOLUTION=\d+x(\d+)/i.exec(line)?.[1]) || 0;
    const bandwidth = Number(/BANDWIDTH=(\d+)/i.exec(line)?.[1]) || 0;
    if (!height || seen.has(height)) continue;
    seen.add(height);

    let renditionUrl: string;
    try {
      renditionUrl = new URL(uri, masterUrl).toString();
    } catch {
      continue;
    }
    qualities.push({
      key: String(height),
      height,
      label: qualityLabelForHeight(height),
      size: 0,
      sizeLabel: '',
      // The master is what the player loads; the rendition is what gets saved.
      url: masterUrl,
      downloadUrl: renditionUrl,
    });
    void bandwidth;
  }

  return qualities.sort((a, b) => b.height - a.height);
}

/** The label the picker shows for a resolution, matching the gateway's own. */
function qualityLabelForHeight(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
}

/**
 * The best-effort client-side quality list for a source the API did not
 * describe per quality.
 *
 * The master playlist is fetched and parsed; anything that is not a master
 * (a media playlist, a plain MP4, a CORS refusal) yields an empty list, and the
 * caller keeps its single `Auto` entry. This never throws: a picker that cannot
 * learn the qualities must still let the viewer download.
 *
 * `fetchUrl` is where the playlist is actually read from — the gateway's
 * `/proxy` when one is configured, because a CDN that needs a Referer, or that
 * simply does not send CORS headers, is unreadable from the page directly. It
 * defaults to the stream's own URL, and relative rendition URIs still resolve
 * against the real stream URL rather than the proxy's.
 */
export async function qualitiesFromSource(
  source: { url: string; type?: string },
  fetchUrl?: string
): Promise<DownloadQuality[]> {
  if (!source?.url) return [];
  const looksLikePlaylist =
    source.type === 'hls' || /\.m3u8($|\?)/i.test(source.url) || /m3u8=/i.test(source.url);
  if (!looksLikePlaylist) return [];
  try {
    const response = await fetch(fetchUrl || source.url, { credentials: 'omit' });
    if (!response.ok) return [];
    return parseMasterPlaylist(await response.text(), source.url);
  } catch {
    return [];
  }
}
