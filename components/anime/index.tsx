'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import MovieList from '../commons/movie-list';
import RegularMovieItem from '../commons/regular-movie-item';
import { MovieGridLoadMoreSkeleton } from '../commons/movie-grid-skeleton';
import InfiniteScrollSentinel from '../commons/infinite-scroll-sentinel';
import { getAnime, loadAnimeLanding } from 'lib/catalog-client';
import { useInfinitePagination } from 'hooks/useInfinitePagination';
import { ANIME_GENRES, ANIME_RAIL_SLUGS } from 'constants/anime-taxonomy';
import { Link } from 'i18n/routing';
import type { Locale } from 'i18n/routing';
import type NewlyMovie from 'types/newly-movie';

/**
 * The anime landing page.
 *
 * Deliberately denser than the film home: somebody who opens "Anime" wants a
 * shelf wall, not one rail and a hero. So it renders a genre rail per popular
 * genre, then hands off to a full paged grid of the entire anime catalogue
 * (~22k titles, 50 upstream pages) under a genre chip filter.
 *
 * Everything is fetched in the visitor's browser for the same reason as the
 * film catalogue — see `lib/catalog-client`.
 */
export default function AnimePage() {
  const t = useTranslations('anime');
  const locale = useLocale() as Locale;

  const [rails, setRails] = useState<{ slug: string; items: NewlyMovie[] }[] | null>(null);

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

  const fetcher = useMemo(() => (page: number) => getAnime(page, locale), [locale]);

  const { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, retry } =
    useInfinitePagination<NewlyMovie>({ fetcher, resetKey: locale });

  const genreLabel = (slug: string) => t(`genres.${ANIME_GENRES.find((g) => g.slug === slug)?.key ?? slug}`);

  return (
    <div className="pt-[3.75rem] space-y-8 lg:space-y-12">
      {/* Page heading */}
      <div className="container-wrapper px-4 pt-4 sm:px-6 md:px-8 lg:px-0 lg:pt-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400 lg:text-base">{t('subtitle')}</p>
      </div>

      {/* Genre rails — the shelf wall */}
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
                />
              )
            )}
      </div>

      {/* Full catalogue, filterable by genre */}
      <div className="container-wrapper px-4 sm:px-6 md:px-8 lg:px-0">
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-6">
          <h2 className="mr-2 text-lg font-bold lg:text-xl">{t('browseAll')}</h2>
          <span className="glass-btn glass-btn-sm glass-btn-active">{t('allGenres')}</span>
          {ANIME_GENRES.map((genre) => (
            <Link
              key={genre.slug}
              href={`/anime/genre/${genre.slug}`}
              prefetch={false}
              className="glass-btn glass-btn-sm"
            >
              {t(`genres.${genre.key}`)}
            </Link>
          ))}
        </div>
      </div>

      {isLoading ? (
        <MovieGridLoadMoreSkeleton count={20} />
      ) : (
        <div className="mt-2">
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
