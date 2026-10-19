'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectFade, Autoplay } from 'swiper/modules';
import NewlyMovie from 'types/newly-movie';
import HeroMovieItem from '../commons/hero-movie-item';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { getMovieDetail } from 'lib/catalog-client';
import DetailMovie from 'types/detail-movie';
import HeroSectionSkeleton from './hero-section-skeleton';
import { markHomeReady } from 'lib/home-ready';
import { FaChevronRight } from 'react-icons/fa6';
import PlayerOverlay from '../watch/player-overlay';

/**
 * The hero carousel.
 *
 * List rows carry no synopsis, so the detail for each slide is fetched here.
 * Failures are dropped rather than thrown — a hero with four slides is fine,
 * a home page that breaks because one title 404'd is not.
 *
 * Logos are not fetched: there is no keyless logo source, so every slide
 * falls back to its title as text (see `utils/movie-logo`).
 */
export default function HeroSection({ movies }: { movies: NewlyMovie[] }) {
  const locale = useLocale();
  const [detailMovies, setDetailMovies] = useState<DetailMovie[]>([]);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  /** The slide whose "Watch now" was pressed, or null. */
  const [playing, setPlaying] = useState<DetailMovie | null>(null);
  const swiperRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    if (movies.length === 0) {
      setDetailMovies([]);
      setHasFetched(true);
      markHomeReady();
      return;
    }

    setHasFetched(false);

    const getDescriptionMovies = async () => {
      const settled = await Promise.allSettled(
        movies.map((movie) => getMovieDetail(movie.slug, locale))
      );
      if (cancelled) return;
      setDetailMovies(
        settled
          .filter(
            (r): r is PromiseFulfilledResult<DetailMovie | null> => r.status === 'fulfilled'
          )
          .map((r) => r.value)
          .filter((d): d is DetailMovie => d !== null)
      );
      setHasFetched(true);
      // Critical above-the-fold content is resolved — tell the brand intro the
      // home is ready so it can hand off without a skeleton/pop-in flash.
      markHomeReady();
    };

    getDescriptionMovies();

    return () => {
      cancelled = true;
    };
  }, [movies, locale]);

  const handleClickToNextSlide = () => {
    swiperRef.current?.slideNext();
  };

  if (!hasFetched) {
    return <HeroSectionSkeleton />;
  }

  // Nothing to show (catalogue unreachable, or every detail failed). Render
  // the first list item as a text-only slide so the hero is never blank.
  if (detailMovies.length === 0) {
    if (movies.length === 0) return null;
    return (
      <div className="relative h-[60vh] md:h-[80vh] flex items-end">
        <div className="container-wrapper px-4 md:px-0 pb-16">
          <h1 className="text-4xl md:text-6xl font-bold">{movies[0].name}</h1>
        </div>
      </div>
    );
  }

  // Build a quick lookup so we can pair each DetailMovie with its source NewlyMovie
  // (NewlyMovie carries fields not returned by detail endpoint: imdb, modified, sub_docquyen, ...).
  const listItemBySlug = new Map(movies.map((m) => [m.slug, m]));

  return (
    <div className="relative on-artwork">
      <Swiper
        modules={[EffectFade, Autoplay]}
        effect="fade"
        autoplay={{ delay: 10000 }}
        loop={true}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
      >
        {detailMovies.map((movie: DetailMovie, index) => {
          return (
            <SwiperSlide key={movie.movie._id}>
              <HeroMovieItem
                detailMovie={movie}
                listItem={listItemBySlug.get(movie.movie.slug)}
                logoUrl={null}
                onNextSlide={handleClickToNextSlide}
                onWatchNow={() => setPlaying(movie)}
                priority={index === 0}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>
      {/* Playback stays on the home page: "Watch now" opens the player over the
          carousel rather than navigating to the watch route. */}
      {playing && <PlayerOverlay movie={playing} autoPlay onClose={() => setPlaying(null)} />}
      {/* Desktop Navigation Button — mobile button is rendered inside HeroMovieItem
          so it can vertically center on the variable-height poster image. */}
      <div
        className="glass-btn glass-btn-icon hidden lg:block absolute z-10 top-[18rem] right-6 group cursor-pointer"
        onClick={handleClickToNextSlide}
      >
        <FaChevronRight className="text-content-main transition-colors duration-300" />
      </div>
    </div>
  );
}
