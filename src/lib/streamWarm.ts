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

function key(type: MediaType, id: string, season?: number, episode?: number): string {
  const scope = type === 'movie' ? '' : `:${season ?? 1}:${episode ?? 1}`;
  return `${STORAGE_PREFIX}${type}:${id}${scope}`;
}

/** The stream the embed should reuse, if one was warmed recently. */
export function readWarmedStream(
  type: MediaType,
  id: string,
  season?: number,
  episode?: number
): FxStream | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(key(type, id, season, episode));
    if (!raw) return null;
    const entry = JSON.parse(raw) as WarmEntry;
    if (!entry || typeof entry.at !== 'number') return null;
    if (Date.now() - entry.at > MAX_AGE_MS) {
      window.sessionStorage.removeItem(key(type, id, season, episode));
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
  stream: FxStream
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      key(type, id, season, episode),
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
}

/**
 * Resolve a title's stream and make it local ahead of playback.
 *
 * Resolves, stashes the result for the embed, and warms the segment cache from
 * the first playable source. Safe to call repeatedly — a redundant call resolves
 * to the same provider list and every already-cached fragment is skipped.
 */
export async function warmStream(
  id: string,
  type: MediaType,
  options: WarmStreamOptions = {}
): Promise<void> {
  const stream = await getStream(id, type, {
    season: type === 'movie' ? undefined : options.season,
    episode: type === 'movie' ? undefined : options.episode,
    provider: options.provider,
  });
  if (!stream) return;
  stashWarmedStream(type, id, options.season, options.episode, stream);
  const source = stream.sources?.find((entry) => entry.url);
  if (source) void prefetchStreamSource(source);
}
