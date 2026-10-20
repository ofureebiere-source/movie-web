import { getStream, type FxStream, type MediaType } from '@/lib/api';
import { prefetchStreamSource } from '@/lib/segmentCache';

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
}

/**
 * Resolve a title's stream and make it local ahead of playback.
 *
 * Resolves, stashes the result for the embed, and warms the segment cache from
 * the first playable source. Safe to call repeatedly — a redundant call resolves
 * to the same provider list and every already-cached fragment is skipped.
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
