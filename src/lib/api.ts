import { animeBase, apiBase, SITE_URL } from './config';
import { mediaId } from './id';

/**
 * The frameXTV catalogue, as the app sees it.
 *
 * Every endpoint here was read off frameXTV.xyz's own network layer:
 *
 *   GET /api/home                              → { hero, rails{…} }
 *   GET /api/discover?type=&category=&genre=&year=&sort=&min_rating=&page=
 *   GET /anime/api/discover?category=&genre=&seasonYear=&season=&status=&sort=&page=&perPage=
 *   GET /api/search?q=&type=&page=
 *   GET /api/details?id=&type=                 → + cast, videos, similar, seasons
 *   GET /api/season?id=&season=                → episodes[]
 *   GET /api/stream?type=&id=&season=&episode=&provider=
 *   GET /anime/api/stream?…
 *   GET /api/providers                         → { providers[] }
 *   GET /api/meta?id=&type=&season=&episode=
 *   GET /api/subtitles?id=&type=&season=&episode=
 *   GET /api/stream/check?id=&type=&provider=&season=&episode=
 *
 * Keyless: no token, no account. `apiBase()` is resolved in `config.ts` and
 * `installFetchFailover()` rotates hosts on 5xx/network errors.
 */

export { SITE_URL };

// ============================================================================
// SHAPES
// ============================================================================

export type MediaType = 'movie' | 'tv' | 'anime';

/** A row from `/api/discover`, `/api/search`, `/api/home` rails, `/anime/api/*`. */
export interface FxItem {
  id: string;
  title: string;
  type?: string;
  rating?: string;
  image?: string;
  year?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  genres?: string[];
  /** Kitsu's word for `overview`; anime rows carry it. */
  synopsis?: string;
  /** Anime rows are addressed by AniList id for detail/stream. */
  anilistId?: string;
  episodeCount?: number;
  season?: number;
  episode?: number;
  /** Set on AniList relation rows (`SEQUEL`, `PREQUEL`, …). */
  relationType?: string;
}

export interface FxList {
  success: boolean;
  page?: number;
  totalPages?: number;
  totalResults?: number;
  results: FxItem[] | null;
  warning?: string;
  error?: string;
}

export interface FxCastMember {
  id?: number;
  name: string;
  character?: string;
  profile?: string;
  profile_path?: string;
}

export interface FxSeason {
  id?: number | string;
  number: number;
  name?: string;
  overview?: string;
  poster?: string;
  poster_path?: string;
  episodeCount?: number;
  episode_count?: number;
  airDate?: string;
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
  success?: boolean;
  id: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  releaseDate?: string;
  year?: string;
  rating?: string;
  voteCount?: number;
  genres?: string[];
  runtime?: number;
  status?: string;
  tagline?: string;
  cast?: FxCastMember[];
  videos?: FxVideo[];
  recommendations?: FxItem[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: FxSeason[];
  /* anime-only, from AniList */
  episodes?: number;
  studios?: string[];
  trailer?: { id?: string; site?: string };
  relatedAnime?: FxItem[];
}

export interface FxEpisode {
  id?: number | string;
  number: number;
  name: string;
  overview?: string;
  still?: string;
  still_path?: string;
  airDate?: string;
  air_date?: string;
  rating?: string;
  runtime?: number;
}

export interface FxAudioTrack {
  id: string;
  language?: string;
  label?: string;
  default?: boolean;
}

export interface FxStreamSource {
  url: string;
  quality?: string;
  type?: string;
  server?: string;
  skipProxy?: boolean;
  audioTracks?: FxAudioTrack[];
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

export interface FxProvider {
  id: string;
  name: string;
  tagline?: string;
  category?: string;
  status?: string;
  audio?: string;
}

export interface FxHome {
  success: boolean;
  hero?: FxItem;
  rails?: Record<string, FxList>;
}

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
// FETCH
// ============================================================================

function buildUrl(path: string, params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  // The anime origin already ends in `/anime` (see config.ts), so the `/anime`
  // prefix is dropped from the path here rather than duplicated. This is the
  // same rewrite the reference's `AnimeEmbedPage` applies.
  const base = path.startsWith('/anime') ? `${animeBase()}${path.replace(/^\/anime/, '')}` : `${apiBase()}${path}`;
  return `${base}${query ? `?${query}` : ''}`;
}

/**
 * The headers a browser sends on its own, spelled out.
 *
 * The aggregator sits behind Cloudflare, which answers a request that does not
 * look like it came from a page with an empty body or an HTML interstitial
 * rather than an error status. A same-origin `fetch` from the app already
 * carries most of these, but naming them makes the request unambiguous and
 * keeps the resolution path a plain client call — no server proxy to be
 * challenged in the first place.
 */
const CLIENT_HEADERS: Record<string, string> = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
};

/** True when a response body is a Cloudflare challenge rather than the catalogue. */
function looksBlocked(contentType: string): boolean {
  return !contentType || !contentType.includes('json');
}

async function readJson<T>(url: string, path: string, init?: RequestInit): Promise<T> {
  // The call is always a client fetch: `cors` mode, credentials omitted, so no
  // cookie or server context travels with it and Cloudflare has nothing to
  // challenge. The aggregator does intermittently reset the connection or
  // answer with a challenge instead of JSON, so both a thrown network error and
  // a blocked response are retried a couple of times with a small backoff —
  // the failure is per-request rather than sticky.
  const request = (): Promise<Response> =>
    fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      ...init,
      headers: { ...CLIENT_HEADERS, ...(init?.headers || {}) },
    });

  let res: Response | null = null;
  let contentType = '';
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await request();
      contentType = res.headers.get('content-type') ?? '';
      lastError = null;
      if (!looksBlocked(contentType) && res.status < 500) break;
    } catch (error) {
      lastError = error;
      res = null;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  if (!res) {
    throw new CatalogApiError(
      lastError instanceof Error ? lastError.message : 'Catalogue request failed',
      0,
      path
    );
  }

  if (!res.ok) {
    throw new CatalogApiError(`Catalogue responded ${res.status}`, res.status, path);
  }
  // The backend answers some unknown paths with an HTML interstitial, and
  // Cloudflare answers a challenge the same way; naming it here saves whoever
  // reads the next failure report from re-deriving this.
  if (looksBlocked(contentType)) {
    throw new CatalogApiError(
      `Catalogue returned non-JSON (${res.status}, ${contentType || 'no content-type'})`,
      res.status,
      path
    );
  }
  const body = (await res.json()) as T & { success?: boolean; error?: string };
  if (body?.success === false && body.error) {
    throw new CatalogApiError(body.error, 200, path);
  }
  return body;
}

/** GET a catalogue path, throwing `CatalogApiError` on any failure. */
export async function apiGet<T>(
  path: string,
  params: Record<string, unknown> = {},
  init?: RequestInit
): Promise<T> {
  return readJson<T>(buildUrl(path, params), path, init);
}

/** Same as `apiGet` but resolves to `null` instead of throwing. */
async function apiGetOrNull<T>(
  path: string,
  params: Record<string, unknown> = {},
  init?: RequestInit
): Promise<T | null> {
  try {
    return await apiGet<T>(path, params, init);
  } catch {
    return null;
  }
}

// ============================================================================
// LISTS
// ============================================================================

export interface FxPage {
  items: FxItem[];
  page: number;
  totalPages: number;
  totalItems: number;
  warning?: string;
}

function toPage(list: FxList | undefined | null, path: string): FxPage {
  if (!list || typeof list !== 'object') {
    throw new CatalogApiError('Catalogue list response has no results', 0, path);
  }
  // A filter with no rows answers `{success:true,totalResults:0,results:null}`
  // — a real empty page, not a failure.
  const results = Array.isArray(list.results) ? list.results : [];
  return {
    items: results,
    page: list.page ?? 1,
    totalPages: list.totalPages ?? 1,
    totalItems: list.totalResults ?? results.length,
    warning: list.warning,
  };
}

export interface DiscoverParams {
  category?: string;
  genre?: string | number;
  year?: string | number;
  sort?: string;
  minRating?: string | number;
  page?: number;
  /** anime only */
  seasonYear?: string | number;
  season?: string;
  status?: string;
  minScore?: string | number;
  perPage?: number;
}

/** One page of the film/series catalogue. */
export async function discover(type: 'movie' | 'tv', params: DiscoverParams = {}): Promise<FxPage> {
  const body = await apiGet<FxList>('/api/discover', {
    type,
    category: params.category,
    genre: params.genre,
    year: params.year,
    sort: params.sort,
    min_rating: params.minRating,
    page: params.page ?? 1,
  });
  return toPage(body, '/api/discover');
}

/**
 * One page of the anime catalogue.
 *
 * A different upstream (Kitsu, fronted by AniList ids): genre is a NAME
 * (`Action`) not a TMDB id, the year parameter is `seasonYear` (plain `year`
 * is accepted and ignored), and the page size is `perPage`.
 */
export async function discoverAnime(params: DiscoverParams = {}): Promise<FxPage> {
  const body = await apiGet<FxList>('/anime/api/discover', {
    category: params.category,
    genre: params.genre,
    seasonYear: params.seasonYear ?? params.year,
    season: params.season,
    status: params.status,
    minScore: params.minScore,
    sort: params.sort,
    page: params.page ?? 1,
    perPage: params.perPage ?? 24,
  });
  return toPage(body, '/anime/api/discover');
}

/** Keyword search across films and series (the shared TMDB-backed index). */
export async function searchTitles(
  query: string,
  type: 'all' | 'movie' | 'tv' = 'all',
  page = 1
): Promise<FxPage> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], page: 1, totalPages: 0, totalItems: 0 };
  const body = await apiGet<FxList>('/api/search', { q: trimmed, type, page });
  return toPage(body, '/api/search');
}

/** The curated home payload: one hero plus named rails. */
export async function getHome(): Promise<FxHome> {
  return apiGet<FxHome>('/api/home');
}

// ============================================================================
// DETAIL
// ============================================================================

/** One title with cast, videos, recommendations and (for a series) seasons. */
export async function getDetail(id: string, type: MediaType): Promise<FxDetail | null> {
  const clean = mediaId(id);
  if (!clean) throw new CatalogApiError('Valid title ID is required', 0, '/api/details');
  try {
    const body = await apiGet<FxDetail>('/api/details', { id: clean, type });
    if (!body?.id) return null;
    return {
      ...body,
      id: String(body.id),
      type: body.type === 'tv' ? 'tv' : body.type === 'anime' ? 'anime' : 'movie',
      genres: Array.isArray(body.genres) ? body.genres : [],
      cast: Array.isArray(body.cast)
        ? body.cast.map((m) => ({ ...m, profile: m.profile || m.profile_path }))
        : [],
      videos: Array.isArray(body.videos) ? body.videos : [],
      recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
      seasons: Array.isArray(body.seasons)
        ? body.seasons.map((s) => ({
            ...s,
            number: s.number ?? (s as { season_number?: number }).season_number ?? 0,
            poster: s.poster || s.poster_path,
            episodeCount: s.episodeCount ?? s.episode_count,
          }))
        : undefined,
    };
  } catch (err) {
    if (err instanceof CatalogApiError && err.status === 404) return null;
    throw err;
  }
}

/** The episodes of one season. Empty for a season with none. */
export async function getSeason(id: string, season: number): Promise<FxEpisode[]> {
  const clean = mediaId(id);
  if (!clean) return [];
  try {
    const body = await apiGet<{ success: boolean; episodes?: FxEpisode[] }>('/api/season', {
      id: clean,
      season,
    });
    if (!Array.isArray(body.episodes)) return [];
    return body.episodes.map((e) => ({
      ...e,
      number: e.number ?? (e as { episode_number?: number }).episode_number ?? 0,
      still: e.still || e.still_path,
      airDate: e.airDate || e.air_date,
      rating: e.rating || (e as { vote_average?: number }).vote_average?.toString(),
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// STREAM
// ============================================================================

/** The playable stream for one title (or one episode). */
export async function getStream(
  id: string,
  type: MediaType,
  opts: { season?: number; episode?: number; provider?: string } = {}
): Promise<FxStream | null> {
  const clean = mediaId(id);
  if (!clean) return null;
  const path = type === 'anime' ? '/anime/api/stream' : '/api/stream';
  try {
    return await apiGet<FxStream>(path, {
      type,
      id: clean,
      season: opts.season,
      episode: opts.episode,
      provider: opts.provider,
    });
  } catch {
    return null;
  }
}

/** Probe whether one provider carries a title (used by the server picker). */
export async function checkStreamProvider(
  id: string,
  type: MediaType,
  provider: string,
  opts: { season?: number; episode?: number } = {}
): Promise<boolean> {
  const clean = mediaId(id);
  if (!clean) return false;
  try {
    const body = await apiGet<{ available?: boolean }>('/api/stream/check', {
      id: clean,
      type,
      provider,
      season: opts.season,
      episode: opts.episode,
    });
    return Boolean(body.available);
  } catch {
    return false;
  }
}

/** The aggregator's server list, for the viewer-facing server picker. */
export async function getProviders(): Promise<FxProvider[]> {
  const body = await apiGetOrNull<{ providers?: FxProvider[] }>('/api/providers');
  return (body?.providers ?? []).filter((p) => p?.id);
}

/** Per-title metadata (title/year/poster) used by the media card. */
export interface FxMeta {
  success?: boolean;
  id?: string;
  title?: string;
  year?: string;
  poster?: string;
  category?: string;
}

export async function getMeta(
  id: string,
  type: MediaType,
  season = 1,
  episode = 1
): Promise<FxMeta | null> {
  const clean = mediaId(id);
  if (!clean) return null;
  return apiGetOrNull<FxMeta>('/api/meta', { id: clean, type, season, episode });
}

/** Subtitle tracks for a title. */
export async function getSubtitles(
  id: string,
  type: MediaType,
  season = 1,
  episode = 1
): Promise<FxSubtitle[]> {
  const clean = mediaId(id);
  if (!clean) return [];
  const body = await apiGetOrNull<{ subtitles?: FxSubtitle[] }>('/api/subtitles', {
    id: clean,
    type,
    ...(type === 'tv' ? { season, episode } : {}),
  });
  return body?.subtitles ?? [];
}

// ============================================================================
// IMAGES
// ============================================================================

/** A TMDB image URL, for rows that return bare `poster_path` values. */
export function tmdbImage(path: string | undefined, size: 'w500' | 'w1280' = 'w500'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The poster for a row, preferring the provider's own field. */
export function itemPoster(item: FxItem | null | undefined): string | undefined {
  if (!item) return undefined;
  return item.poster || item.image || tmdbImage((item as { poster_path?: string }).poster_path);
}

/** The backdrop for a row, falling back to the poster. */
export function itemBackdrop(item: FxItem | null | undefined): string | undefined {
  if (!item) return undefined;
  return (
    item.backdrop ||
    item.poster ||
    item.image ||
    tmdbImage((item as { backdrop_path?: string }).backdrop_path, 'w1280')
  );
}

/**
 * Normalise a raw `/api/search` row.
 *
 * The shared search index sometimes answers with TMDB field names
 * (`poster_path`, `vote_average`, `first_air_date`) instead of the catalogue's
 * own, so both spellings are accepted.
 */
export function normalizeSearchItem(raw: Record<string, unknown>): FxItem {
  const type = raw.type === 'tv' ? 'tv' : raw.type === 'anime' ? 'anime' : 'movie';
  const release = (raw.release_date as string) || (raw.first_air_date as string) || '';
  const year = (raw.year as string) || (release ? release.slice(0, 4) : undefined);
  const vote = raw.vote_average as number | undefined;
  const rating = (raw.rating as string) || (vote && vote > 0 ? vote.toFixed(1) : undefined);
  return {
    id: String(raw.id),
    type,
    title: (raw.title as string) || (raw.name as string) || 'Unknown Title',
    poster:
      (raw.poster as string) ||
      tmdbImage(raw.poster_path as string | undefined, 'w500'),
    backdrop:
      (raw.backdrop as string) ||
      tmdbImage(raw.backdrop_path as string | undefined, 'w1280'),
    overview: (raw.overview as string) || '',
    year,
    rating,
    genres: Array.isArray(raw.genres) ? (raw.genres as string[]) : [],
    anilistId: (raw.anilistId as string) || (type === 'anime' ? String(raw.id) : undefined),
  };
}
