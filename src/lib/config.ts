/**
 * The backend origins, and how the app picks them.
 *
 * Ported 1:1 from frameXTV.xyz's `config-*.js`. Two origins are resolved, not
 * one:
 *
 *   apiBase()    the catalogue origin — https://api.framextv.tech (default)
 *   animeBase()  the anime origin    — `${apiBase()}/anime`
 *
 * The split matters. The reference's `/anime/api/*` routes answer with a CORS
 * origin allowlist rather than `*`, so they only load from a page the backend
 * already trusts. Calling them cross-origin from an unlisted host fails with
 * "Failed to fetch" even though the endpoint itself is healthy. The reference
 * therefore only uses the absolute anime origin on its own domain and on its
 * designated local ports; anywhere else it falls back to a same-origin
 * `/anime`, which is what a reverse proxy is expected to serve.
 *
 * `?backend=` overrides the catalogue origin (`prod` / `xyz` / `tech` / `cc`,
 * or `local` to opt out entirely); it does not move the anime origin.
 */

export const BACKENDS = [
  'https://api.framextv.tech',
  'https://api.framextv.xyz',
  'https://api.framextv.cc',
] as const;

const STORAGE_KEY = 'framextv_api_base_url';
const KNOWN = Array.from(new Set<string>(BACKENDS));

/** Ports the reference treats as its own local dev server. */
const LOCAL_PORTS = ['4174', '5174'];

function storage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* private mode / disabled storage */
  }
  return null;
}

function readStored(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim().replace(/\/+$/, '');
    return KNOWN.includes(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, value);
  } catch {
    /* quota / disabled */
  }
}

function queryParam(name: string): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const search = typeof window.location.search === 'string' ? window.location.search : '';
  return new URLSearchParams(search).get(name);
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function onLocalDevPort(): boolean {
  if (!isLocalhost() || typeof window === 'undefined') return false;
  return LOCAL_PORTS.includes(window.location.port);
}

/**
 * Whether the anime origin may be used in absolute form.
 *
 * The backend answers `/anime/api/*` with a CORS origin allowlist rather than
 * `*`, so only origins it already trusts may call it directly. The reference
 * assumes it is served from such an origin; here the only ones guaranteed to
 * qualify are its own domains and the local dev ports, so everything else
 * falls back to the same-origin `/anime` path that `vercel.json` proxies.
 */
function animeAbsoluteAllowed(): boolean {
  const override = queryParam('backend');
  if (override === 'local') return false;
  if (isLocalhost()) return onLocalDevPort();
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname;
  return host === 'framextv.xyz' || host.endsWith('.framextv.xyz');
}

let activeBackend: string = (() => {
  const override = queryParam('backend');
  if (override === 'xyz') return 'https://api.framextv.xyz';
  if (override === 'tech') return 'https://api.framextv.tech';
  if (override === 'cc') return 'https://api.framextv.cc';
  if (override && override !== 'prod' && override !== 'local') {
    const candidate = (override.startsWith('http') ? override : `https://${override}`).replace(/\/+$/, '');
    if (KNOWN.includes(candidate)) return candidate;
  }
  return readStored() || KNOWN[0];
})();

let activeAnimeBase = animeAbsoluteAllowed() ? `${activeBackend}/anime` : '/anime';

/** The active catalogue origin. */
export function apiBase(): string {
  return activeBackend;
}

/** The active anime origin — absolute, or same-origin `/anime` behind a proxy. */
export function animeBase(): string {
  return activeAnimeBase;
}

/** Switch the catalogue origin and announce it (the reference fires a custom event). */
export function setApiBase(next: string): void {
  const trimmed = next.replace(/\/+$/, '');
  activeBackend = trimmed;
  writeStored(trimmed);
  activeAnimeBase = animeAbsoluteAllowed() ? `${trimmed}/anime` : '/anime';
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('framextv:backend_switch', {
          detail: { newBackend: trimmed, activeBackend: trimmed },
        })
      );
    } catch {
      /* older browsers */
    }
  }
}

/** Rotate to the next known backend, used by the fetch failover. */
export function failover(current?: string): string {
  const from = current ? current.replace(/\/+$/, '') : activeBackend;
  let index = KNOWN.indexOf(from);
  if (index === -1) index = KNOWN.indexOf(activeBackend);
  const next = KNOWN[(index + 1) % KNOWN.length];
  console.warn(`[FrameX Failover] Switching active backend from ${from} -> ${next}`);
  setApiBase(next);
  return next;
}

/** The reference site's own origin, used to build embed URLs. */
export const SITE_URL = 'https://framextv.xyz';

/** Optional fan-out workers the reference uses for ads/telemetry. Unused here. */
export const FRAPPE_WORKER = 'https://frappe.hybrows.workers.dev';
export const CRAP_WORKER = 'https://crap.hybrows.workers.dev';

let failoverInstalled = false;

/**
 * Wrap `window.fetch` so a 5xx or a network error from the active backend
 * rotates to the next one and retries, exactly as the reference does.
 *
 * Only requests whose URL starts with a known backend are touched; everything
 * else (the anime origin, AniList, TMDB images, the dev proxy) passes straight
 * through. Anime requests are deliberately excluded: they carry a CORS origin
 * allowlist, so rotating the host would not fix a rejected origin and would
 * only add latency.
 */
export function installFetchFailover(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const existing = window.fetch as typeof window.fetch & { __framex_failover?: boolean };
  if (existing.__framex_failover) return;

  const original = window.fetch.bind(window);
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : typeof Request !== 'undefined' && input instanceof Request
          ? input.url
          : input && typeof (input as URL).href === 'string'
            ? (input as URL).href
            : String(input);

    const host = KNOWN.find((candidate) => url.startsWith(candidate));
    if (!host || url.startsWith(`${host}/anime`)) return original(input, init);

    let currentUrl = url;
    let currentHost = host;
    let attempts = 0;
    let lastError: unknown = null;

    while (attempts < KNOWN.length) {
      attempts += 1;
      try {
        let request: RequestInfo | URL = currentUrl;
        if (typeof Request !== 'undefined' && input instanceof Request && currentUrl !== url) {
          request = new Request(currentUrl, input);
        }
        const response = await original(request, init);
        if (response.status >= 500 && response.status <= 599 && attempts < KNOWN.length) {
          console.warn(`[FrameX Failover] Backend ${currentHost} returned HTTP ${response.status} for ${currentUrl}`);
          const next = failover(currentHost);
          currentUrl = currentUrl.replace(currentHost, next);
          currentHost = next;
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`[FrameX Failover] Request to ${currentHost} failed:`, error);
        if (attempts < KNOWN.length) {
          const next = failover(currentHost);
          currentUrl = currentUrl.replace(currentHost, next);
          currentHost = next;
          continue;
        }
      }
    }
    if (lastError) throw lastError;
    return original(input, init);
  };

  (wrapped as typeof wrapped & { __framex_failover?: boolean }).__framex_failover = true;
  window.fetch = wrapped;
  failoverInstalled = true;

  console.info(`[FrameX Config] Target Backend: ${apiBase()} (Anime: ${animeBase()})`);
}

/** True once `installFetchFailover` has run (kept for parity/debug). */
export function isFailoverInstalled(): boolean {
  return failoverInstalled;
}
