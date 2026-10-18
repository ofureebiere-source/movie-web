'use client';

import {
  browseByFormat,
  browseByGenre,
  browseByCountry,
  searchTitles,
  getTitleDetail,
  getBecauseYouWatchedTitles,
  getTrendingRail,
  getNewlyAddedFeed,
  getFormatRail,
  getGenreRail,
  getRelatedTitles,
  getTitleExtras,
  type CatalogPage,
} from 'services/catalog-service';
import type NewlyMovie from 'types/newly-movie';
import type DetailMovie from 'types/detail-movie';
import type Credit from 'types/credit';
import type MovieImage from 'types/movie-image';
import type { MovieFilters } from 'types/movie-filters';

/**
 * The catalogue, as the components see it.
 *
 * These used to be server actions. They are not any more, and the reason is
 * the whole point of this file: the catalogue host is behind Cloudflare,
 * which answers Vercel's datacenter IPs with a 403 bot challenge. A server
 * action runs on Vercel, so every one of them came back with the challenge
 * page instead of JSON, and every page rendered empty. Running the same calls
 * in the visitor's browser sidesteps the block entirely — their IP is a
 * normal residential one, and the API allows cross-origin reads.
 *
 * The trade is that these are now plain functions rather than actions, so a
 * component that calls them on mount owns its own loading state. That is what
 * the hooks below are for, and it is why the app can render chrome instantly
 * and stream the rows in, instead of blocking the whole route on a round trip.
 *
 * Every export here is safe to call from a client component. Nothing in the
 * chain imports `server-only`.
 */

export type { MovieFilters, CatalogPage };

/** Rails the home page renders, resolved together so they share one round trip. */
export const HOME_GENRE_ROW_SLUGS = ['hanh-dong', 'tinh-cam', 'kinh-di'] as const;

export interface HomeRails {
  newlyAdded: NewlyMovie[];
  heroMovies: NewlyMovie[];
  addedTodayCount: number;
  theatrical: NewlyMovie[];
  singleMovies: NewlyMovie[];
  tvSeries: NewlyMovie[];
  cartoonMovies: NewlyMovie[];
  voiced: NewlyMovie[];
  tvShows: NewlyMovie[];
  genreRows: { slug: string; items: NewlyMovie[] }[];
}

/**
 * Every home rail in one call.
 *
 * `Promise.all` is safe only because each rail resolves to an empty value on
 * failure rather than rejecting (`safeRail` in the catalog service) — one
 * upstream hiccup must cost one rail, not the page.
 */
export async function loadHomeRails(locale: string): Promise<HomeRails> {
  const [
    latest,
    hero,
    theatrical,
    singleMovies,
    tvSeries,
    cartoonMovies,
    voiced,
    tvShows,
    ...genreResults
  ] = await Promise.all([
    getNewlyAddedFeed(locale),
    getTrendingRail(locale, 5),
    getFormatRail('phim-chieu-rap', locale),
    getFormatRail('phim-le', locale),
    getFormatRail('phim-bo', locale),
    getFormatRail('hoat-hinh', locale),
    getFormatRail('phim-thuyet-minh', locale),
    getFormatRail('tv-shows', locale),
    ...HOME_GENRE_ROW_SLUGS.map((slug) => getGenreRail(slug, locale)),
  ]);

  const newlyAdded = latest.items;

  return {
    newlyAdded,
    // Trending already falls back to theatrical releases on its own; this
    // second fallback only matters when the catalog itself is down.
    heroMovies: (hero.length > 0 ? hero : newlyAdded).slice(0, 5),
    addedTodayCount: latest.updatedToday,
    theatrical,
    singleMovies,
    tvSeries,
    cartoonMovies,
    voiced,
    tvShows,
    genreRows: HOME_GENRE_ROW_SLUGS.map((slug, i) => ({ slug, items: genreResults[i] ?? [] })),
  };
}

export async function getMoviesByFormat(
  slug: string,
  page: number,
  locale: string,
  filters?: MovieFilters
): Promise<CatalogPage> {
  return browseByFormat(slug, page, filters, locale);
}

export async function getMoviesByType(
  slug: string,
  page: number,
  locale: string,
  filters?: MovieFilters
): Promise<CatalogPage> {
  return browseByGenre(slug, page, filters, locale);
}

export async function getMoviesByCountry(
  slug: string,
  page: number,
  locale: string,
  filters?: MovieFilters
): Promise<CatalogPage> {
  return browseByCountry(slug, page, filters, locale);
}

export async function searchingMovie(query: string, locale: string): Promise<CatalogPage> {
  return searchTitles(query, locale);
}

export async function getBecauseYouWatched(slug: string, locale: string): Promise<NewlyMovie[]> {
  return getBecauseYouWatchedTitles(slug, locale);
}

export async function getMovieDetail(slug: string, locale: string): Promise<DetailMovie | null> {
  return getTitleDetail(slug, locale);
}

export interface TitlePageData {
  movie: DetailMovie;
  relatedMovies: NewlyMovie[];
  extras: { credit: Credit | undefined; images: MovieImage[] };
}

/**
 * Everything a detail or watch page needs, in one call.
 *
 * `null` means the slug resolved to nothing — a real 404, which the caller
 * turns into a redirect home. A thrown error means the catalogue itself is
 * unreachable, which is a different outcome and must not be disguised as a
 * missing title.
 *
 * `getOtherSeasons` is deliberately absent: this provider keeps every season
 * inside one title, so it always returns `[]` and asking would be a wasted
 * round trip.
 */
export async function loadTitlePage(slug: string, locale: string): Promise<TitlePageData | null> {
  const movie = await getTitleDetail(slug, locale);
  if (!movie) return null;

  const [relatedMovies, extras] = await Promise.all([
    getRelatedTitles(movie, locale),
    getTitleExtras(movie.movie.slug),
  ]);

  // Header image: the provider's own backdrop, else the first wide textless
  // still from the gallery we just loaded.
  if (!movie.movie.tmdb_backdrop) {
    const still = extras.images.find((img) => !img.iso_639_1 && img.width >= 1280);
    if (still) movie.movie.tmdb_backdrop = still.file_path;
  }

  return { movie, relatedMovies, extras };
}

/**
 * Warm the catalogue cache for a browse route so the click has nothing to
 * wait for. Called on hover and on viewport entry.
 *
 * This calls the same function the page will call rather than rebuilding the
 * request by hand. The cache key is the resolved URL, so a hand-built URL that
 * differs by even one query param would warm an entry nobody reads — and the
 * real navigation would still hit the network. Going through the real path is
 * both shorter and the only way to stay in sync with it.
 */
export function prefetchBrowse(kind: 'format' | 'type' | 'country', slug: string, locale: string): void {
  const call =
    kind === 'format'
      ? browseByFormat(slug, 1, undefined, locale)
      : kind === 'type'
        ? browseByGenre(slug, 1, undefined, locale)
        : browseByCountry(slug, 1, undefined, locale);
  call.catch(() => {
    /* prefetch is best-effort; the page reports its own failures */
  });
}
