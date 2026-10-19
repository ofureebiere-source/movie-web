'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Turn an episode's resolver link into a playable playlist URL.
 *
 * `link_m3u8` is not a media URL — it is our own `/api/stream?id=…` endpoint,
 * which asks the catalogue for a fresh, token-bound playlist. The catalogue
 * mints those tokens with a short expiry, so the URL cannot be baked into the
 * page at build time; it has to be fetched at play time, which is what this
 * hook does.
 *
 * The lookup runs in the BROWSER, for the same reason every other catalogue
 * read in this app does: the catalogue host is behind Cloudflare, which
 * refuses the datacenter IPs our serverless functions come from. A server-side
 * resolver therefore answers 502 in production while working perfectly in
 * local development, which is exactly the trap this hook removes. The
 * catalogue sends `access-control-allow-origin: *`, so the visitor's browser
 * can read it directly.
 *
 * Our own `/api/stream` route is kept as the second attempt, not the first: it
 * is the only option left if the direct read is blocked by something on the
 * visitor's side (an extension, a corporate proxy).
 *
 * Resolution is per-episode: the previous URL is dropped the moment a new link
 * arrives, so the player never plays the wrong episode's stream while the next
 * one is still resolving.
 */

interface ResolvedStream {
  /** The playlist (or direct media) URL, empty until resolved. */
  url: string;
  /** Subtitle tracks the catalogue returned with this stream. */
  subtitles: StreamSubtitle[];
  /** True while the resolver is in flight. */
  isLoading: boolean;
  /** Set when the title has no working source at all. */
  error: string | null;
  /** Re-run the lookup, e.g. after the CDN recovered. */
  retry: () => void;
}

const CACHE_PREFIX = 'mw_stream:';
const CACHE_TTL_MS = 4 * 60 * 1000;

/** Must match `CATALOG_API_BASE` in `app/api/stream/route.ts`. */
const CATALOG_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_API_BASE ?? 'https://api.framextv.tech'
).replace(/\/+$/, '');

interface StreamSource {
  url?: string;
  quality?: string;
}

interface StreamBody {
  url?: string;
  sources?: StreamSource[];
  /** Subtitle tracks the catalogue ships with this stream. */
  subtitles?: StreamSubtitle[];
  message?: string;
  error?: string;
}

/** One subtitle track, as the catalogue describes it. */
export interface StreamSubtitle {
  url: string;
  label?: string;
  lang?: string;
  language?: string;
  format?: string;
}

/** "1080p" → 1080, "720p" → 720, unknown → 0. */
function qualityRank(quality: string | undefined): number {
  const match = /(\d{3,4})/.exec(quality ?? '');
  return match ? Number(match[1]) : 0;
}

/**
 * The film and series endpoints return absolute source URLs, but the anime
 * endpoint returns its proxy path relative (`/anime/api/proxy?url=…`). A
 * relative URL handed to the player resolves against OUR origin, so the video
 * element would request a path this app does not serve. Rebase it.
 */
function absolutize(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${CATALOG_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** The catalogue address for the title our own resolver link describes. */
function catalogUrlFor(link: string): { direct: string; proxy: string } | null {
  let params: URLSearchParams;
  try {
    params = new URL(link, window.location.origin).searchParams;
  } catch {
    return null;
  }
  const id = params.get('id');
  if (!id) return null;
  const type = params.get('type') ?? 'movie';
  const path = type === 'anime' ? '/anime/api/stream' : '/api/stream';

  const upstream = new URL(`${CATALOG_BASE}${path}`);
  const search = new URLSearchParams({ id, type });
  const season = params.get('season');
  const episode = params.get('episode');
  // The server the viewer picked rides along on the resolver link; dropping it
  // here would silently send every request back to the backend's default.
  const provider = params.get('provider');
  if (season) search.set('season', season);
  if (episode) search.set('episode', episode);
  if (provider) search.set('provider', provider);
  upstream.search = search.toString();

  // The Edge proxy re-reads the same path server-side, which is the only way
  // the anime endpoint is reachable at all (it sends no CORS header).
  return { direct: upstream.toString(), proxy: `/api/catalog${path}?${search}` };
}

/** Highest-bitrate source from a catalogue stream payload, absolutised. */
function pickSource(body: StreamBody): string | null {
  if (body.url) return absolutize(body.url);
  const sources = (body.sources ?? []).filter((s) => s?.url);
  if (!sources.length) return null;
  const ranked = [...sources].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  return absolutize(ranked[0].url as string);
}

/**
 * How long the whole resolution may take before the player gives up on the
 * main stream and falls back to the provider embed.
 *
 * The film aggregation path answers in 16-22s when it has nothing to offer,
 * and the viewer is staring at a black frame the whole time. The embed is the
 * same provider carrying the same content, so waiting out a slow resolver buys
 * nothing. One deadline covers every route rather than one per route, so a
 * blocked direct call plus a slow proxy cannot add up to a minute of nothing.
 * The anime path answers in under a second, so it never reaches this.
 */
const RESOLVE_DEADLINE_MS = 12000;

/** True when a fetch was cut short by our own deadline rather than refused. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchJson(
  url: string,
  signal: AbortSignal
): Promise<{ ok: boolean; body: StreamBody }> {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal });
  let body: StreamBody = {};
  try {
    body = (await res.json()) as StreamBody;
  } catch {
    // A non-JSON answer is the Cloudflare challenge or an HTML error page.
  }
  return { ok: res.ok, body };
}

export function useResolvedStream(link: string): ResolvedStream {
  const [url, setUrl] = useState('');
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const currentLink = useRef(link);
  currentLink.current = link;

  useEffect(() => {
    if (!link) {
      setUrl('');
      setSubtitles([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // A cached playlist is still short-lived, so it is only reused for a few
    // minutes — long enough to survive an episode flip, short enough that the
    // token has not expired by the time it is handed to the player.
    if (nonce === 0) {
      try {
        const raw = window.sessionStorage.getItem(CACHE_PREFIX + link);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            at: number;
            url: string;
            subtitles?: StreamSubtitle[];
          };
          if (Date.now() - parsed.at < CACHE_TTL_MS && parsed.url) {
            setUrl(parsed.url);
            setSubtitles(parsed.subtitles ?? []);
            setError(null);
            setIsLoading(false);
            return;
          }
          window.sessionStorage.removeItem(CACHE_PREFIX + link);
        }
      } catch {
        // Private mode or corrupt entry — fall through to the network.
      }
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setUrl('');
    setSubtitles([]);

    // One deadline for the whole resolution, shared by every route.
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), RESOLVE_DEADLINE_MS);

    (async () => {
      try {
        let resolved: string | null = null;
        let foundSubtitles: StreamSubtitle[] = [];
        let failure = 'stream lookup failed';

        const candidates = catalogUrlFor(link);
        // A well-formed answer that simply lists no sources stops the walk: it
        // is the catalogue telling us this title has nothing, and re-asking the
        // same question down another network path cannot change the answer.
        // A timeout stops it too — the route is merely slow, so the next route
        // would burn the same wait to reach the same verdict. Only a refusal
        // (a non-2xx, or a throw from CORS or a block) is worth retrying
        // elsewhere. Without this the film route was asked three times, spending
        // ~35s to reach the same empty result before the player gave up.
        let answered = false;
        if (candidates) {
          // Direct first (fastest), then the Edge proxy — the anime endpoint
          // has no direct path at all.
          for (const candidate of [candidates.direct, candidates.proxy]) {
            try {
              const { ok, body } = await fetchJson(candidate, controller.signal);
              if (ok) {
                resolved = pickSource(body);
                foundSubtitles = body.subtitles ?? [];
                failure = body.message ?? body.error ?? 'no playable source';
                answered = true;
                break;
              }
              failure = body.message ?? body.error ?? failure;
            } catch (error) {
              if (isTimeout(error)) {
                failure = 'stream lookup timed out';
                answered = true;
                break;
              }
              // Blocked on the visitor's side — try the next route.
            }
            if (resolved) break;
          }
        }

        if (!resolved && !answered && !cancelled && currentLink.current === link) {
          try {
            const { ok, body } = await fetchJson(link, controller.signal);
            if (ok) {
              resolved = pickSource(body);
              foundSubtitles = body.subtitles ?? [];
            }
            if (!resolved) failure = body.message ?? body.error ?? failure;
          } catch {
            // Both routes are down; `failure` already says so.
          }
        }

        if (cancelled || currentLink.current !== link) return;

        if (!resolved) {
          setError(failure);
          return;
        }
        setUrl(resolved);
        setSubtitles(foundSubtitles);
        try {
          window.sessionStorage.setItem(
            CACHE_PREFIX + link,
            JSON.stringify({ at: Date.now(), url: resolved, subtitles: foundSubtitles })
          );
        } catch {
          // Cache is an optimisation only.
        }
      } finally {
        clearTimeout(deadline);
        if (!cancelled && currentLink.current === link) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      controller.abort();
    };
  }, [link, nonce]);

  return { url, subtitles, isLoading, error, retry: () => setNonce((n) => n + 1) };
}
