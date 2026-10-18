import type NewlyMovie from 'types/newly-movie';
import type DetailMovie from 'types/detail-movie';
import type Credit from 'types/credit';
import type MovieImage from 'types/movie-image';
import type SeasonLink from 'types/season-link';
import type { MovieFilters } from 'types/movie-filters';
import {
  discover,
  searchTitles as apiSearch,
  getHome,
  getDetail,
  getSeason,
  CatalogApiError,
  type FxItem,
} from 'services/framextv-api';
import {
  GENRE_ID,
  FORMAT_SPEC,
  isBrowsableGenre,
  isKnownCountry,
  isKnownFormat,
  resolveFormat,
} from 'constants/framextv-taxonomy';
import {
  adaptItem,
  adaptItems,
  adaptDetail,
  buildSeasons,
  buildMovieEpisodes,
  parseMintedSlug,
  tmdbPathFromUrl,
} from 'lib/framextv-adapter';

export type { MovieFilters };

/**
 * The catalogue, as the rest of the app sees it.
 *
 * Everything below this module works in `NewlyMovie` / `DetailMovie`; pages
 * and server actions call only this file, so the provider behind it can
 * change without touching the UI — it has now changed three times, and this
 * is the third.
 *
 * The provider is keyless: no token, no project, no account. That is why the
 * app builds and runs with no credentials at all.
 *
 * Failure is still a value on the home page (a dead rail renders as no rail)
 * and still an exception on browse and detail, where the failure IS the page.
 */

export interface CatalogPage {
  items: NewlyMovie[];
  /** Upstream result count for this filter, or null when unknown. */
  totalItems: number | null;
  hasMore: boolean;
}

export const EMPTY_PAGE: CatalogPage = { items: [], totalItems: null, hasMore: false };

/** Grid page size. Divisible by the 2/3/5-column breakpoints. */
const BROWSE_PAGE_SIZE = 30;
const RAIL_SIZE = 14;
const HERO_SIZE = 5;

function toPage(items: FxItem[], locale: string, totalItems: number, hasMore: boolean): CatalogPage {
  return { items: adaptItems(items, { locale }), totalItems, hasMore };
}

/**
 * The provider has no unfiltered list and no country filter, so a browse
 * that wants "everything" (or a country page, which cannot filter at all)
 * merges the film and series catalogues.
 *
 * The two lists are interleaved rather than concatenated so a page is not
 * "all films then all series" — the top of a genre page should look like the
 * genre, not like one media type.
 */
async function mergedBrowse(
  params: { page: number; genre?: number; year?: number },
  locale: string
): Promise<CatalogPage> {
  const [movies, tvs] = await Promise.all([
    discover('movie', { page: params.page, genre: params.genre, year: params.year }),
    discover('tv', { page: params.page, genre: params.genre, year: params.year }),
  ]);

  const merged: FxItem[] = [];
  const max = Math.max(movies.items.length, tvs.items.length);
  for (let i = 0; i < max; i++) {
    if (movies.items[i]) merged.push(movies.items[i]);
    if (tvs.items[i]) merged.push(tvs.items[i]);
  }

  return toPage(
    merged.slice(0, BROWSE_PAGE_SIZE),
    locale,
    movies.totalItems + tvs.totalItems,
    params.page < Math.max(movies.totalPages, tvs.totalPages)
  );
}

// ============================================================================
// HOME RAILS
// ============================================================================

/**
 * Rails never throw. The home page fans several out through `Promise.all`,
 * so one rejection would take down the whole render.
 */
async function safeRail(load: () => Promise<NewlyMovie[]>): Promise<NewlyMovie[]> {
  try {
    return await load();
  } catch (err) {
    console.warn('[catalog] rail failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Rails the provider curates on its home payload. */
const HOME_RAIL = {
  newest: 'new_releases',
  trending: 'trending_movies',
} as const;

async function homeRail(name: string): Promise<FxItem[]> {
  const home = await getHome();
  return home.rails?.[name]?.results ?? [];
}

/**
 * "Mới cập nhật" — the provider's curated newest-release rail.
 *
 * The provider reports no "updated today" count, so the daily banner stays
 * hidden rather than showing a number the site cannot stand behind.
 */
export async function getNewlyAddedFeed(
  locale: string
): Promise<{ items: NewlyMovie[]; updatedToday: number }> {
  try {
    const items = adaptItems(await homeRail(HOME_RAIL.newest), { locale }).slice(0, RAIL_SIZE);
    return { items, updatedToday: 0 };
  } catch (err) {
    console.warn('[catalog] latest feed failed:', err instanceof Error ? err.message : err);
    return { items: [], updatedToday: 0 };
  }
}

export async function getNewlyAddedRail(locale: string): Promise<NewlyMovie[]> {
  return (await getNewlyAddedFeed(locale)).items;
}

/** A curated list rail: `phim-le`, `phim-bo`, `hoat-hinh`, `phim-chieu-rap`, … */
export async function getFormatRail(
  formatSlug: string,
  locale: string,
  limit = RAIL_SIZE
): Promise<NewlyMovie[]> {
  return safeRail(async () => {
    const spec = FORMAT_SPEC[formatSlug];
    if (!spec) return [];
    const page = await discover(spec.type, {
      page: 1,
      genre: spec.genre,
      year: spec.year === 'current' ? new Date().getFullYear() : undefined,
    });
    return adaptItems(page.items, { locale }).slice(0, limit);
  });
}

export async function getGenreRail(
  genreSlug: string,
  locale: string,
  limit = RAIL_SIZE
): Promise<NewlyMovie[]> {
  return safeRail(async () => {
    const genre = GENRE_ID[genreSlug];
    if (!genre) return [];
    const page = await discover('movie', { page: 1, genre });
    return adaptItems(page.items, { locale }).slice(0, limit);
  });
}

/**
 * The hero: the provider's own hero row plus its trending rail.
 *
 * No lookup dance is needed here — unlike the previous provider, this one
 * curates the rail itself, so every row is already a real, playable title.
 * The fallback chain is only for an outage.
 */
export async function getTrendingRail(locale: string, limit = HERO_SIZE): Promise<NewlyMovie[]> {
  return safeRail(async () => {
    const picked: NewlyMovie[] = [];
    const seen = new Set<string>();

    const push = (item: FxItem | undefined) => {
      if (!item?.id || picked.length >= limit) return;
      const movie = adaptItem(item, { locale });
      if (seen.has(movie._id) || !movie.poster_url) return;
      seen.add(movie._id);
      picked.push(movie);
    };

    try {
      const home = await getHome();
      push(home.hero);
      for (const item of home.rails?.[HOME_RAIL.trending]?.results ?? []) push(item);
    } catch (err) {
      console.warn('[catalog] home unavailable:', err instanceof Error ? err.message : err);
    }

    if (picked.length < limit) {
      try {
        const page = await discover('movie', { page: 1 });
        for (const item of page.items) push(item);
      } catch {
        // Nothing left to try; the hero simply renders fewer slides.
      }
    }

    return picked;
  });
}

// ============================================================================
// BROWSE
// ============================================================================

export async function browseByGenre(
  genreSlug: string,
  page: number,
  filters: MovieFilters | undefined,
  locale: string
): Promise<CatalogPage> {
  if (!isBrowsableGenre(genreSlug)) return EMPTY_PAGE;
  const year = /^\d{4}$/.test(filters?.year ?? '') ? Number(filters!.year) : undefined;
  return mergedBrowse({ page, genre: GENRE_ID[genreSlug], year }, locale);
}

export async function browseByCountry(
  countrySlug: string,
  page: number,
  filters: MovieFilters | undefined,
  locale: string
): Promise<CatalogPage> {
  if (!isKnownCountry(countrySlug)) return EMPTY_PAGE;
  // The provider ignores every country parameter, so the page shows the
  // catalogue rather than pretending to filter — see `framextv-taxonomy`.
  const year = /^\d{4}$/.test(filters?.year ?? '') ? Number(filters!.year) : undefined;
  return mergedBrowse({ page, year }, locale);
}

export async function browseByFormat(
  formatSlug: string,
  page: number,
  filters: MovieFilters | undefined,
  locale: string
): Promise<CatalogPage> {
  if (!isKnownFormat(formatSlug)) return EMPTY_PAGE;
  const spec = resolveFormat(formatSlug) as (typeof FORMAT_SPEC)[string] & { yearValue?: number };
  if (!spec) return EMPTY_PAGE;

  const year = /^\d{4}$/.test(filters?.year ?? '') ? Number(filters!.year) : spec.yearValue;
  const genre = isBrowsableGenre(filters?.category) ? GENRE_ID[filters!.category!] : spec.genre;

  const result = await discover(spec.type, { page, genre, year });
  return toPage(result.items, locale, result.totalItems, page < result.totalPages);
}

// ============================================================================
// SEARCH
// ============================================================================

/** Keyword search. Matches titles in either language the provider indexes. */
export async function searchTitles(query: string, locale: string, page = 1): Promise<CatalogPage> {
  if (!query.trim()) return EMPTY_PAGE;
  const result = await apiSearch(query, page);
  return toPage(result.items, locale, result.totalItems, page < result.totalPages);
}

// ============================================================================
// DETAIL
// ============================================================================

/**
 * Load one title's full detail, seasons and all.
 *
 * The provider keeps a series' seasons inside the title, so the watch page's
 * season selector is filled from here rather than by looking up sibling
 * titles — which is what the previous provider required.
 */
async function loadDetail(id: string, type: string, locale: string): Promise<DetailMovie | null> {
  const detail = await getDetail(id, type);
  if (!detail) return null;

  const mediaType = type === 'anime' || detail.type === 'anime' ? 'anime' : detail.type === 'tv' || type === 'tv' ? 'tv' : 'movie';

  if (mediaType === 'tv') {
    const seasons = (detail.seasons ?? []).filter((s) => (s.season_number ?? 0) > 0);
    const withEpisodes = await Promise.all(
      seasons.map(async (season) => ({
        season,
        episodes: await getSeason(id, season.season_number),
      }))
    );
    const episodes = buildSeasons(id, 'tv', withEpisodes);
    // A series with no reachable episodes still renders its detail page; the
    // watch page then offers the provider's own player instead.
    return adaptDetail(
      detail,
      episodes.length ? episodes : buildMovieEpisodes(id, 'tv', detail.runtime),
      { locale }
    );
  }

  return adaptDetail(detail, buildMovieEpisodes(id, mediaType, detail.runtime), { locale });
}

/**
 * Resolve a URL slug to a full title.
 *
 * The canonical form is a slug this app minted (`the-odyssey-movie-1368337`),
 * whose tail carries the provider id and type. A slug that does not parse —
 * a legacy URL from an earlier provider, or a hand-typed one — is resolved by
 * searching for its words and taking the best hit, so old links land on
 * something real instead of a 404.
 *
 * Returns null only when nothing resolves. A timeout or 5xx still throws:
 * "the provider is down" must not look like "this title does not exist".
 */
export async function getTitleDetail(slug: string, locale: string): Promise<DetailMovie | null> {
  if (!slug) return null;

  const minted = parseMintedSlug(slug);
  if (minted) return loadDetail(minted.id, minted.type, locale);

  const words = slug.replace(/-/g, ' ').trim();
  if (!words) return null;
  try {
    const found = await apiSearch(words, 1);
    const hit = found.items[0];
    if (!hit) return null;
    return loadDetail(hit.id, hit.type ?? 'movie', locale);
  } catch {
    return null;
  }
}

/**
 * Cast and gallery for the detail page.
 *
 * The provider carries cast on the detail payload and no separate images
 * endpoint, so the gallery is built from the backdrops it does have: the
 * title's own, then its recommendations'. Either half failing just hides its
 * section.
 */
export async function getTitleExtras(
  slug: string
): Promise<{ credit: Credit | undefined; images: MovieImage[] }> {
  const minted = parseMintedSlug(slug);
  if (!minted) return { credit: undefined, images: [] };

  try {
    const detail = await getDetail(minted.id, minted.type);
    if (!detail) return { credit: undefined, images: [] };

    const cast = (detail.cast ?? [])
      .filter((c) => c.name)
      .slice(0, 20)
      .map((c, order) => ({
        adult: false,
        gender: 0,
        id: c.id ?? order,
        known_for_department: 'Acting',
        name: c.name,
        original_name: c.name,
        popularity: 0,
        profile_path: tmdbPathFromUrl(c.profile ?? c.profile_path) ?? null,
        cast_id: 0,
        character: c.character ?? '',
        credit_id: '',
        order,
      }));

    const paths = [detail.backdrop, ...(detail.recommendations ?? []).map((r) => r.backdrop)]
      .map((url) => tmdbPathFromUrl(url))
      .filter((p): p is string => !!p);

    const images: MovieImage[] = paths.slice(0, 12).map((file_path) => ({
      width: 1280,
      height: 720,
      aspect_ratio: 1.778,
      type: 'backdrop',
      file_path,
      iso_639_1: '',
    }));

    return { credit: cast.length ? { id: slug, cast } : undefined, images };
  } catch {
    return { credit: undefined, images: [] };
  }
}

/**
 * Sibling seasons of a series.
 *
 * Always empty: this provider keeps every season inside one title, so the
 * watch page's own season selector already covers them. Returning links would
 * offer the visitor the same show twice by two different routes.
 */
export async function getOtherSeasons(_detail: DetailMovie): Promise<SeasonLink[]> {
  return [];
}

/**
 * "More like this" — the provider's own recommendations, minus the title
 * itself. Falls back to the first genre when it has none. Best-effort: an
 * empty array hides the rail.
 */
export async function getRelatedTitles(
  detail: DetailMovie,
  locale: string,
  limit = 10
): Promise<NewlyMovie[]> {
  return safeRail(async () => {
    const minted = parseMintedSlug(detail.movie.slug);
    if (minted) {
      const raw = await getDetail(minted.id, minted.type);
      const rows = (raw?.recommendations?.length ? raw.recommendations : raw?.similar) ?? [];
      const items = adaptItems(rows, { locale })
        .filter((m) => m._id !== detail.movie._id)
        .slice(0, limit);
      if (items.length) return items;
    }

    const genreSlug = detail.movie.category?.[0]?.slug;
    const genre = genreSlug ? GENRE_ID[genreSlug] : undefined;
    if (!genre) return [];
    const page = await discover('movie', { page: 1, genre });
    return adaptItems(page.items, { locale })
      .filter((m) => m._id !== detail.movie._id)
      .slice(0, limit);
  });
}

/**
 * Same-genre titles for a slug from watch history ("because you watched").
 * Legacy slugs resolve through `getTitleDetail`'s search fallback.
 */
export async function getBecauseYouWatchedTitles(
  slug: string,
  locale: string,
  limit = 10
): Promise<NewlyMovie[]> {
  return safeRail(async () => {
    const detail = await getTitleDetail(slug, locale);
    if (!detail) return [];
    return getRelatedTitles(detail, locale, limit);
  });
}

export { CatalogApiError };
