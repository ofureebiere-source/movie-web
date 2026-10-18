/**
 * The framextv.xyz catalogue, as the rest of the app sees it.
 *
 * The site is a Vite SPA; the data lives on its backend, which is a keyless
 * TMDB proxy with Kitsu for anime. No API key, no account, no token: every
 * call here is a plain GET. That is the whole reason this provider was chosen
 * over TMDB-direct — a deploy with no credentials at all still browses and
 * plays.
 *
 * Shapes probed live on 2026-10-18:
 *
 *   GET /api/home                       → { hero, rails{…} }
 *   GET /api/discover?type=&page=&genre=&year=
 *   GET /api/search?q=&page=
 *   GET /api/details?id=&type=          → + cast, videos, similar, seasons
 *   GET /api/season?id=&season=         → episodes[]
 *   GET /api/stream?id=&type=&season=&episode=
 *   GET /api/genres?type=
 *   GET /anime/api/discover?page=       → Kitsu posters (media.kitsu.app)
 *
 * Two things it does NOT do, which shape the app:
 *
 *  1. **No country filter.** `country`/`with_origin_country`/`region` are all
 *     ignored (verified: identical result pages). Country browse is therefore
 *     served by `lib/framextv-taxonomy`'s static taxonomy, which keeps the
 *     existing `/movies/country/*` routes alive without pretending to filter.
 *  2. **No rated sort.** `sort_by`/`order` are ignored; only `genre` and
 *     `year` narrow a list. The filter bar's year sort is dropped rather than
 *     faked over a single page.
 *
 * Playback is the backend's `/api/stream` m3u8 (CORS `*`, reachable from any
 * country, 60+ subtitle tracks), with framextv's own `/embed/{type}/{id}` as
 * the backup iframe. Both are keyless.
 */

/**
 * The catalogue origin.
 *
 * Read from a `NEXT_PUBLIC_` variable because the fetch happens in the
 * browser (see the fetch layer below) and Next only inlines that prefix into
 * client bundles. This is a public catalogue URL, not a credential, so
 * exposing it is intended.
 *
 * `CATALOG_API_BASE` is still honoured as a fallback so an existing
 * deployment that only sets the server-side name keeps working.
 */
const API_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_API_BASE ??
  process.env.CATALOG_API_BASE ??
  'https://api.framextv.tech'
).replace(/\/+$/, '');
const TIMEOUT_MS = 12000;

/** The site's own origin, used to build embed/backup URLs. */
export const FRAMEXTV_SITE = 'https://framextv.xyz';

/** Cache windows, in seconds. */
const REVALIDATE = {
  list: 60 * 15,
  detail: 60 * 30,
  taxonomy: 60 * 60 * 24,
  search: 60 * 5,
} as const;

export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

// ============================================================================
// RAW SHAPES
// ============================================================================

/** A row from `/api/discover`, `/api/search`, `/api/home` rails, `/anime/api/*`. */
export interface FxItem {
  id: string;
  title: string;
  /** `movie` | `tv` | `anime`. */
  type?: string;
  rating?: string;
  image?: string;
  year?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  genres?: string[];
}

export interface FxList {
  success: boolean;
  page?: number;
  totalPages?: number;
  totalResults?: number;
  results: FxItem[];
}

export interface FxCastMember {
  id?: number;
  name: string;
  character?: string;
  profile?: string;
  profile_path?: string;
}

export interface FxSeason {
  id?: number;
  season_number: number;
  name: string;
  overview?: string;
  poster?: string;
  poster_path?: string;
  episode_count?: number;
  air_date?: string;
}

export interface FxVideo {
  id?: string;
  key: string;
  name?: string;
  site?: string;
  type?: string;
}

export interface FxDetail {
  success: boolean;
  id: string;
  title: string;
  type?: string;
  tagline?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  genres?: string[];
  rating?: string;
  release_date?: string;
  year?: string;
  runtime?: number;
  number_of_seasons?: number;
  seasons?: FxSeason[];
  cast?: FxCastMember[];
  trailers?: FxVideo[];
  videos?: FxVideo[];
  similar?: FxItem[];
  recommendations?: FxItem[];
}

export interface FxEpisode {
  id?: number;
  number?: number;
  episode_number?: number;
  season_number?: number;
  name: string;
  overview?: string;
  still?: string;
  still_path?: string;
  air_date?: string;
  vote_average?: number;
}

export interface FxSeasonDetail {
  success: boolean;
  season_number?: number;
  number?: number;
  name?: string;
  overview?: string;
  poster?: string;
  episodes?: FxEpisode[];
}

export interface FxStreamSource {
  url: string;
  quality?: string;
  type?: string;
  server?: string;
}

export interface FxSubtitle {
  url: string;
  label?: string;
  lang?: string;
  language?: string;
  format?: string;
  source?: string;
}

export interface FxStream {
  success: boolean;
  provider?: string;
  server?: string;
  sources?: FxStreamSource[];
  subtitles?: FxSubtitle[];
  error?: string;
}

export interface FxHome {
  success: boolean;
  hero?: FxItem;
  rails?: Record<string, FxList>;
}

// ============================================================================
// FETCH
// ============================================================================

/**
 * Fetch layer.
 *
 * This runs in the BROWSER, not on the server, and that is deliberate. The
 * catalogue host is behind Cloudflare, which answers Vercel's datacenter IPs
 * with a 403 bot challenge ("Just a moment...") — every server-side fetch
 * returns an interstitial instead of JSON, which is why the first deployment
 * rendered an empty page. The visitor's own IP is not challenged, so the
 * request is made from their browser and the block never applies. The API
 * sends `access-control-allow-origin: *`, so this is a plain cross-origin
 * read with no proxy.
 *
 * Two consequences shape the code below:
 *
 *  - `next: { revalidate }` is a server-only option and is ignored (or worse,
 *    warns) in the browser, so caching is handled here instead, in
 *    `sessionStorage`. That is also what makes navigation feel instant: a rail
 *    visited once is painted from cache with no network round trip.
 *  - A response that is not JSON is almost always the Cloudflare challenge.
 *    It is reported as such rather than as a generic parse error.
 */

/** In-flight requests, so two components asking for the same rail share one. */
const inflight = new Map<string, Promise<unknown>>();

const CACHE_PREFIX = 'mw_cat:';

/** Read-through cache. TTL comes from the caller's revalidate window. */
function readCache<T>(key: string, ttlSec: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; body: T };
    if (Date.now() - parsed.at > ttlSec * 1000) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.body;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, body: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), body }));
  } catch {
    // Quota or private mode — the cache is an optimisation, never a requirement.
  }
}

/**
 * Warm the cache for a path without needing the result. Used by the hover
 * prefetch so a link is ready before it is clicked.
 */
export function prefetchCatalog(path: string, params: Record<string, string | number | undefined> = {}): void {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const url = `${API_BASE}${path}${search.toString() ? `?${search}` : ''}`;
  void apiFetch(path, params, 0, url);
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
  presetUrl?: string
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const url = presetUrl ?? `${API_BASE}${path}${search.toString() ? `?${search}` : ''}`;

  if (revalidate > 0) {
    const cached = readCache<T>(url, revalidate);
    if (cached !== null) return cached;
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
  }

  const request = (async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
        // Cross-origin read; the API opts in with `allow-origin: *`.
        mode: 'cors',
        cache: 'no-store',
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        // The challenge page is HTML served with a 403. Naming it here saves
        // whoever reads the next failure report from re-deriving this.
        throw new CatalogApiError(
          `Catalogue returned non-JSON (${res.status}, ${contentType || 'no content-type'})`,
          res.status,
          path
        );
      }
      if (!res.ok) {
        throw new CatalogApiError(`Catalogue responded ${res.status}`, res.status, path);
      }

      const body = (await res.json()) as T & { success?: unknown };
      // This backend answers unknown paths with a 200 `{status:"ok",name:…}`
      // health payload rather than a 404, so "did we get the field we asked
      // for" is the real success test — callers check the shape.
      if (body?.success === false && !(body as { error?: unknown }).error) {
        throw new CatalogApiError('Catalogue reported success:false', 404, path);
      }
      if (revalidate > 0) writeCache(url, body);
      return body;
    } catch (err) {
      if (err instanceof CatalogApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new CatalogApiError(`Catalogue timed out after ${TIMEOUT_MS}ms`, 408, path);
      }
      throw new CatalogApiError(
        err instanceof Error ? err.message : 'Catalogue request failed',
        0,
        path
      );
    } finally {
      clearTimeout(timer);
    }
  })();

  if (revalidate > 0) {
    inflight.set(url, request);
    request.finally(() => inflight.delete(url)).catch(() => {
      /* the consumer handles the rejection */
    });
  }
  return request;
}

// ============================================================================
// LISTS
// ============================================================================

export interface FxPage {
  items: FxItem[];
  page: number;
  totalPages: number;
  totalItems: number;
}

function toPage(list: FxList | undefined, path: string): FxPage {
  if (!list || !Array.isArray(list.results)) {
    throw new CatalogApiError('Catalogue list response has no results', 0, path);
  }
  return {
    items: list.results,
    page: list.page ?? 1,
    totalPages: list.totalPages ?? 1,
    totalItems: list.totalResults ?? list.results.length,
  };
}

/** The whole catalogue for one media type, paged. */
export async function discover(
  type: 'movie' | 'tv' | 'anime',
  params: { page?: number; genre?: string | number; year?: string | number } = {}
): Promise<FxPage> {
  if (type === 'anime') {
    const body = await apiFetch<FxList>('/anime/api/discover', { page: params.page ?? 1 }, REVALIDATE.list);
    return toPage(body, '/anime/api/discover');
  }
  const body = await apiFetch<FxList>(
    '/api/discover',
    { type, page: params.page ?? 1, genre: params.genre, year: params.year },
    REVALIDATE.list
  );
  return toPage(body, '/api/discover');
}

/** Keyword search across films and series. */
export async function searchTitles(query: string, page = 1): Promise<FxPage> {
  const body = await apiFetch<FxList>('/api/search', { q: query.trim(), page }, REVALIDATE.search);
  return toPage(body, '/api/search');
}

/** The curated home payload: one hero plus named rails. */
export async function getHome(): Promise<FxHome> {
  return apiFetch<FxHome>('/api/home', {}, REVALIDATE.list);
}

// ============================================================================
// DETAIL
// ============================================================================

/**
 * One title with cast, videos, recommendations and (for a series) seasons.
 *
 * Returns null when the id is unknown. A timeout or 5xx still throws: "the
 * provider is down" must not read as "this title does not exist".
 */
export async function getDetail(id: string, type: string): Promise<FxDetail | null> {
  try {
    const body = await apiFetch<FxDetail>('/api/details', { id, type: type === 'anime' ? 'anime' : type }, REVALIDATE.detail);
    return body && body.id ? body : null;
  } catch (err) {
    if (err instanceof CatalogApiError && err.status === 404) return null;
    throw err;
  }
}

/** The episodes of one season. Empty for a season with none. */
export async function getSeason(id: string, season: number): Promise<FxEpisode[]> {
  try {
    const body = await apiFetch<FxSeasonDetail>('/api/season', { id, season }, REVALIDATE.detail);
    return body.episodes ?? [];
  } catch {
    return [];
  }
}

/** The playable stream for one title (or one episode). */
export async function getStream(
  id: string,
  type: string,
  opts: { season?: number; episode?: number } = {}
): Promise<FxStream | null> {
  const path = type === 'anime' ? '/anime/api/stream' : '/api/stream';
  try {
    return await apiFetch<FxStream>(
      path,
      { id, type, season: opts.season, episode: opts.episode },
      REVALIDATE.search
    );
  } catch {
    return null;
  }
}

/** Live genre list, for drift checks against the static taxonomy. */
export async function getGenres(type: 'movie' | 'tv' = 'movie'): Promise<{ id: number; name: string }[]> {
  const body = await apiFetch<{ genres: { id: number; name: string }[] }>('/api/genres', { type }, REVALIDATE.taxonomy);
  return body.genres ?? [];
}
