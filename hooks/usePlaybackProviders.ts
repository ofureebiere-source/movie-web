'use client';

import { useCallback, useEffect, useState } from 'react';
import { getProviders, type FxProvider } from 'services/framextv-api';

/**
 * The aggregator's server list, plus the viewer's choice of one.
 *
 * The catalogue is not one address: `api.framextv.tech` fans a title out over
 * several third-party servers ("Bowler XVIII", "Titan VII", …) and its
 * `/api/stream` accepts a `provider` id to pin one. Without a picker the
 * backend chooses silently, and a viewer whose chosen server is missing the
 * title — or is refusing this network — has no way to ask for another.
 *
 * The choice is remembered per browser rather than per title: somebody who
 * prefers the 4K server wants it on every title, not to re-pick it each time.
 * An id the registry no longer lists is dropped on load, so a server that is
 * retired upstream cannot leave a viewer pinned to a dead value.
 */

const STORAGE_KEY = 'mw_playback_provider';

export interface PlaybackProviders {
  /** Every server the registry advertises, in its own order. */
  providers: FxProvider[];
  /** The chosen server's id, or null for "let the backend decide". */
  currentProviderId: string | null;
  /** The chosen server, when it is still in the registry. */
  currentProvider: FxProvider | null;
  selectProvider: (id: string | null) => void;
}

export function usePlaybackProviders(anime: boolean): PlaybackProviders {
  const [providers, setProviders] = useState<FxProvider[]>([]);
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProviders(anime).then((list) => {
      if (cancelled) return;
      setProviders(list);
      // Drop a remembered id the registry has since retired.
      setCurrentProviderId((id) => (id && !list.some((p) => p.id === id) ? null : id));
    });
    return () => {
      cancelled = true;
    };
  }, [anime]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setCurrentProviderId(stored);
    } catch {
      // Private mode — the default server is still perfectly usable.
    }
  }, []);

  const selectProvider = useCallback((id: string | null) => {
    setCurrentProviderId(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Preference is an optimisation only.
    }
  }, []);

  return {
    providers,
    currentProviderId,
    currentProvider: providers.find((p) => p.id === currentProviderId) ?? null,
    selectProvider,
  };
}

/**
 * Pin a resolver link to one server.
 *
 * `link_m3u8` is our `/api/stream?id=…` route, so the choice is one more query
 * param on it; `useResolvedStream` forwards it upstream and the cache key
 * changes with it, which is what makes a switch re-resolve instead of replaying
 * the previous server's playlist.
 */
export function withProvider(link: string, providerId: string | null): string {
  if (!link || !providerId) return link;
  try {
    const url = new URL(link, window.location.origin);
    url.searchParams.set('provider', providerId);
    return `${url.pathname}${url.search}`;
  } catch {
    return link;
  }
}
