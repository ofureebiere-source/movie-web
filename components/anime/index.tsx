'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import MovieList from '../commons/movie-list';
import RegularMovieItem from '../commons/regular-movie-item';
import { MovieGridLoadMoreSkeleton } from '../commons/movie-grid-skeleton';
import InfiniteScrollSentinel from '../commons/infinite-scroll-sentinel';
import AnimeFilterBar, {
  EMPTY_ANIME_FILTERS,
  type AnimeFilterState,
  type AnimeSort,
} from './anime-filter-bar';
import { getAnime, loadAnimeLanding, searchAnime } from 'lib/catalog-client';
import { useInfinitePagination } from 'hooks/useInfinitePagination';
import { ANIME_GENRES, ANIME_RAIL_SLUGS } from 'constants/anime-taxonomy';

import type { Locale } from 'i18n/routing';
import type NewlyMovie from 'types/newly-movie';

/**
 * The anime landing page.
 *
 * Deliberately denser than the film home: somebody who opens "Anime" wants a
 * shelf wall, not one rail and a hero. So it renders a genre rail per popular
 * genre, then hands off to a full paged grid of the entire anime catalogue
 * under a filter bar.
 *
 * The filter bar is not a thin client-side filter over one page. Search, genre
 * and year are all forwarded to the provider, so they narrow the whole
 * ~22,500-title catalogue rather than the twenty rows that happen to be loaded.
 * Sort is the exception, and honestly so: the provider ignores every sort
 * parameter it accepts, so ordering is applied to the loaded pages in the
 * browser (see `AnimeFilterBar`).
 *
 * Everything is fetched in the visitor's browser for the same reason as the
 * film catalogue — see `lib/catalog-client`.
 */
export default function AnimePage() {
  const t = useTranslations('anime');
  const locale = useLocale() as Locale;

  const [rails, setRails] = useState<{ slug: string; items: NewlyMovie[] }[] | null>(null);
  const [filters, setFilters] = useState<AnimeFilterState>(EMPTY_ANIME_FILTERS);

  // The search box is debounced into a separate value so typing does not fire a
  // request per keystroke. 350ms coalesces normal typing and still feels instant.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQuery(filters.query.trim()), 350);
    return () => clearTimeout(id);
  }, [filters.query]);

  useEffect(() => {
    let cancelled = false;
    loadAnimeLanding(locale)
      .then((data) => {
        if (!cancelled) setRails(data.rails);
      })
      .catch(() => {
        if (!cancelled) setRails([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const searching = query.length > 0;

  // Every input that changes WHAT is fetched, as one string, so the pagination
  // hook resets exactly when the result set changes — and not when the sort
  // changes, which only reorders rows already in hand.
  const fetchKey = `${locale}|${query}|${filters.genre}|${filters.year}`;

  const fetcher = useCallback(
    (page: number) =>
      searching
        ? searchAnime(query, page, locale)
        : getAnime(page, locale, {
            genreSlug: filters.genre || undefined,
            year: filters.year || undefined,
          }),
    [searching, query, locale, filters.genre, filters.year]
  );

  const { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, retry } =
    useInfinitePagination<NewlyMovie>({ fetcher, resetKey: fetchKey });

  // Sorting is applied to the loaded rows, not requested from the provider,
  // because the provider ignores sort. `default` leaves its own order untouched.
  const sorted = useMemo(() => {
    if (filters.sort === 'default') return items;
    const copy = items.slice();
    const bySort: Record<Exclude<AnimeSort, 'default'>, (a: NewlyMovie, b: NewlyMovie) => number> = {
      newest: (a, b) => (b.year ?? 0) - (a.year ?? 0),
      oldest: (a, b) => (a.year ?? 0) - (b.year ?? 0),
      // Unrated rows sort last rather than as zero, so a missing score does not
      // read as "rated lowest".
      rating: (a, b) => (b.tmdb?.vote_average ?? -1) - (a.tmdb?.vote_average ?? -1),
      title: (a, b) => a.name.localeCompare(b.name),
    };
    return copy.sort(bySort[filters.sort]);
  }, [items, filters.sort]);

  const genreLabel = (slug: string) =>
    t(`genres.${ANIME_GENRES.find((g) => g.slug === slug)?.key ?? slug}`);

  const changeFilter = <K extends keyof AnimeFilterState>(key: K, value: AnimeFilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(EMPTY_ANIME_FILTERS);

  const filtering = Boolean(filters.query || filters.genre || filters.year);

  return (
    <div className="pt-[3.75rem] space-y-8 lg:space-y-12">
      {/* Page heading */}
      <div className="container-wrapper px-4 pt-4 sm:px-6 md:px-8 lg:px-0 lg:pt-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400 lg:text-base">{t('subtitle')}</p>
      </div>

      {/* The shelf wall. Hidden once a filter is active: the visitor is no
          longer browsing, they are looking for a specific thing. */}
      {!filtering && (
        <div className="space-y-8">
          {rails === null
            ? ANIME_RAIL_SLUGS.map((slug) => (
                <div key={slug} className="container-wrapper space-y-4">
                  <div className="mx-4 h-6 w-40 animate-pulse rounded bg-white/10 md:mx-0" />
                  <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />
                    ))}
                  </div>
                </div>
              ))
            : rails.map(({ slug, items: railItems }) =>
                railItems.length === 0 ? null : (
                  <MovieList
                    key={slug}
                    movies={railItems}
                    listName={genreLabel(slug)}
                    isNewlyMovieItem={false}
                    href={`/anime/genre/${slug}`}
                  />
                )
              )}
        </div>
      )}

      {/* Full catalogue, with its controls */}
      <div className="container-wrapper px-4 sm:px-6 md:px-8 lg:px-0">
        <div className="border-t border-white/10 pt-6">
          <h2 className="mb-4 text-lg font-bold lg:text-xl">{t('browseAll')}</h2>
          <AnimeFilterBar
            filters={filters}
            onChange={changeFilter}
            onClear={clearFilters}
            searching={searching}
          />
        </div>
      </div>

      {isLoading ? (
        <MovieGridLoadMoreSkeleton count={20} />
      ) : sorted.length === 0 ? (
        <p className="container-wrapper px-4 py-12 text-center text-sm text-gray-400">
          {t('noResults')}
        </p>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:px-8 lg:grid-cols-5 lg:gap-6 container-wrapper lg:px-0">
            {sorted.map((movie, index) => (
              <RegularMovieItem movie={movie} key={`${movie._id}-${index}`} />
            ))}
          </div>
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            error={error}
            onRetry={retry}
            isEmpty={items.length === 0}
          />
        </div>
      )}
    </div>
  );
}
