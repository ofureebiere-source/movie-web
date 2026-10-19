import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Search, Trash2 } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { useMyList } from '@/lib/watchlist';
import { pageTitle } from '@/lib/brand';

/**
 * The My List page.
 *
 * Ported 1:1 from frameXTV.xyz's `MyListPage`: the saved titles as a responsive
 * poster grid, a type filter (All / Movies / Series / Anime) and a Clear All
 * action, with a dedicated empty state.
 */

type Filter = 'all' | 'movie' | 'tv' | 'anime';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV Series' },
  { id: 'anime', label: 'Anime' },
];

export default function MyListPage() {
  const { items, clear, count } = useMyList();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    document.title = pageTitle('My List');
  }, []);

  const filtered = filter === 'all' ? items : items.filter((entry) => entry.mediaType === filter);

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-4 h-4 text-white" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">My List</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {count} title{count === 1 ? '' : 's'} saved for later
          </p>
        </div>

        {count > 0 && (
          <button
            type="button"
            data-testid="my-list-clear-all-btn"
            onClick={clear}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-900/50 text-zinc-300 hover:text-rose-400 text-xs font-medium transition-all cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {count === 0 ? (
        <div data-testid="my-list-empty-state" className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Bookmark className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white">Your list is empty</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Tap the bookmark on any poster to save movies, series, and anime for later.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              to="/movies"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all"
            >
              <span>Browse Movies</span>
            </Link>
            <Link
              to="/search"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map((option) => {
              const active = filter === option.id;
              const countFor =
                option.id === 'all' ? items.length : items.filter((entry) => entry.mediaType === option.id).length;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-active={active ? 'true' : 'false'}
                  onClick={() => setFilter(option.id)}
                  className={`flex-shrink-0 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {option.label}
                  <span className={`ml-1.5 text-[10px] font-mono ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    {countFor}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-white/[0.06] space-y-2">
              <p className="text-sm font-semibold text-zinc-300">Nothing saved in this category</p>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
              >
                Show all saved titles
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
              {filtered.map((entry) => (
                <MediaCard
                  key={`${entry.mediaType}-${entry.id}`}
                  id={entry.id}
                  type={entry.mediaType}
                  title={entry.title}
                  poster={entry.poster}
                  year={entry.year}
                  anilistId={entry.mediaType === 'anime' ? entry.id : undefined}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
