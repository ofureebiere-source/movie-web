/**
 * Our own streaming backend — the `Net-web` service.
 *
 * frameXTV resolves a title against its own aggregator (`apiBase()` in
 * `config.ts`). This app has a second, independent backend: the Python
 * `Net-web` gateway, which scrapes providers itself and serves the stream
 * through its own `/proxy`. The player screen and the Download button are
 * wired to it, so a save never depends on a CDN the browser cannot reach and
 * never needs a wallet.
 *
 * Endpoints used here (all keyless, all `Access-Control-Allow-Origin: *`):
 *
 *   GET /v1/stream    resolve a title → { info, sources[{name, data:{stream,…}}] }
 *   GET /proxy        header-correct passthrough, and HLS playlist rewriting
 *   GET /v1/download  remux to MP4 with ffmpeg and return it as an attachment
 *
 * The origin is overridable, in this order: `?netweb=` in the query string,
 * then the saved value, then the deployed default. `local` opts out entirely
 * and leaves the player on the aggregator's own sources.
 */

/** The deployed gateway. Overridable — see `netwebBase`. */
export const NETWEB_DEFAULT_BASE = 'https://netweb-apsv.onrender.com';

const STORAGE_KEY = 'netweb_api_base_url';

function storage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* private mode / disabled storage */
  }
  return null;
}

function queryParam(name: string): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function normalise(value: string): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

let activeBase: string = (() => {
  const override = queryParam('netweb');
  if (override === 'local' || override === 'off' || override === 'none') return '';
  if (override) return normalise(override);
  const store = storage();
  if (store) {
    try {
      const saved = store.getItem(STORAGE_KEY);
      if (saved) return normalise(saved);
    } catch {
      /* disabled */
    }
  }
  return NETWEB_DEFAULT_BASE;
})();

/** The active gateway origin, or an empty string when it is switched off. */
export function netwebBase(): string {
  return activeBase;
}

/** True when the gateway is in use (the default). */
export function isNetwebEnabled(): boolean {
  return Boolean(activeBase);
}

/** Point the app at a different gateway, or pass `''` to switch it off. */
export function setNetwebBase(next: string): void {
  activeBase = normalise(next);
  const store = storage();
  if (!store) return;
  try {
    if (activeBase) store.setItem(STORAGE_KEY, activeBase);
    else store.removeItem(STORAGE_KEY);
  } catch {
    /* quota / disabled */
  }
}

/** A resolved source, as `/v1/stream` returns it. */
export interface NetwebSource {
  /** The upstream stream URL. */
  url: string;
  /** `hls` or a file container. */
  type: string;
  /** The extractor's own quality string. */
  quality?: string;
  /** Resolution height, e.g. `1080`. Drives the download quality picker. */
  qualityHeight?: number;
  /** Short label for that resolution, e.g. `1080p`. */
  qualityLabel?: string;
  /**
   * The URL to save for this quality, when it differs from `url`.
   *
   * The gateway recovers resolutions from a multi-variant master playlist and
   * gives each recovered quality its own rendition URL here. Playback keeps
   * using `url` (the master) so it can adapt; a download uses this so the file
   * is the quality the viewer chose.
   */
  downloadUrl?: string;
  /** Reported size in bytes; `0` when the extractor did not say. */
  size?: number;
  /** That size as a short label, e.g. `2.3 GB`; `''` when unknown. */
  sizeLabel?: string;
  /** Display name, e.g. `frameXTV · bowler · Bowler XVIII`. */
  name?: string;
  provider?: string;
  providerLabel?: string;
  /** Per-host headers the CDN expects; forwarded to `/proxy`. */
  headers?: Record<string, string>;
}

interface NetwebStreamResponse {
  status?: string;
  sources?: Array<{
    name?: string;
    data?: {
      stream?: string;
      type?: string;
      quality?: string;
      qualityHeight?: number;
      qualityLabel?: string;
      downloadUrl?: string;
      size?: number;
      sizeLabel?: string;
      provider?: string;
      providerLabel?: string;
      headers?: Record<string, string>;
    };
  }>;
}

/**
 * The gateway's own resolution timeout.
 *
 * The gateway resolves a title by fanning out to several extractors, so a cold
 * resolve routinely takes tens of seconds. A 12 s ceiling — the previous value —
 * was shorter than the gateway's normal answer, so every resolve aborted and
 * the gateway path never engaged: the quality picker stayed empty, the download
 * row fell back to naming a container, and playback silently used the
 * aggregator. It is a budget, not a deadline: a miss still degrades to the
 * aggregator, so a slow gateway costs a wait rather than a broken page.
 */
const NETWEB_RESOLVE_TIMEOUT_MS = 45_000;

/**
 * In-flight resolves by URL.
 *
 * The detail page warms the gateway while the viewer reads the synopsis, and
 * the embed then asks for the same title. Sharing the promise means the second
 * caller rides the first request instead of firing a duplicate — and, more
 * importantly, that the embed inherits a resolve that was started with the
 * warmer's longer budget rather than racing it with its own shorter one.
 */
const inFlightResolves = new Map<string, Promise<NetwebStreamResponse>>();

async function resolveShared(
  url: string,
  timeoutMs: number
): Promise<NetwebStreamResponse | null> {
  const existing = inFlightResolves.get(url);
  if (existing) return existing.catch(() => null);
  const request = (async () => {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`gateway answered ${response.status}`);
    return (await response.json()) as NetwebStreamResponse;
  })();
  inFlightResolves.set(url, request);
  try {
    return await request;
  } catch {
    return null;
  } finally {
    inFlightResolves.delete(url);
  }
}

/**
 * Resolve playable sources for a title through the gateway.
 *
 * Returns an empty array rather than throwing: the caller falls back to the
 * aggregator, so an unreachable gateway must not break the page.
 *
 * `opts.timeoutMs` exists because the two callers have different budgets. The
 * background warm is nobody's critical path, so it can wait out a slow resolve;
 * the embed is about to paint a player, so it is bounded tighter. A resolve
 * that times out is a miss, not an error, and the aggregator fallback covers it.
 */
export async function resolveNetwebSources(
  tmdbId: string,
  mediaType: string,
  opts: {
    season?: number;
    episode?: number;
    title?: string;
    year?: string;
    timeoutMs?: number;
  } = {}
): Promise<NetwebSource[]> {
  if (!activeBase || !tmdbId) return [];
  const params = new URLSearchParams({ tmdbId, mediaType: mediaType === 'tv' ? 'tv' : 'movie' });
  if (opts.season != null) params.set('season', String(opts.season));
  if (opts.episode != null) params.set('episode', String(opts.episode));
  if (opts.title) params.set('title', opts.title);
  if (opts.year) params.set('year', opts.year);

  const requestUrl = `${activeBase}/v1/stream?${params.toString()}`;
  const timeoutMs = opts.timeoutMs ?? NETWEB_RESOLVE_TIMEOUT_MS;
  try {
    const body = await resolveShared(requestUrl, timeoutMs);
    const rows = body?.sources ?? [];
    const sources: NetwebSource[] = [];
    for (const row of rows) {
      const url = row?.data?.stream;
      if (!url) continue;
      sources.push({
        url,
        type: (row.data?.type || 'hls').toLowerCase(),
        quality: row.data?.quality,
        qualityHeight: row.data?.qualityHeight,
        qualityLabel: row.data?.qualityLabel,
        downloadUrl: row.data?.downloadUrl,
        size: row.data?.size,
        sizeLabel: row.data?.sizeLabel,
        name: row.name,
        provider: row.data?.provider,
        providerLabel: row.data?.providerLabel,
        headers: row.data?.headers,
      });
    }
    return sources;
  } catch {
    return [];
  }
}

/**
 * The `/proxy` URL for a source.
 *
 * The player loads this instead of the CDN URL, so the CDN sees the request
 * come from the gateway with the headers it expects, and an HLS playlist is
 * rewritten to route its segments through here too. A source that is already
 * a same-origin path is left alone, and the URL is returned untouched when the
 * gateway is switched off.
 */
export function proxiedUrl(source: { url: string; headers?: Record<string, string> }): string {
  if (!activeBase) return source.url;
  if (source.url.startsWith('/')) return source.url;
  const params = new URLSearchParams({ url: source.url });
  const headers = source.headers ?? {};
  const referer = headers.Referer ?? headers.referer;
  const origin = headers.Origin ?? headers.origin;
  if (referer) params.set('referer', referer);
  if (origin) params.set('origin', origin);
  return `${activeBase}/proxy?${params.toString()}`;
}

/**
 * The `/v1/download` URL for a source.
 *
 * Navigating to this URL saves the file: the response is an attachment and an
 * HLS stream is remuxed to a single MP4 by ffmpeg on the gateway. There is no
 * wallet check and no client-side downloader in the path.
 *
 * `opts.subtitles` embeds the title's English track as a soft subtitle stream,
 * and `opts.identifiers` gives the gateway what it needs to look that track up.
 * Both are optional: without them the save is the bare stream, as before.
 */
export function downloadUrlFor(
  source: {
    url: string;
    /** The single-rendition URL to save, when it differs from `url`. */
    downloadUrl?: string;
    type?: string;
    headers?: Record<string, string>;
  },
  filename: string,
  opts: {
    referer?: string;
    origin?: string;
    subtitles?: boolean;
    subLang?: string;
    identifiers?: {
      tmdbId?: string;
      mediaType?: string;
      season?: number;
      episode?: number;
      title?: string;
      year?: string;
    };
  } = {}
): string {
  if (!activeBase) return source.downloadUrl || source.url;
  // Save the rendition the viewer picked. A source recovered from a
  // multi-variant master names that rendition in `downloadUrl`; everything else
  // downloads its own `url`, so this is a no-op for ordinary sources.
  const target = source.downloadUrl || source.url;
  const params = new URLSearchParams({ url: target, filename });
  if (source.type) params.set('type', source.type);
  const headers = source.headers ?? {};
  const referer = opts.referer ?? headers.Referer ?? headers.referer;
  const origin = opts.origin ?? headers.Origin ?? headers.origin;
  if (referer) params.set('referer', referer);
  if (origin) params.set('origin', origin);
  if (opts.subtitles) {
    params.set('subs', '1');
    if (opts.subLang) params.set('subLang', opts.subLang);
  }
  const ids = opts.identifiers;
  if (ids?.tmdbId) params.set('tmdbId', ids.tmdbId);
  if (ids?.mediaType) params.set('mediaType', ids.mediaType);
  if (ids?.season != null) params.set('season', String(ids.season));
  if (ids?.episode != null) params.set('episode', String(ids.episode));
  if (ids?.title) params.set('title', ids.title);
  if (ids?.year) params.set('year', ids.year);
  return `${activeBase}/v1/download?${params.toString()}`;
}
