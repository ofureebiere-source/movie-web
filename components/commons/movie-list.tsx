'use client';
import { Swiper, SwiperSlide } from 'swiper/react';
import NewlyMovieItem from './newly-movie-item';
import NewlyMovie from 'types/newly-movie';
import Movie from 'types/movie';
import RegularMovieItem from './regular-movie-item';
import { GrNext, GrPrevious } from 'react-icons/gr';
import { useRef } from 'react';
import { Link } from 'i18n/routing';

interface MovieListProps {
  listName: string;
  movies: NewlyMovie[] | Movie[];
  isNewlyMovieItem: boolean;
  /** When set, the heading becomes a link to the full list — e.g. the anime
   *  rail heading opens that genre's paged page. */
  href?: string;
  /** One-line description under the title, as the upstream rows carry. */
  subtitle?: string;
}

export default function MovieList({
  listName,
  movies,
  isNewlyMovieItem,
  href,
  subtitle,
}: MovieListProps) {
  const swiperRef = useRef<any>(null);

  const handlePrevSlide = () => {
    swiperRef.current?.slidePrev();
  };

  const handleNextSlide = () => {
    swiperRef.current?.slideNext();
  };

  // The upstream section header: title with a count badge, an optional subtitle
  // underneath and a "View all" affordance on the right, all in the zinc ramp.
  const heading = (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-content-main sm:text-xl">{listName}</h2>
          <span className="inline-flex items-center rounded-md bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] text-content-muted">
            {movies.length}
          </span>
        </div>
        {subtitle && <p className="mt-1 truncate text-xs text-content-muted/70">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          prefetch={false}
          className="shrink-0 text-xs font-medium text-content-muted transition-colors hover:text-content-main"
        >
          {listName}
        </Link>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 sm:px-6">
      {/* Section header */}
      <div>{heading}</div>

      {/*
        IMPORTANT: use a NAMED group (`group/list`) here, NOT the default `group`.
        Each MovieCard inside also uses `group` (default) for its own hover overlay.
        Using the same name on both ancestors would make ANY card's overlay trigger
        whenever the user hovers anywhere in the swiper (descendant-selector cascade).
        Named groups scope `group-hover/list:` selectors to this row only.
      */}
      <Swiper
        slidesPerView={2.2}
        spaceBetween={16}
        breakpoints={{
          640: { slidesPerView: 3, spaceBetween: 20 },
          768: { slidesPerView: 4, spaceBetween: 24 },
          1024: { slidesPerView: 5, spaceBetween: 30 },
        }}
        loop={true}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="mySwiper relative group/list px-4 md:px-0"
      >
        {isNewlyMovieItem
          ? movies.map((movie) => (
              <SwiperSlide key={movie._id}>
                <NewlyMovieItem movie={movie as NewlyMovie} />
              </SwiperSlide>
            ))
          : movies.map((movie) => (
              <SwiperSlide key={movie._id}>
                <RegularMovieItem movie={movie as Movie} />
              </SwiperSlide>
            ))}

        {/* Desktop Navigation — full-height side panels */}
        <button
          type="button"
          aria-label="Previous"
          onClick={handlePrevSlide}
          className="absolute hidden lg:flex items-center justify-start top-0 left-0 bottom-0 w-[8%] z-30 bg-gradient-to-r from-black/95 via-black/50 to-transparent opacity-0 group-hover/list:opacity-100 transition-opacity duration-300 cursor-pointer"
        >
          <GrPrevious
            size={42}
            className="text-content-main drop-shadow-lg ml-2 hover:scale-125 transition-transform duration-200"
          />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={handleNextSlide}
          className="absolute hidden lg:flex items-center justify-end top-0 right-0 bottom-0 w-[8%] z-30 bg-gradient-to-l from-black/95 via-black/50 to-transparent opacity-0 group-hover/list:opacity-100 transition-opacity duration-300 cursor-pointer"
        >
          <GrNext
            size={42}
            className="text-content-main drop-shadow-lg mr-2 hover:scale-125 transition-transform duration-200"
          />
        </button>

        {/* Mobile Navigation — floating circles */}
        <button
          type="button"
          aria-label="Previous"
          onClick={handlePrevSlide}
          className="absolute flex lg:hidden items-center justify-center top-1/2 left-2 -translate-y-1/2 w-9 h-9 bg-surface-primary/60 backdrop-blur-sm rounded-full z-30 opacity-0 group-hover/list:opacity-100 transition-opacity duration-300"
        >
          <GrPrevious size={18} className="text-content-main" />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={handleNextSlide}
          className="absolute flex lg:hidden items-center justify-center top-1/2 right-2 -translate-y-1/2 w-9 h-9 bg-surface-primary/60 backdrop-blur-sm rounded-full z-30 opacity-0 group-hover/list:opacity-100 transition-opacity duration-300"
        >
          <GrNext size={18} className="text-content-main" />
        </button>
      </Swiper>
    </div>
  );
}
