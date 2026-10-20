/**
 * A Cache Storage-backed HLS fragment loader.
 *
 * hls.js keeps its buffer in memory, so once a segment falls out of the back
 * buffer a seek back to it goes to the network again — and a fast-forward into
 * a region that was never buffered always does. The reference does nothing
 * about this (`maxBufferLength: 30`, `backBufferLength: 30`).
 *
 * This loader puts every fetched media segment into the Cache Storage API
 * keyed by its URL. A later request for the same URL — a rewind, a re-watch,
 * or a scrub back into a region already played — is answered from disk with no
 * request at all. Playlists are deliberately left alone: a media playlist is a
 * sliding window and must stay fresh, while a segment's bytes never change.
 *
 * The cache is bounded by entry count and evicted oldest-first, so a long
 * session cannot grow it without limit.
 */

const CACHE_NAME = 'netflix-pro-segments-v1';

/** Roughly an hour of 4-6 s segments; eviction is oldest-first. */
const MAX_ENTRIES = 700;

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
