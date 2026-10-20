/**
 * A Cache Storage-backed HLS loader and background prefetcher.
 *
 * hls.js keeps its buffer in memory and, even with an unbounded back buffer,
 * loses everything on reload. This module makes a watched stream local:
 *
 *  - every fetched media segment is written to the Cache Storage API keyed by
 *    URL, so a repeat request — a rewind past the memory buffer, a re-watch, a
 *    reload — is answered from disk with no request at all;
 *  - `prefetchFragments` walks the whole media playlist in the background at
 *    watch time, so a scrub forward into a region that was never played is
 *    served from disk too. This is the "buffer once, then stay local" contract:
 *    the only traffic after startup is the prefetcher finishing the file.
 *
 * Playlists are deliberately left alone: a media playlist is a sliding window
 * on a live stream and must stay fresh, while a segment's bytes never change.
 *
 * The cache is bounded by entry count and evicted oldest-first. The bound is
 * sized to hold a full feature film so the prefetcher does not evict the start
 * of the file it is still writing.
 */

const CACHE_NAME = 'netflix-pro-segments-v1';

/** Roughly four hours of 4 s segments; a whole film fits without eviction. */
const MAX_ENTRIES = 4000;

/** How many segments the background prefetcher fetches at once. */
const PREFETCH_CONCURRENCY = 4;

/** Minimal shape of the hls.js loader contract we implement. */
interface LoaderContext {
  url: string;
  type?: string;
  method?: string;
  rangeStart?: number;
  rangeEnd?: number;
}

interface LoaderResponse {
  url: string;
  data: ArrayBuffer | string | object;
  code?: number;
}

interface LoaderCallbacks {
  onSuccess: (
    response: LoaderResponse,
    stats: Record<string, unknown>,
    context: LoaderContext,
    networkDetails: unknown
  ) => void;
  onError: (error: unknown, context: LoaderContext, networkDetails: unknown, stats: unknown) => void;
  onTimeout: (stats: unknown, context: LoaderContext, networkDetails: unknown) => void;
}

interface LoaderConfig {
  [key: string]: unknown;
}

interface HlsWithLoader {
  DefaultConfig: { loader: LoaderCtor };
}

/** The shape of hls.js's loader class that this subclass relies on. */
export interface LoaderCtor {
  new (config: LoaderConfig): {
    load(context: LoaderContext, config: LoaderConfig, callbacks: LoaderCallbacks): void;
    abort(): void;
    destroy(): void;
  };
}

/** Whether the Cache Storage API is usable in this context. */
function cacheAvailable(): boolean {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

async function readFromCache(url: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    return await hit.arrayBuffer();
  } catch {
    return null;
  }
}

async function writeToCache(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(data, { headers: { 'content-type': 'application/octet-stream' } })
    );
    const keys = await cache.keys();
    const excess = keys.length - MAX_ENTRIES;
    for (let index = 0; index < excess; index += 1) {
      await cache.delete(keys[index]);
    }
  } catch {
    // A full or unavailable cache must never break playback.
  }
}

/** How many segments are cached, for the player's settings panel. */
export async function cachedSegmentCount(): Promise<number> {
  if (!cacheAvailable()) return 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}

/** Drop everything cached. */
export async function clearSegmentCache(): Promise<void> {
  if (!cacheAvailable()) return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // Nothing to do.
  }
}

async function hasCached(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    return Boolean(await cache.match(url));
  } catch {
    return false;
  }
}

/** Fetch a URL and store it, unless it is already cached. */
async function prefetchOne(url: string): Promise<void> {
  if (await hasCached(url)) return;
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    await writeToCache(url, buffer);
  } catch {
    // Prefetching is best-effort; a failed segment is fetched on demand later.
  }
}

/**
 * Warm the cache with the whole playlist in the background.
 *
 * Called once the manifest is parsed, this walks every fragment URL the
 * playlist advertises and fetches them a few at a time, writing each to Cache
 * Storage. After it finishes, seeking anywhere — forward or back — is served
 * from disk. It is bounded by the playlist itself, runs below playback in
 * priority, and stops when the caller aborts (component unmount, source change).
 *
 * Returns a function that cancels any outstanding work.
 */
export function prefetchFragments(urls: string[], signal?: AbortSignal): () => void {
  if (!cacheAvailable() || urls.length === 0) return () => {};

  let cancelled = false;
  const queue = [...urls];

  const worker = async () => {
    while (!cancelled && queue.length > 0) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (!url) return;
      await prefetchOne(url);
    }
  };

  const runners = Array.from({ length: PREFETCH_CONCURRENCY }, () => worker());
  void Promise.all(runners);

  return () => {
    cancelled = true;
  };
}

/**
 * The fragment URLs of a parsed HLS media playlist, in order.
 *
 * A relative URI is resolved against the playlist's own URL. `#EXT-X-MAP`
 * (initialization segments for fMP4) is included — it is needed just as much as
 * the media and is fetched once, so caching it is a pure win.
 */
export function fragmentUrlsFromPlaylist(playlistText: string, playlistUrl: string): string[] {
  const urls = new Set<string>();
  const resolve = (uri: string) => {
    try {
      return new URL(uri, playlistUrl).toString();
    } catch {
      return null;
    }
  };
  for (const rawLine of playlistText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const map = /^#EXT-X-MAP:.*URI="([^"]+)"/.exec(line);
      if (map) {
        const resolved = resolve(map[1]);
        if (resolved) urls.add(resolved);
      }
      continue;
    }
    const resolved = resolve(line);
    if (resolved) urls.add(resolved);
  }
  return [...urls];
}

/**
 * Fetch and parse a media playlist, then prefetch all of its fragments.
 *
 * hls.js exposes the parsed playlist on its own events, but the walking above
 * only needs the text, so this asks for it directly and leaves hls.js's request
 * bookkeeping untouched (its loader is only wrapped for *fragments*, so this
 * playlist GET is not cached — which is what we want, a media playlist must
 * stay fresh).
 */
export async function prefetchPlaylist(playlistUrl: string, signal?: AbortSignal): Promise<() => void> {
  if (!cacheAvailable()) return () => {};
  try {
    const response = await fetch(playlistUrl, { credentials: 'omit' });
    if (!response.ok) return () => {};
    const text = await response.text();
    return prefetchFragments(fragmentUrlsFromPlaylist(text, playlistUrl), signal);
  } catch {
    return () => {};
  }
}

/**
 * Build an hls.js `fLoader` that serves repeat segment requests from disk.
 *
 * Only plain GETs for whole segments are cached. Anything with a byte range,
 * any non-fragment request, and every environment without Cache Storage falls
 * through to hls.js's own loader untouched.
 */
export function createCachingFragmentLoader(Hls: HlsWithLoader) {
  const Base = Hls.DefaultConfig.loader;

  return class CachingFragmentLoader extends Base {

    load(context: LoaderContext, config: LoaderConfig, callbacks: LoaderCallbacks): void {
      const cacheable =
        cacheAvailable() &&
        context?.type === 'fragment' &&
        (!context.method || context.method === 'GET') &&
        context.rangeStart === undefined &&
        context.rangeEnd === undefined;

      if (!cacheable) {
        super.load(context, config, callbacks);
        return;
      }

      const url = context.url;
      const originalOnSuccess = callbacks.onSuccess;

      void readFromCache(url)
        .then((data) => {
          if (data) {
            originalOnSuccess({ url, data, code: 200 }, {}, context, null);
            return;
          }
          // Miss: let hls.js fetch it, then keep a copy for next time.
          callbacks.onSuccess = (response, stats, ctx, networkDetails) => {
            originalOnSuccess(response, stats, ctx, networkDetails);
            if (response?.data instanceof ArrayBuffer) void writeToCache(url, response.data);
          };
          super.load(context, config, callbacks);
        })
        .catch(() => {
          super.load(context, config, callbacks);
        });
    }

    abort(): void {
      super.abort();
    }
  };
}
