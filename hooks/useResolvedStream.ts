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
 * Resolution is per-episode: the previous URL is dropped the moment a new link
 * arrives, so the player never plays the wrong episode's stream while the next
 * one is still resolving.
 */

interface ResolvedStream {
  /** The playlist (or direct media) URL, empty until resolved. */
  url: string;
  /** True while the resolver is in flight. */
  isLoading: boolean;
  /** Set when the title has no working source at all. */
  error: string | null;
  /** Re-run the lookup, e.g. after the CDN recovered. */
  retry: () => void;
}

const CACHE_PREFIX = 'mw_stream:';
const CACHE_TTL_MS = 4 * 60 * 1000;

export function useResolvedStream(link: string): ResolvedStream {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const currentLink = useRef(link);
  currentLink.current = link;

  useEffect(() => {
    if (!link) {
      setUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }

    // A cached playlist is still short-lived, so it is only reused for a few
    // minutes — long enough to survive an episode flip, short enough that the
    // token has not expired by the time it is handed to hls.js.
    if (nonce === 0) {
      try {
        const raw = window.sessionStorage.getItem(CACHE_PREFIX + link);
        if (raw) {
          const parsed = JSON.parse(raw) as { at: number; url: string };
          if (Date.now() - parsed.at < CACHE_TTL_MS && parsed.url) {
            setUrl(parsed.url);
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

    (async () => {
      try {
        const res = await fetch(link, { headers: { accept: 'application/json' } });
        const body = (await res.json()) as { url?: string; message?: string };
        if (cancelled || currentLink.current !== link) return;

        if (!res.ok || !body.url) {
          setError(body.message ?? 'no playable source');
          return;
        }
        setUrl(body.url);
        try {
          window.sessionStorage.setItem(
            CACHE_PREFIX + link,
            JSON.stringify({ at: Date.now(), url: body.url })
          );
        } catch {
          // Cache is an optimisation only.
        }
      } catch {
        if (!cancelled && currentLink.current === link) setError('stream lookup failed');
      } finally {
        if (!cancelled && currentLink.current === link) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [link, nonce]);

  return { url, isLoading, error, retry: () => setNonce((n) => n + 1) };
}
