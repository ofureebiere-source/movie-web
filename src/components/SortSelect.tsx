import { useSearchParams } from 'react-router-dom';

/**
 * The sort control shared by every grid that offers one.
 *
 * Extracted from `DiscoveryFilterBar` so the person page's filmography sorts
 * with the very same option list, the same `sort` URL parameter and the same
 * markup the browse pages use — a visitor who has learned the control on
 * /movies reads it identically here.
 */

export interface SortOption {
  id: string;
  label: string;
}

export const SORT_MOVIE: SortOption[] = [
  { id: 'popularity.desc', label: 'Most Popular' },
  { id: 'vote_average.desc', label: 'Top Rated' },
  { id: 'primary_release_date.desc', label: 'Newest First' },
  { id: 'primary_release_date.asc', label: 'Oldest First' },
];

export const SORT_ANIME: SortOption[] = [
  { id: 'TRENDING_DESC', label: 'Trending Now' },
  { id: 'POPULARITY_DESC', label: 'Most Popular' },
  { id: 'SCORE_DESC', label: 'Highest Rated' },
  { id: 'START_DATE_DESC', label: 'Newest Releases' },
];

export const SELECT_CLASS =
  'w-full bg-zinc-900/80 border border-white/[0.08] hover:border-white/[0.18] text-zinc-200 text-xs px-2 sm:px-2.5 py-1.5 min-h-[36px] rounded-xl focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/50 transition-all cursor-pointer truncate';

interface SortSelectProps {
  options: SortOption[];
  /** Label for the empty value, e.g. "Default Sort". */
  placeholder?: string;
  testId?: string;
  className?: string;
}

/**
 * A `sort`-parameter select. Reads and writes the URL query string directly,
 * so a sorted view is shareable — the same contract `DiscoveryFilterBar` uses.
 * Changing the sort drops `page` so the grid returns to its first page.
 */
export default function SortSelect({
  options,
  placeholder = 'Default Sort',
  testId = 'sort-select',
  className,
}: SortSelectProps) {
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') || '';

  const update = (value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set('sort', value);
        else next.delete('sort');
        next.delete('page');
        return next;
      },
      { replace: false }
    );
  };

  return (
    <select
      data-testid={testId}
      value={sort}
      onChange={(event) => update(event.target.value)}
      aria-label="Sort order"
      className={className ?? SELECT_CLASS}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
