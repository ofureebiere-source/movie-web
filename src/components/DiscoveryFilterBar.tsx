import { useSearchParams } from 'react-router-dom';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { MediaType } from '@/lib/api';

/**
 * The filter row under each browse page's heading.
 *
 * Ported 1:1 from frameXTV.xyz's `DiscoveryFilterBar` chunk. It writes to the
 * URL query string (not local state) so a filtered view is shareable, and the
 * anime variant adds Season and Status selects that the film/series variant
 * does not have. The genre option list is per-media-type because the two
 * upstreams disagree — films and series take numeric TMDB ids, anime takes
 * genre NAMES.
 */

export interface GenreOption {
  id: string;
  label: string;
}

const SORT_MOVIE: GenreOption[] = [
  { id: 'popularity.desc', label: 'Most Popular' },
  { id: 'vote_average.desc', label: 'Top Rated' },
  { id: 'primary_release_date.desc', label: 'Newest First' },
  { id: 'primary_release_date.asc', label: 'Oldest First' },
];

const SORT_ANIME: GenreOption[] = [
  { id: 'TRENDING_DESC', label: 'Trending Now' },
  { id: 'POPULARITY_DESC', label: 'Most Popular' },
  { id: 'SCORE_DESC', label: 'Highest Rated' },
  { id: 'START_DATE_DESC', label: 'Newest Releases' },
];

const SEASONS: GenreOption[] = [
  { id: 'WINTER', label: 'Winter' },
  { id: 'SPRING', label: 'Spring' },
  { id: 'SUMMER', label: 'Summer' },
  { id: 'FALL', label: 'Fall' },
];

const STATUSES: GenreOption[] = [
  { id: 'RELEASING', label: 'Airing' },
  { id: 'FINISHED', label: 'Completed' },
];

const RATINGS: GenreOption[] = [
  { id: '8', label: '★ 8.0+' },
  { id: '7', label: '★ 7.0+' },
  { id: '6', label: '★ 6.0+' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS: GenreOption[] = Array.from({ length: 15 }, (_, index) => {
  const year = String(CURRENT_YEAR - index);
  return { id: year, label: year };
});

const SELECT_CLASS =
  'w-full bg-zinc-900/80 border border-white/[0.08] hover:border-white/[0.18] text-zinc-200 text-xs px-2 sm:px-2.5 py-1.5 min-h-[36px] rounded-xl focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/50 transition-all cursor-pointer truncate';

export default function DiscoveryFilterBar({ type, genres }: { type: MediaType; genres: GenreOption[] }) {
  const [params, setParams] = useSearchParams();

  const genre = params.get('genre') || '';
  const year = params.get('year') || '';
  const rating = params.get('rating') || '';
  const sort = params.get('sort') || '';
  const season = params.get('season') || '';
  const status = params.get('status') || '';

  const sortOptions = type === 'anime' ? SORT_ANIME : SORT_MOVIE;
  const hasActive = Boolean(genre || year || rating || sort || season || status);

  const update = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        return next;
      },
      { replace: false }
    );
  };

  const reset = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of ['genre', 'year', 'rating', 'sort', 'season', 'status', 'page']) {
          next.delete(key);
        }
        return next;
      },
      { replace: false }
    );
  };

  return (
    <div
      data-testid="discovery-filter-bar"
      className="w-full bg-zinc-950/60 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-3 sm:p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-rose-500" />
          <span>Filters &amp; Discovery</span>
          {hasActive && (
            <span className="px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-400 font-mono text-[10px]">
              Active
            </span>
          )}
        </div>
        {hasActive && (
          <button
            type="button"
            data-testid="filter-reset-btn"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
        <select
          data-testid="filter-select-genre"
          value={genre}
          onChange={(event) => update('genre', event.target.value)}
          aria-label="Filter by genre"
          className={SELECT_CLASS}
        >
          <option value="">All Genres</option>
          {genres.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          data-testid="filter-select-year"
          value={year}
          onChange={(event) => update('year', event.target.value)}
          aria-label="Filter by year"
          className={SELECT_CLASS}
        >
          <option value="">All Years</option>
          {YEARS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          data-testid="filter-select-rating"
          value={rating}
          onChange={(event) => update('rating', event.target.value)}
          aria-label="Filter by rating"
          className={SELECT_CLASS}
        >
          <option value="">Any Rating</option>
          {RATINGS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          data-testid="filter-select-sort"
          value={sort}
          onChange={(event) => update('sort', event.target.value)}
          aria-label="Sort order"
          className={SELECT_CLASS}
        >
          <option value="">Default Sort</option>
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {type === 'anime' && (
          <select
            data-testid="filter-select-season"
            value={season}
            onChange={(event) => update('season', event.target.value)}
            aria-label="Filter by season"
            className={SELECT_CLASS}
          >
            <option value="">All Seasons</option>
            {SEASONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {type === 'anime' && (
          <select
            data-testid="filter-select-status"
            value={status}
            onChange={(event) => update('status', event.target.value)}
            aria-label="Filter by status"
            className={SELECT_CLASS}
          >
            <option value="">All Statuses</option>
            {STATUSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
