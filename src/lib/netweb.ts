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
      provider?: string;
      providerLabel?: string;
      headers?: Record<string, string>;
    };
  }>;
}

/**
 * Resolve playable sources for a title through the gateway.
 *
 * Returns an empty array rather than throwing: the caller falls back to the
 * aggregator, so an unreachable gateway must not break the page.
 */
export async function resolveNetwebSources(
  tmdbId: string,
  mediaType: string,
  opts: { season?: number; episode?: number; title?: string; year?: string } = {}
): Promise<NetwebSource[]> {
  if (!activeBase || !tmdbId) return [];
  const params = new URLSearchParams({ tmdbId, mediaType: mediaType === 'tv' ? 'tv' : 'movie' });
  if (opts.season != null) params.set('season', String(opts.season));
  if (opts.episode != null) params.set('episode', String(opts.episode));
  if (opts.title) params.set('title', opts.title);
  if (opts.year) params.set('year', opts.year);

  try {
    const response = await fetch(`${activeBase}/v1/stream?${params.toString()}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as NetwebStreamResponse;
    const rows = body?.sources ?? [];
    const sources: NetwebSource[] = [];
    for (const row of rows) {
      const url = row?.data?.stream;
      if (!url) continue;
      sources.push({
        url,
        type: (row.data?.type || 'hls').toLowerCase(),
        quality: row.data?.quality,
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
 */
export function downloadUrlFor(
  source: { url: string; type?: string; headers?: Record<string, string> },
  filename: string,
  opts: { referer?: string; origin?: string } = {}
): string {
  if (!activeBase) return source.url;
  const params = new URLSearchParams({ url: source.url, filename });
  if (source.type) params.set('type', source.type);
  const headers = source.headers ?? {};
  const referer = opts.referer ?? headers.Referer ?? headers.referer;
  const origin = opts.origin ?? headers.Origin ?? headers.origin;
  if (referer) params.set('referer', referer);
  if (origin) params.set('origin', origin);
  return `${activeBase}/v1/download?${params.toString()}`;
}
