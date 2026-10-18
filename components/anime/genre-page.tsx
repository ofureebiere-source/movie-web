'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import RegularMovieItem from '../commons/regular-movie-item';
import { MovieGridLoadMoreSkeleton } from '../commons/movie-grid-skeleton';
import InfiniteScrollSentinel from '../commons/infinite-scroll-sentinel';
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
 * without going back — the same thing the film browse pages do.
 */
export default function AnimeGenrePage({ slug }: { slug: string }) {
  const t = useTranslations('anime');
  const locale = useLocale() as Locale;

  if (!isKnownAnimeGenre(slug)) notFound();

  const fetcher = useMemo(() => (page: number) => getAnime(page, locale, slug), [locale, slug]);

  const { items, totalItems, isLoading, isLoadingMore, hasMore, error, sentinelRef, retry } =
    useInfinitePagination<NewlyMovie>({ fetcher, resetKey: `${locale}|${slug}` });

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
      </div>

      {isLoading ? (
        <MovieGridLoadMoreSkeleton count={20} />
      ) : (
        <div className="mt-6 lg:mt-8">
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:px-8 lg:grid-cols-5 lg:gap-6 container-wrapper lg:px-0">
            {items.map((movie, index) => (
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
