import type { Locale } from 'i18n/routing';
import type Tmdb from 'types/tmdb';

/**
 * Title logo (the stylised wordmark shown over a hero).
 *
 * There is no source for one any more. The previous build pulled logos from a
 * TMDB images endpoint, which needs a token — exactly the kind of credential
 * this build does not have. The provider supplies artwork, cast and trailers,
 * but no logo set.
 *
 * Returning `null` is the honest answer, and it is what the call sites
 * already handle: every hero and detail header falls back to the title as
 * text. Kept as a module (rather than deleting the call sites) so that a
 * keyless logo source can be dropped in later without touching the UI.
 */
export async function fetchMovieLogoUrl(_tmdb: Tmdb | undefined, _locale: Locale): Promise<string | null> {
  return null;
}

/** Kept for the batch hero call; see `fetchMovieLogoUrl`. */
export async function fetchMoviePosterUrl(
  _tmdb: Pick<Tmdb, 'id' | 'type'> | undefined
): Promise<string | null> {
  return null;
}
