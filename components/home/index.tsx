'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import HeroSection from './hero-section';
import MovieList from '../commons/movie-list';
import DailyUpdateBanner from './daily-update-banner';
import ContinueWatchingSection from './continue-watching-section';
import BecauseYouWatchedSection from './because-you-watched-section';
import TrendingSection from './trending-section';
import type { TrendingItem } from './trending-slider';
import { localizedCategory } from 'constants/i18n-mappings';
import { loadHomeRails, type HomeRails } from 'lib/catalog-client';
import type { Locale } from 'i18n/routing';

/**
 * The home page.
 *
 * Client-rendered on purpose: the catalogue is fetched from the visitor's
 * browser (see `lib/catalog-client`). That is not a style choice — the
 * catalogue host is behind Cloudflare, which answers Vercel's datacenter IPs
 * with a 403 bot challenge, so a server-side fetch returns an interstitial
 * instead of JSON and the page renders empty. The visitor's own IP is not
 * challenged.
 *
 * `trending` is the one exception: it is a static file read at build time by
 * the server component that wraps this one, and handed down as a prop, so it
 * needs no request at all.
 */
export default function HomePage({ trending }: { trending: TrendingItem[] }) {
  const t = useTranslations('home.lists');
  const locale = useLocale() as Locale;
  const [rails, setRails] = useState<HomeRails | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHomeRails(locale)
      .then((data) => {
        if (!cancelled) setRails(data);
      })
      .catch(() => {
        // Every rail already degrades to empty; a total failure means the
        // catalogue is unreachable, and the rows below simply stay hidden.
        if (!cancelled) setRails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // First paint: chrome and the personalized rows, which read from local
  // storage and need no network. The catalogue rows fill in underneath.
  if (!rails) {
    return (
      <div className="h-full">
        <HeroSection movies={[]} />
        <DailyUpdateBanner count={0} />
        <div className="space-y-8">
          <ContinueWatchingSection />
          <BecauseYouWatchedSection />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <HeroSection movies={rails.heroMovies} />
      <DailyUpdateBanner count={rails.addedTodayCount} />
      <div className="space-y-8">
        <ContinueWatchingSection />
        <BecauseYouWatchedSection />
        <TrendingSection items={trending} />
        {rails.newlyAdded.length > 0 && (
          <MovieList listName={t('newlyUpdated')} movies={rails.newlyAdded} isNewlyMovieItem={true} />
        )}
        {rails.theatrical.length > 0 && (
          <MovieList
            movies={rails.theatrical}
            listName={t('theatricalNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}
        {rails.singleMovies.length > 0 && (
          <MovieList
            movies={rails.singleMovies}
            listName={t('singleNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}
        {rails.tvSeries.length > 0 && (
          <MovieList
            movies={rails.tvSeries}
            listName={t('tvSeriesNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}
        {rails.cartoonMovies.length > 0 && (
          <MovieList
            movies={rails.cartoonMovies}
            listName={t('cartoonNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}
        {rails.voiced.length > 0 && (
          <MovieList
            movies={rails.voiced}
            listName={t('voicedNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}
        {rails.tvShows.length > 0 && (
          <MovieList
            movies={rails.tvShows}
            listName={t('tvShowsNewlyUpdated')}
            isNewlyMovieItem={false}
          />
        )}

        {/* Browse-by-genre discovery rows */}
        {rails.genreRows.map(({ slug, items }) =>
          items.length === 0 ? null : (
            <MovieList
              key={slug}
              movies={items}
              listName={localizedCategory(slug, locale)}
              isNewlyMovieItem={false}
            />
          )
        )}
      </div>
    </div>
  );
}
