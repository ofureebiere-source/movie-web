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
 *  2. **No sort.** `sort_by`, `order`, `sort_field`/`sort_type` and every
 *     `sortBy` value are all ignored (verified: identical result pages, and
 *     `sort=…` 400s). Genre and year DO narrow — year through `seasonYear`,
 *     not `year`. Since the upstream will not order results, the anime grid
 *     sorts the pages it has loaded in the browser, and says so, rather than
 *     offering a control that reorders nothing.
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

/**
 * An anime row. The anime catalogue is a different upstream (Kitsu, fronted by
 * AniList ids) so its rows carry two fields the TMDB-shaped `FxItem` has no
 * place for: `synopsis` (Kitsu's word for `overview`) and `anilistId`, which
 * is what the detail and stream calls address the title by.
 */
export interface FxAnimeItem extends FxItem {
  synopsis?: string;
  anilistId?: string;
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
  const query = search.toString();

  const directUrl = presetUrl ?? `${API_BASE}${path}${query ? `?${query}` : ''}`;

  if (revalidate > 0) {
    const cached = readCache<T>(directUrl, revalidate);
    if (cached !== null) return cached;
    const pending = inflight.get(directUrl);
    if (pending) return pending as Promise<T>;
  }

  const request = (async (): Promise<T> => {
    const body = await fetchWithFallback<T>(directUrl, path, query);
    if (revalidate > 0) writeCache(directUrl, body);
    return body;
  })().catch((err: unknown) => {
    if (err instanceof CatalogApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new CatalogApiError(`Catalogue timed out after ${TIMEOUT_MS}ms`, 408, path);
    }
    throw new CatalogApiError(
      err instanceof Error ? err.message : 'Catalogue request failed',
      0,
      path
    );
  });

  if (revalidate > 0) {
    inflight.set(directUrl, request);
    request.finally(() => inflight.delete(directUrl)).catch(() => {
      /* the consumer handles the rejection */
    });
  }
  return request;
}

/**
 * Read a catalogue path, preferring the browser's own connection.
 *
 * The direct read is tried first because it is the fastest path and the
 * film/series endpoints allow it (`access-control-allow-origin: *`). It cannot
 * be the only path, though, for two independent reasons:
 *
 *  - The `/anime/api/*` endpoints send no CORS header at all, so the browser
 *    refuses to hand the response to us no matter what. Those calls only ever
 *    succeed through the same-origin Edge proxy in `app/api/catalog`.
 *  - A visitor behind a filtering proxy or a restrictive extension can have
 *    the direct read blocked while the proxy still works.
 *
 * So a failure falls through to the proxy rather than surfacing. Each attempt
 * gets its own timeout, so a direct read that hangs does not consume the
 * proxy's budget too.
 */
async function fetchWithFallback<T>(
  directUrl: string,
  path: string,
  query: string
): Promise<T> {
  const proxyUrl = `/api/catalog${path}${query ? `?${query}` : ''}`;
  const attempts = directUrl === proxyUrl ? [proxyUrl] : [directUrl, proxyUrl];

  let lastError: unknown;
  for (const url of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await readJson<T>(url, path, controller.signal);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new CatalogApiError('Catalogue request failed', 0, path);
}

async function readJson<T>(url: string, path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
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
  return body;
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
    // Anime filters by genre NAME (`Action`), not the numeric TMDB id the
    // film/series endpoints take — so a numeric `genre` is dropped rather
    // than sent and silently ignored.
    //
    // Its year parameter is `seasonYear`, not the `year` the film endpoint
    // takes. This is not cosmetic: `/anime/api/discover?year=2020` is accepted
    // and ignored (verified — it returns the unfiltered page), so sending
    // `year` would leave a year filter that looks applied and filters nothing.
    // `seasonYear=2020` genuinely narrows (877 results against 22,513).
    const body = await apiFetch<FxList>(
      '/anime/api/discover',
      {
        page: params.page ?? 1,
        genre: typeof params.genre === 'string' ? params.genre : undefined,
        seasonYear: params.year,
      },
      REVALIDATE.list
    );
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
  opts: { season?: number; episode?: number; provider?: string } = {}
): Promise<FxStream | null> {
  const path = type === 'anime' ? '/anime/api/stream' : '/api/stream';
  try {
    return await apiFetch<FxStream>(
      path,
      { id, type, season: opts.season, episode: opts.episode, provider: opts.provider },
      REVALIDATE.search
    );
  } catch {
    return null;
  }
}

/**
 * One entry of the aggregator's server registry.
 *
 * `id` is what `/api/stream?provider=` accepts; `name` and `tagline` are the
 * provider's own display strings ("Bowler XVIII", "Multi-Language"). `status`
 * is the registry's own health claim and is not proof the server carries a
 * given title — only a probe can say that.
 */
export interface FxProvider {
  id: string;
  name: string;
  tagline?: string;
  category?: string;
  status?: string;
  audio?: string;
}

/**
 * The aggregator's server list.
 *
 * Used to offer the viewer a server choice, the way the source site's player
 * does. Read client-side like every other catalogue call (the host refuses
 * datacenter IPs), and an empty list on any failure: a title with no server
 * picker still plays, because the backend picks a default when `provider` is
 * absent.
 */
export async function getProviders(anime = false): Promise<FxProvider[]> {
  const path = anime ? '/anime/api/providers' : '/api/providers';
  try {
    const body = await apiFetch<{ providers?: FxProvider[] }>(path, {}, REVALIDATE.taxonomy);
    return (body.providers ?? []).filter((p) => p?.id);
  } catch {
    return [];
  }
}

/** Live genre list, for drift checks against the static taxonomy. */
export async function getGenres(type: 'movie' | 'tv' = 'movie'): Promise<{ id: number; name: string }[]> {
  const body = await apiFetch<{ genres: { id: number; name: string }[] }>('/api/genres', { type }, REVALIDATE.taxonomy);
  return body.genres ?? [];
}

// ============================================================================
// ANIME DETAIL — AniList
// ============================================================================

/**
 * An anime title's own metadata, from AniList.
 *
 * The catalogue's `/api/details` is a TMDB proxy, and anime ids are AniList
 * ids (16498), not TMDB ids — so asking it for one returns
 * `{"error":"TMDB returned HTTP 404"}`. The anime catalogue carries only what
 * a poster grid needs (title, art, year, rating, genres, a synopsis), which
 * leaves the detail page with no runtime, no episode list and no cast.
 *
 * AniList's public GraphQL API fills exactly that gap, keylessly, and sends
 * `access-control-allow-origin: *` so the browser can call it directly — the
 * same reason every other call here runs client-side. This is the endpoint
 * framextv.xyz's own anime pages read, so the two sites agree on the data.
 */
export interface AniListMedia {
  id: number;
  title?: { romaji?: string; english?: string; native?: string };
  description?: string;
  coverImage?: { extraLarge?: string; large?: string };
  bannerImage?: string;
  averageScore?: number;
  popularity?: number;
  episodes?: number;
  duration?: number;
  status?: string;
  format?: string;
  seasonYear?: number;
  genres?: string[];
  characters?: {
    edges?: { role?: string; node?: { id: number; name?: { full?: string }; image?: { large?: string } } }[];
  };
  streamingEpisodes?: { title?: string; thumbnail?: string; url?: string }[];
}

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const ANILIST_MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge large }
    bannerImage
    averageScore
    popularity
    episodes
    duration
    status
    format
    seasonYear
    genres
    characters(sort: [ROLE, RELEVANCE], perPage: 12) {
      edges { role node { id name { full } image { large } } }
    }
    streamingEpisodes { title thumbnail url }
  }
}`;

/**
 * Fetch one anime's AniList record.
 *
 * Returns null on any failure — a title with no AniList record still renders
 * from the catalogue's own data, so this is an enhancement, never a gate.
 */
export async function getAniListMedia(id: string): Promise<AniListMedia | null> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const cacheKey = `anilist:${numericId}`;
  const cached = readCache<AniListMedia>(cacheKey, REVALIDATE.detail);
  if (cached !== null) return cached;
  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<AniListMedia | null>;

  const request = (async (): Promise<AniListMedia | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_MEDIA_QUERY, variables: { id: numericId } }),
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { Media?: AniListMedia } };
      const media = body?.data?.Media ?? null;
      if (media) writeCache(cacheKey, media);
      return media;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();

  inflight.set(cacheKey, request);
  request.finally(() => inflight.delete(cacheKey)).catch(() => {
    /* the consumer handles the rejection */
  });
  return request;
}
