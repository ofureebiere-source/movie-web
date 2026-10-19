import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Clock, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { GridSkeleton } from '@/components/Skeleton';
import { useSearch, useAnimeSearch } from '@/hooks/useApiQueries';
import { pageTitle } from '@/lib/brand';

/**
 * The search page.
 *
 * Ported 1:1 from frameXTV.xyz's `SearchPage`: the query lives in `?q=`, the
 * type in `?type=`, the input is focused on mount, Enter submits, the term is
 * debounced 500 ms before it hits the API, recent terms are kept in
 * `localStorage`, and picking the Anime type swaps the upstream for AniList.
 */

const RECENT_KEY = 'framextv_recent_searches';
const MAX_RECENT = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string): void {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecent().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      MAX_RECENT
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* disabled */
  }
}

function clearRecent(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* disabled */
  }
}

type TypeFilter = 'all' | 'movie' | 'tv' | 'anime';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const query = params.get('q') || '';
  const type = (params.get('type') as TypeFilter) || 'all';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const [input, setInput] = useState(query);
  const [debounced, setDebounced] = useState(query);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  useEffect(() => {
    document.title = pageTitle(query ? `Search: ${query}` : 'Search');
  }, [query]);

  useEffect(() => {
    setInput(query);
    setDebounced(query);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 500);
    return () => clearTimeout(timer);
  }, [input]);

  // Keep the URL in step with the debounced term, so a search is shareable.
  useEffect(() => {
    if (debounced === query) return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (debounced) next.set('q', debounced);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true }
    );
    if (debounced) pushRecent(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const movieSearch = useSearch(debounced, type === 'anime' ? 'all' : type, page);
  const animeSearch = useAnimeSearch(debounced, type === 'anime');

  const active = type === 'anime' ? animeSearch : movieSearch;
  const items = active.data?.items || [];
  const totalPages = active.data?.totalPages || 1;

  const setType = (next: TypeFilter) => {
    setParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next === 'all') params.delete('type');
        else params.set('type', next);
        params.delete('page');
        return params;
      },
      { replace: true }
    );
  };

  const setPage = (next: number) => {
    setParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
        return params;
      },
      { replace: true }
    );
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-3 border-b border-white/[0.04] pb-5">
        <div className="flex items-center space-x-2">
          <SearchIcon className="w-4 h-4 text-white" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Search</h1>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = input.trim();
            if (!trimmed) return;
            pushRecent(trimmed);
            setRecent(readRecent());
            setDebounced(trimmed);
            setParams({ q: trimmed, ...(type !== 'all' ? { type } : {}) });
          }}
          className="relative w-full max-w-2xl"
        >
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search movies, TV series, anime..."
            className="w-full bg-zinc-950/80 text-white placeholder-zinc-500 text-sm pl-10 pr-10 py-2.5 rounded-xl border border-white/[0.08] focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput('');
                setDebounced('');
                setParams({});
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'TV Series' },
              { id: 'anime', label: 'Anime' },
            ] as { id: TypeFilter; label: string }[]
          ).map((option) => {
            const isActive = type === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-active={isActive ? 'true' : 'false'}
                onClick={() => setType(option.id)}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {option.id === 'anime' && <Sparkles className="w-3 h-3 inline mr-1" />}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {!query && recent.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Recent searches</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                clearRecent();
                setRecent([]);
              }}
              className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setInput(term);
                  setDebounced(term);
                  setParams({ q: term });
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              Results for <span className="text-white font-bold">“{query}”</span>
            </h2>
            <span className="text-[11px] font-mono text-zinc-400">
              {active.isFetching ? 'Searching…' : `${items.length} titles`}
            </span>
          </div>

          {active.isLoading ? (
            <GridSkeleton count={12} />
          ) : active.isError ? (
            <div className="p-8 rounded-2xl bg-zinc-950/60 border border-white/[0.06] text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-white">Search failed</p>
              <p className="text-xs text-zinc-500 font-mono">
                {active.error instanceof Error ? active.error.message : 'Upstream service unavailable'}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-semibold text-zinc-300">No titles found for “{query}”</p>
              <p className="text-xs text-zinc-500">Try a shorter term or a different media type.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
                {items.map((item) => (
                  <MediaCard
                    key={`${item.type || type}-${item.id}`}
                    id={item.id}
                    type={item.type || (type === 'anime' ? 'anime' : type === 'tv' ? 'tv' : 'movie')}
                    title={item.title}
                    poster={item.poster || item.image}
                    year={item.year}
                    rating={item.rating}
                    anilistId={item.type === 'anime' || type === 'anime' ? item.anilistId || item.id : undefined}
                    className="w-full"
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
