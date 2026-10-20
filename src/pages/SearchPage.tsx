import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Film,
  LayoutGrid,
  Search as SearchIcon,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { GridSkeleton } from '@/components/Skeleton';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { searchTitles, type FxItem, type FxPage } from '@/lib/api';
import { searchAnime } from '@/lib/anilist';
import { pageTitle } from '@/lib/brand';

/**
 * The search page.
 *
 * Ported 1:1 from frameXTV.xyz's `SearchPage`: query, type, sort and page all
 * live in the URL; the input auto-focuses when the page opens empty; `/`
 * focuses it from anywhere; Escape clears the query (or blurs when already
 * empty); a type tablist and a sort select sit above the grid; the empty state
 * offers six one-tap popular searches; and pagination collapses to
 * first / window / last with ellipses, falling back to "n / m" on mobile.
 *
 * "All" fans out to the TMDB-backed index and AniList at once and interleaves
 * the two result sets — which is what upstream does, so one search finds
 * films, series and anime together.
 */

type SearchType = 'all' | 'movie' | 'tv' | 'anime';
type SearchSort = 'relevance' | 'popularity' | 'rating' | 'newest';

interface SearchState {
  query: string;
  type: SearchType;
  sort: SearchSort;
  page: number;
}

const TYPES: { label: string; value: SearchType; icon: typeof LayoutGrid }[] = [
  { label: 'All', value: 'all', icon: LayoutGrid },
  { label: 'Movies', value: 'movie', icon: Film },
  { label: 'TV Series', value: 'tv', icon: Tv },
  { label: 'Anime', value: 'anime', icon: Sparkles },
];

const SORTS: { label: string; value: SearchSort }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Popularity', value: 'popularity' },
  { label: 'Rating', value: 'rating' },
  { label: 'Newest', value: 'newest' },
];

const POPULAR = ['Inception', 'Breaking Bad', 'One Piece', 'Interstellar', 'Attack on Titan', 'The Dark Knight'];

function animeSort(sort: SearchSort): string[] {
  if (sort === 'popularity') return ['POPULARITY_DESC'];
  if (sort === 'rating') return ['SCORE_DESC'];
  if (sort === 'newest') return ['START_DATE_DESC'];
  return ['SEARCH_MATCH', 'POPULARITY_DESC'];
}

/** Runs the search for one media type, or the interleaved "all" fan-out. */
async function runSearch(query: string, type: SearchType, sort: SearchSort, page: number): Promise<FxPage> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], page: 1, totalPages: 0, totalItems: 0 };

  if (type === 'anime') return searchAnime(trimmed, page, 24, animeSort(sort));
  if (type === 'movie' || type === 'tv') return searchTitles(trimmed, type, page);

  const [catalog, anime] = await Promise.allSettled([
    searchTitles(trimmed, 'all', page),
    searchAnime(trimmed, page, 12),
  ]);

  const catalogPage = catalog.status === 'fulfilled' ? catalog.value : null;
  const animePage = anime.status === 'fulfilled' ? anime.value : null;
  const catalogItems = catalogPage?.items ?? [];
  const animeItems = animePage?.items ?? [];

  const merged: FxItem[] = [];
  const longest = Math.max(catalogItems.length, animeItems.length);
  for (let index = 0; index < longest; index += 1) {
    if (index < catalogItems.length) merged.push(catalogItems[index]);
    if (index < animeItems.length) merged.push(animeItems[index]);
  }

  if (sort === 'rating') {
    merged.sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
  } else if (sort === 'newest') {
    merged.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
  }

  return {
    items: merged,
    page,
    totalPages: Math.max(catalogPage?.totalPages ?? 1, animePage?.totalPages ?? 1),
    totalItems: (catalogPage?.totalItems ?? 0) + (animePage?.totalItems ?? 0) || merged.length,
    warning: catalogPage?.warning || animePage?.warning,
  };
}

function readParams(params: URLSearchParams): SearchState {
  const rawType = params.get('type');
  const rawSort = params.get('sort');
  const rawPage = parseInt(params.get('page') || '1', 10);
  return {
    query: (params.get('q') || '').trim(),
    type: rawType && ['all', 'movie', 'tv', 'anime'].includes(rawType) ? (rawType as SearchType) : 'all',
    sort:
      rawSort && ['relevance', 'popularity', 'rating', 'newest'].includes(rawSort)
        ? (rawSort as SearchSort)
        : 'relevance',
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  };
}

function writeParams(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.type !== 'all') params.set('type', state.type);
  if (state.sort !== 'relevance') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { query, type, sort, page } = readParams(params);

  const search = useQuery({
    queryKey: ['search', type, query, sort, page],
    queryFn: () => runSearch(query, type, sort, page),
    enabled: Boolean(query),
    staleTime: 300_000,
    placeholderData: (previous: FxPage | undefined) => previous,
  });

  useEffect(() => {
    document.title = query ? pageTitle(`Search: ${query}`) : pageTitle('Search & Discovery');
  }, [query]);

  const update = useCallback(
    (patch: Partial<SearchState>) => {
      const next: SearchState = { query, type, sort, page, ...patch };
      // A filter change resets to page 1; a page change on its own does not.
      if (!('page' in patch) && ('query' in patch || 'type' in patch || 'sort' in patch)) next.page = 1;
      setParams(new URLSearchParams(writeParams(next).slice(1)));
    },
    [query, type, sort, page, setParams]
  );

  const items = search.data?.items ?? [];
  const totalResults = search.data?.totalItems;
  const totalPages = search.data?.totalPages || 1;

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-4">
        <SearchBar initialValue={query} onSearch={(next) => update({ query: next })} autoFocus={!query} />
        {query && (
          <SearchControls
            activeType={type}
            activeSort={sort}
            onTypeChange={(next) => update({ type: next })}
            onSortChange={(next) => update({ sort: next })}
            totalResults={totalResults}
          />
        )}
      </div>

      {search.data?.warning && (
        <div className="flex items-center space-x-2 p-3 rounded-xl border border-amber-900/40 bg-amber-950/20 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{search.data.warning}</span>
        </div>
      )}

      {!query ? (
        <NoMatches onSelectSuggestion={(term) => update({ query: term })} />
      ) : search.isLoading ? (
        <div className="space-y-4">
          <div className="h-4 w-48 bg-zinc-900 rounded animate-pulse" />
          <GridSkeleton count={12} />
        </div>
      ) : search.isError ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 my-8">
          <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-800/40 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white">Unable to complete search</h3>
            <p className="text-xs text-zinc-400">
              {search.error instanceof Error
                ? search.error.message
                : 'A network error occurred while retrieving results.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void search.refetch()}
            className="px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <NoMatches
          query={query}
          onClear={() => setParams(new URLSearchParams())}
          onSelectSuggestion={(term) => update({ query: term })}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-zinc-200">
              Results for <span className="text-white">“{query}”</span>
            </h2>
            {totalPages > 1 && (
              <span className="text-xs font-mono text-zinc-500">
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {items.map((item) => (
              <MediaCard
                key={`${item.type}-${item.id}-${item.anilistId || ''}`}
                id={item.id}
                type={item.type || (type === 'all' ? 'movie' : type)}
                title={item.title}
                poster={item.poster || item.image}
                year={item.year}
                rating={item.rating}
                anilistId={item.anilistId}
                episodeCount={item.episodeCount}
                className="w-full"
              />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(next) => {
              update({ page: next });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}
    </div>
  );
}

/** The search input: `/` focuses it, Escape clears it, the button submits. */
function SearchBar({
  initialValue = '',
  placeholder = 'Search movies, TV series, anime...',
  onSearch,
  className = '',
  autoFocus = false,
}: {
  initialValue?: string;
  placeholder?: string;
  onSearch: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || document.activeElement === inputRef.current) return;
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clear = () => {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim());
      }}
      className={`relative flex items-center w-full max-w-2xl mx-auto ${className}`}
      role="search"
    >
      <div className="relative w-full flex items-center">
        <div className="absolute left-3.5 sm:left-4 pointer-events-none text-zinc-400">
          <SearchIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            if (value) clear();
            else inputRef.current?.blur();
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Search query"
          className="w-full bg-zinc-950/90 text-white placeholder-zinc-500 text-xs sm:text-sm pl-10 sm:pl-11 pr-20 sm:pr-24 py-2.5 sm:py-3 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none shadow-inner transition-all selection:bg-white selection:text-black"
        />
        <div className="absolute right-2 sm:right-2.5 flex items-center space-x-1.5">
          {value && (
            <button
              type="button"
              onClick={clear}
              title="Clear search query (Esc)"
              aria-label="Clear query"
              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim()}
            title="Submit search"
            aria-label="Submit search"
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold font-mono tracking-tight transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-sm"
          >
            <span className="hidden sm:inline">Search</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>
    </form>
  );
}

/** The media-type tablist and the sort select. */
function SearchControls({
  activeType,
  activeSort,
  onTypeChange,
  onSortChange,
  totalResults,
}: {
  activeType: SearchType;
  activeSort: SearchSort;
  onTypeChange: (type: SearchType) => void;
  onSortChange: (sort: SearchSort) => void;
  totalResults?: number;
}) {
  const railRef = useHorizontalScroll<HTMLDivElement>();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full border-b border-zinc-900 pb-3">
      <div
        ref={railRef}
        className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-touch"
        role="tablist"
      >
        {TYPES.map((entry) => {
          const Icon = entry.icon;
          const isActive = activeType === entry.value;
          return (
            <button
              key={`type-${entry.value}`}
              type="button"
              onClick={() => onTypeChange(entry.value)}
              role="tab"
              aria-selected={isActive}
              className={`flex items-center space-x-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                isActive
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-850'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs">
        {typeof totalResults === 'number' && (
          <span className="text-zinc-500 font-mono text-[11px]">
            {totalResults} {totalResults === 1 ? 'title' : 'titles'}
          </span>
        )}
        <div className="flex items-center space-x-1.5 bg-zinc-950 border border-zinc-850 px-2 py-1 min-h-[34px] rounded-lg">
          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
          <label htmlFor="search-sort-select" className="sr-only">
            Sort by
          </label>
          <select
            id="search-sort-select"
            value={activeSort}
            onChange={(event) => onSortChange(event.target.value as SearchSort)}
            className="bg-transparent text-zinc-300 text-xs font-medium focus:outline-none cursor-pointer"
          >
            {SORTS.map((entry) => (
              <option key={entry.value} value={entry.value} className="bg-zinc-950 text-white">
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/** First / window / last pagination with ellipses, collapsing on mobile. */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const pages: (number | 'ellipsis')[] = (() => {
    const windowed: number[] = [];
    for (let index = Math.max(2, currentPage - 1); index <= Math.min(totalPages - 1, currentPage + 1); index += 1) {
      windowed.push(index);
    }
    const output: (number | 'ellipsis')[] = [1];
    if (windowed.length > 0 && windowed[0] > 2) output.push('ellipsis');
    output.push(...windowed);
    if (windowed.length > 0 && windowed[windowed.length - 1] < totalPages - 1) output.push('ellipsis');
    if (totalPages > 1 && !output.includes(totalPages)) output.push(totalPages);
    return output;
  })();

  return (
    <nav
      aria-label="Search pagination"
      className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-4 ${className}`}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious}
        aria-label="Previous page"
        className="flex items-center space-x-1 px-3 py-2 sm:px-3 sm:py-1.5 min-h-[36px] rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 disabled:hover:text-zinc-300 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      <div className="hidden sm:flex items-center space-x-1">
        {pages.map((entry, index) => {
          if (entry === 'ellipsis') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 py-1 text-zinc-600 text-xs font-mono select-none">
                ...
              </span>
            );
          }
          const isActive = entry === currentPage;
          return (
            <button
              key={`page-${entry}`}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-850'
              }`}
            >
              {entry}
            </button>
          );
        })}
      </div>

      <div className="flex sm:hidden items-center px-3 text-xs font-mono text-zinc-400">
        <span>{currentPage}</span>
        <span className="mx-1 text-zinc-600">/</span>
        <span>{totalPages}</span>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext}
        aria-label="Next page"
        className="flex items-center space-x-1 px-3 py-2 sm:px-3 sm:py-1.5 min-h-[36px] rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 disabled:hover:text-zinc-300 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
}

/** The empty state: a nudge to type, plus six one-tap popular searches. */
function NoMatches({
  query,
  onClear,
  onSelectSuggestion,
}: {
  query?: string;
  onClear?: () => void;
  onSelectSuggestion: (term: string) => void;
}) {
  return (
    <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-5 my-6">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto shadow-sm">
        <SearchIcon className="w-5 h-5 text-zinc-300" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">No matches found</h3>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
          {query ? (
            <>
              We couldn&apos;t find any titles matching <span className="text-white font-semibold">“{query}”</span>.
            </>
          ) : (
            'Start typing a title above to search across movies, TV shows, and anime.'
          )}
        </p>
      </div>

      <div className="space-y-2 pt-2 border-t border-zinc-900">
        <div className="flex items-center justify-center space-x-1 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-rose-500" />
          <span>Popular searches</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {POPULAR.map((term) => (
            <button
              key={`suggest-${term}`}
              type="button"
              onClick={() => onSelectSuggestion(term)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs transition-colors cursor-pointer"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {query && onClear && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear search</span>
          </button>
        </div>
      )}
    </div>
  );
}
