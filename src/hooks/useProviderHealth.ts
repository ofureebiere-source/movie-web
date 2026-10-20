import { useCallback, useEffect, useState } from 'react';
import { checkStreamProvider, type FxProvider, type MediaType } from '@/lib/api';

/**
 * Per-provider health for the server picker, ported from the reference.
 *
 * Two sources feed the status a row shows:
 *
 *  - a live probe of each provider for the current title (`checking` →
 *    `available` / `unavailable`), run once per title and provider; and
 *  - a session-local history of what actually worked, so a provider that has
 *    already been tried keeps its verdict without re-probing.
 *
 * The active provider is deliberately not probed — the bar labels it
 * "Connected" — and the backup row is always "Available" because it is an
 * iframe rather than a probe-able server.
 */

export type ProviderHealth = 'checking' | 'available' | 'unavailable';

export interface StreamHistoryEntry {
  provider: string;
  success: boolean;
  at: number;
}

const HISTORY_KEY = 'framextv_stream_history';
const HISTORY_LIMIT = 20;

function readHistory(): StreamHistoryEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StreamHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: StreamHistoryEntry[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-HISTORY_LIMIT)));
  } catch {
    /* storage disabled */
  }
}

export function useProviderHealth(
  mediaId: string | undefined,
  mediaType: MediaType,
  providers: FxProvider[],
  opts: { season?: number; episode?: number; activeProvider?: string } = {}
) {
  const { season, episode, activeProvider } = opts;
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderHealth>>({});
  const [streamHistory, setStreamHistory] = useState<StreamHistoryEntry[]>(() => readHistory());

  const recordStreamResult = useCallback((provider: string | undefined, success: boolean) => {
    if (!provider) return;
    setStreamHistory((prev) => {
      const next = [...prev.filter((entry) => entry.provider !== provider), { provider, success, at: Date.now() }];
      writeHistory(next);
      return next;
    });
  }, []);

  const providerIds = providers.map((provider) => provider.id).join(',');

  useEffect(() => {
    if (!mediaId || providers.length === 0) return;
    let cancelled = false;

    // Seed every non-active provider as "checking", then probe it.
    const ids = providers.map((provider) => provider.id);
    setProviderStatus((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (id !== activeProvider && next[id] === undefined) next[id] = 'checking';
      }
      return next;
    });

    void Promise.all(
      ids.map(async (id) => {
        if (id === activeProvider) return;
        // A provider already tried this session keeps its verdict.
        const known = readHistory().find((entry) => entry.provider === id);
        if (known) {
          if (!cancelled) setProviderStatus((prev) => ({ ...prev, [id]: known.success ? 'available' : 'unavailable' }));
          return;
        }
        const available = await checkStreamProvider(mediaId, mediaType, id, { season, episode });
        if (!cancelled) setProviderStatus((prev) => ({ ...prev, [id]: available ? 'available' : 'unavailable' }));
      })
    );

    return () => {
      cancelled = true;
    };
    // `providerIds` stands in for the provider list so a re-render with the same
    // set does not restart the probe.
  }, [mediaId, mediaType, season, episode, activeProvider, providerIds, providers]);

  return { providerStatus, streamHistory, recordStreamResult };
}
