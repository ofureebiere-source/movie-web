import { getStream, type FxStream, type MediaType } from '@/lib/api';
import { prefetchStreamSource } from '@/lib/segmentCache';
import { isNetwebEnabled, proxiedUrl, resolveNetwebSources, type NetwebSource } from '@/lib/netweb';

/**
 * Warming a stream while the trailer plays.
 *
 * The watch page plays through a same-origin iframe (`/embed/...`), which is a
 * separate JS context with its own TanStack cache. Two things do cross that
 * boundary, and this module uses both:
 *
 *   - Cache Storage is origin-scoped, so pulling the stream's segments into
 *     `segmentCache` makes the embed's playback local.
 *   - `sessionStorage` is per-origin per-tab, so the resolved stream JSON can be
 *     handed to the embed directly, letting it skip its resolve.
 *
 * The embed's own resolve stays the source of truth; a stashed entry is a
 * hint it consumes once. Every entry carries a timestamp and is ignored after a
 * short window, so a stale resolution cannot pin playback to a dead server.
 */

const STORAGE_PREFIX = 'framextv_warm_stream:';
const MAX_AGE_MS = 10 * 60 * 1000;

interface WarmEntry {
  at: number;
  stream: FxStream;
}

/**
 * The warmed entries are keyed by provider as well as title. The embed resolves
 * one provider at a time (its `provider` URL parameter), so a single title-wide
 * entry would only ever serve the auto-resolved server; keying by provider lets
 * every server in the bar be resolved ahead of play, and a switch is then a
 * lookup rather than a fresh round trip.
 */
function key(
  type: MediaType,
  id: string,
  season?: number,
  episode?: number,
  provider?: string
): string {
  const scope = type === 'movie' ? '' : `:${season ?? 1}:${episode ?? 1}`;
  return `${STORAGE_PREFIX}${type}:${id}${scope}:${provider ?? 'auto'}`;
}

/** The stream the embed should reuse, if one was warmed recently. */
export function readWarmedStream(
  type: MediaType,
  id: string,
  season?: number,
  episode?: number,
  provider?: string
): FxStream | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(key(type, id, season, episode, provider));
    if (!raw) return null;
    const entry = JSON.parse(raw) as WarmEntry;
    if (!entry || typeof entry.at !== 'number') return null;
    if (Date.now() - entry.at > MAX_AGE_MS) {
      window.sessionStorage.removeItem(key(type, id, season, episode, provider));
      return null;
    }
    return entry.stream ?? null;
  } catch {
    return null;
  }
}

function stashWarmedStream(
  type: MediaType,
  id: string,
  season: number | undefined,
  episode: number | undefined,
  stream: FxStream,
  provider?: string
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      key(type, id, season, episode, provider),
      JSON.stringify({ at: Date.now(), stream } satisfies WarmEntry)
    );
  } catch {
    // A full or disabled sessionStorage just means a warm miss, not an error.
  }
}

/**
 * The gateway's own warmed resolution.
 *
 * Kept under a separate key from the aggregator's because the two are different
 * backends, not two answers to the same question: the embed must be able to tell
 * which one it is holding, since only the gateway's source is served through
 * `/proxy` and only its segments were prefetched.
 */
const NETWEB_PREFIX = 'framextv_warm_netweb:';

function netwebKey(
  type: MediaType,
  id: string,
  season?: number,
  episode?: number
): string {
  const scope = type === 'movie' ? '' : `:${season ?? 1}:${episode ?? 1}`;
  return `${NETWEB_PREFIX}${type}:${id}${scope}`;
}

interface NetwebWarmEntry {
  at: number;
  sources: NetwebSource[];
}

function stashWarmedNetwebSources(
  type: MediaType,
  id: string,
  season: number | undefined,
  episode: number | undefined,
  sources: NetwebSource[]
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      netwebKey(type, id, season, episode),
      JSON.stringify({ at: Date.now(), sources } satisfies NetwebWarmEntry)
    );
  } catch {
    // A warm miss at worst.
  }
}

/**
 * The gateway resolution warmed for this title, if one is still fresh.
 *
 * The embed consumes this so it does not repeat the `/v1/stream` round trip the
 * detail page already paid for. Returning null is the normal cold path.
 */
export function readWarmedNetwebSources(
  type: MediaType,
  id: string,
  season?: number,
  episode?: number
): NetwebSource[] | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(netwebKey(type, id, season, episode));
    if (!raw) return null;
    const entry = JSON.parse(raw) as NetwebWarmEntry;
    if (!entry || typeof entry.at !== 'number') return null;
    if (Date.now() - entry.at > MAX_AGE_MS) {
      window.sessionStorage.removeItem(netwebKey(type, id, season, episode));
      return null;
    }
    return entry.sources?.length ? entry.sources : null;
  } catch {
    return null;
  }
}

export interface WarmStreamOptions {
  season?: number;
  episode?: number;
  provider?: string;
  /**
   * The provider list to pre-resolve. When supplied, the auto resolution is
   * warmed first and then every provider is resolved in parallel, each stashed
   * under its own key, so switching server in the bar or the player is instant.
   */
  providers?: Array<{ id: string }>;
  /** Title metadata, so the gateway resolve can be asked for the right title. */
  title?: string;
  year?: string;
}

/**
 * Resolve a title's stream and make it local ahead of playback.
 *
 * Two resolves happen here, because the watch page can play from either backend
 * and both have to be ready before the viewer presses play:
 *
 *  - the aggregator's stream, stashed for the embed and prefetched;
 *  - the gateway's stream (`/v1/stream`), which is what the player actually
 *    loads when the gateway answered — stashed for the embed and prefetched
 *    *through the proxy*, so the cached segments sit under exactly the URLs the
 *    player will request.
 *
 * Safe to call repeatedly: a redundant call resolves to the same providers and
 * every already-cached fragment is skipped.
 *
 * When `providers` is supplied the whole server list is pre-resolved: each
 * provider is a separate `/api/stream?provider=` call, stashed under its own
 * key. Only the auto resolution warms the segment cache — pulling every
 * provider's segments would be a large amount of traffic for servers the viewer
 * will most likely never pick — but every provider's source URL is resolved, so
 * a switch still skips the round trip and only pays for the segments it needs.
 */
export async function warmStream(
  id: string,
  type: MediaType,
  options: WarmStreamOptions = {}
): Promise<void> {
  const scope = {
    season: type === 'movie' ? undefined : options.season,
    episode: type === 'movie' ? undefined : options.episode,
  };

  const auto = await getStream(id, type, { ...scope, provider: options.provider }).catch(() => null);
  if (auto) {
    stashWarmedStream(type, id, options.season, options.episode, auto, options.provider);
    const source = auto.sources?.find((entry) => entry.url);
    if (source) void prefetchStreamSource(source);
  }

  // The gateway is the backend the player prefers, so warming only the
  // aggregator would leave the expensive resolve — and the whole film's
  // segments — to be paid at play time. It is warmed here as well, and its
  // segments are pulled through `/proxy` because that is the URL the player
  // loads: prefetching the raw CDN URL would fill the cache under keys the
  // player never asks for, which is a warm cache that helps nobody.
  void warmGatewayStream(id, type, options);

  const providers = options.providers ?? [];
  if (providers.length === 0) return;

  await Promise.all(
    providers.map(async (provider) => {
      if (!provider?.id || provider.id === options.provider) return;
      if (readWarmedStream(type, id, options.season, options.episode, provider.id)) return;
      try {
        const stream = await getStream(id, type, { ...scope, provider: provider.id });
        if (stream?.sources?.length) {
          stashWarmedStream(type, id, options.season, options.episode, stream, provider.id);
        }
      } catch {
        // One provider answering slowly or refusing must not cancel the rest of
        // the batch: each provider is an independent resolve, and the ones that
        // succeed are the ones the bar can switch to instantly.
      }
    })
  );
}

/**
 * Resolve a title through the gateway and make its whole stream local.
 *
 * The gateway resolve is stashed so the embed skips its own `/v1/stream` round
 * trip, and the first source's fragments are prefetched through the proxy so
 * the segments are already in Cache Storage when playback asks for them. Both
 * halves matter: the stash removes the resolve wait, the prefetch removes the
 * buffering wait.
 *
 * Never throws: an unreachable gateway is a warm miss, not an error, because
 * the watch page has its own fallback.
 */
async function warmGatewayStream(
  id: string,
  type: MediaType,
  options: WarmStreamOptions
): Promise<void> {
  if (!isNetwebEnabled() || !id) return;
  try {
    const sources = await resolveNetwebSources(id, type, {
      season: type === 'movie' ? undefined : options.season,
      episode: type === 'movie' ? undefined : options.episode,
      title: options.title,
      year: options.year,
    });
    if (!sources.length) return;
    stashWarmedNetwebSources(type, id, options.season, options.episode, sources);
    const source = sources.find((entry) => entry.url);
    // Proxied, not raw: the player loads the `/proxy` URL, and the playlist that
    // comes back has its segments rewritten to `/proxy` too, so walking it fills
    // the cache under exactly the keys the player will ask for.
    if (source) void prefetchStreamSource({ url: proxiedUrl(source), type: source.type });
  } catch {
    // Best-effort: the embed resolves for itself when this misses.
  }
}
