'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import RegularMovieItem from '../commons/regular-movie-item';
import { MovieGridLoadMoreSkeleton } from '../commons/movie-grid-skeleton';
import InfiniteScrollSentinel from '../commons/infinite-scroll-sentinel';
import AnimeFilterBar, {
  EMPTY_ANIME_FILTERS,
  type AnimeFilterState,
  type AnimeSort,
} from './anime-filter-bar';
import { getAnime } from 'lib/catalog-client';
import { useInfinitePagination } from 'hooks/useInfinitePagination';
import { ANIME_GENRES, isKnownAnimeGenre } from 'constants/anime-taxonomy';
import { Link } from 'i18n/routing';
import type { Locale } from 'i18n/routing';
import type NewlyMovie from 'types/newly-movie';

/**
 * One anime genre, paged to the end of that genre's catalogue.
 *
 * The chip row repeats here so the viewer can move sideways between genres
 * without going back — the same thing the film browse pages do — and the same
 * year and sort controls the anime landing page offers are present too, so a
 * genre page is not a dead end with no way to narrow or reorder it. The genre
 * chips double as that navigation, which is why the filter bar's own genre row
 * is switched off here (`showGenreChips={false}`): the route has fixed the
 * genre already.
 */
export default function AnimeGenrePage({ slug }: { slug: string }) {
  const t = useTranslations('anime');
  const locale = useLocale() as Locale;

  if (!isKnownAnimeGenre(slug)) notFound();

  const [filters, setFilters] = useState<AnimeFilterState>(EMPTY_ANIME_FILTERS);

  const fetcher = useMemo(
    () => (page: number) => getAnime(page, locale, { genreSlug: slug, year: filters.year || undefined }),
    [locale, slug, filters.year]
  );

  const { items, totalItems, isLoading, isLoadingMore, hasMore, error, sentinelRef, retry } =
    useInfinitePagination<NewlyMovie>({
      fetcher,
      resetKey: `${locale}|${slug}|${filters.year}`,
    });

  // The provider ignores sort, so ordering is applied to the rows in hand.
  const sorted = useMemo(() => {
    if (filters.sort === 'default') return items;
    const copy = items.slice();
    const bySort: Record<Exclude<AnimeSort, 'default'>, (a: NewlyMovie, b: NewlyMovie) => number> = {
      newest: (a, b) => (b.year ?? 0) - (a.year ?? 0),
      oldest: (a, b) => (a.year ?? 0) - (b.year ?? 0),
      rating: (a, b) => (b.tmdb?.vote_average ?? -1) - (a.tmdb?.vote_average ?? -1),
      title: (a, b) => a.name.localeCompare(b.name),
    };
    return copy.sort(bySort[filters.sort]);
  }, [items, filters.sort]);

  const changeFilter = <K extends keyof AnimeFilterState>(key: K, value: AnimeFilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const genre = ANIME_GENRES.find((g) => g.slug === slug)!;

  return (
    <div className="pt-[3.75rem]">
      <div className="container-wrapper px-4 pt-4 sm:px-6 md:px-8 lg:px-0 lg:pt-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t(`genres.${genre.key}`)}</h1>
        {totalItems !== null && (
          <p className="mt-1 text-sm text-gray-400">{t('titleCount', { count: totalItems })}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/anime" prefetch={false} className="glass-btn glass-btn-sm">
            {t('allGenres')}
          </Link>
          {ANIME_GENRES.map((g) => (
            <Link
              key={g.slug}
              href={`/anime/genre/${g.slug}`}
              prefetch={false}
              aria-current={g.slug === slug ? 'page' : undefined}
              className={`glass-btn glass-btn-sm ${g.slug === slug ? 'glass-btn-active' : ''}`}
            >
              {t(`genres.${g.key}`)}
            </Link>
          ))}
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <AnimeFilterBar
            filters={filters}
            onChange={changeFilter}
            onClear={() => setFilters(EMPTY_ANIME_FILTERS)}
            searching={false}
            showGenreChips={false}
          />
        </div>
      </div>

      {isLoading ? (
        <MovieGridLoadMoreSkeleton count={20} />
      ) : (
        <div className="mt-6 lg:mt-8">
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
