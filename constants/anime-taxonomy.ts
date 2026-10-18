/**
 * The anime catalogue's genre vocabulary.
 *
 * Anime is a separate upstream from films and series: it is fronted by AniList
 * ids, its rows come from Kitsu, and — unlike the film endpoints — it filters
 * by genre NAME rather than by a numeric TMDB id. So these slugs cannot reuse
 * `GENRE_ID`, and they live in their own namespace.
 *
 * Only names the backend actually answers with results are listed. Probed
 * 2026-10-18; `Music`, `Isekai`, `Shounen`, `Slice-of-Life` and `Mecha` all
 * returned an empty set, so offering them would render a dead rail under a
 * heading that promises content.
 */

export interface AnimeGenre {
  /** URL segment, e.g. `/anime/genre/sci-fi`. */
  slug: string;
  /** The exact string the backend expects in `?genre=`. */
  name: string;
  /** i18n key under `anime.genres`, for the localized label. */
  key: string;
}

export const ANIME_GENRES: readonly AnimeGenre[] = [
  { slug: 'action', name: 'Action', key: 'action' },
  { slug: 'adventure', name: 'Adventure', key: 'adventure' },
  { slug: 'comedy', name: 'Comedy', key: 'comedy' },
  { slug: 'drama', name: 'Drama', key: 'drama' },
  { slug: 'fantasy', name: 'Fantasy', key: 'fantasy' },
  { slug: 'romance', name: 'Romance', key: 'romance' },
  { slug: 'sci-fi', name: 'Sci-Fi', key: 'sciFi' },
  { slug: 'supernatural', name: 'Supernatural', key: 'supernatural' },
  { slug: 'mystery', name: 'Mystery', key: 'mystery' },
  { slug: 'horror', name: 'Horror', key: 'horror' },
  { slug: 'sports', name: 'Sports', key: 'sports' },
  { slug: 'thriller', name: 'Thriller', key: 'thriller' },
] as const;

const BY_SLUG = new Map(ANIME_GENRES.map((g) => [g.slug, g]));
const BY_NAME = new Map(ANIME_GENRES.map((g) => [g.name.toLowerCase(), g]));

/** The backend genre name for a slug, or undefined when the slug is unknown. */
export function animeGenreName(slug: string | undefined | null): string | undefined {
  return slug ? BY_SLUG.get(slug)?.name : undefined;
}

/** The slug for a backend genre name, so a chip on a detail page can link back. */
export function animeGenreSlug(name: string | undefined | null): string | undefined {
  return name ? BY_NAME.get(name.toLowerCase())?.slug : undefined;
}

export function isKnownAnimeGenre(slug: string | undefined | null): boolean {
  return !!slug && BY_SLUG.has(slug);
}

/**
 * Rails the anime landing page renders, in display order.
 *
 * Not the full genre list: twelve rails is a wall. These are the eight that
 * both have a deep catalogue behind them and read as distinct shelves to
 * somebody browsing anime, with the remaining genres reachable as chips.
 */
export const ANIME_RAIL_SLUGS: readonly string[] = [
  'action',
  'romance',
  'fantasy',
  'comedy',
  'sci-fi',
  'adventure',
  'supernatural',
  'drama',
] as const;
