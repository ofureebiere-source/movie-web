import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bookmark, ChevronRight, Film, Sparkles, Trash2, Tv } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import { useMyList } from '@/lib/watchlist';
import { pageTitle } from '@/lib/brand';

/**
 * The My List page.
 *
 * Ported 1:1 from frameXTV.xyz's `MyListPage`: a sticky header with the count
 * badge and a Clear List button, a filter row (All / Movies / TV Series /
 * Anime) carrying per-type counts, then a responsive poster grid. The empty
 * state offers all three catalogues, the per-filter empty state offers a way
 * back to everything, and clearing asks for confirmation first.
 */

type Filter = 'all' | 'movie' | 'tv' | 'anime';

const FILTER_META: { id: Filter; label: string; icon: typeof Film }[] = [
  { id: 'all', label: 'All', icon: Bookmark },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'tv', label: 'TV Series', icon: Tv },
  { id: 'anime', label: 'Anime', icon: Sparkles },
];

export default function MyListPage() {
  const { items, clear } = useMyList();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirming, setConfirming] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = pageTitle('My List');
  }, []);

  const counts: Record<Filter, number> = {
    all: items.length,
    movie: items.filter((entry) => entry.mediaType === 'movie').length,
    tv: items.filter((entry) => entry.mediaType === 'tv').length,
    anime: items.filter((entry) => entry.mediaType === 'anime').length,
  };

  const visible = items.filter((entry) => filter === 'all' || entry.mediaType === filter);

  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-20 font-sans">
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">My List</h1>
                {items.length > 0 && (
                  <span
                    data-testid="my-list-total-count"
                    className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 font-semibold"
                  >
                    {items.length} {items.length === 1 ? 'title' : 'titles'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono">Your saved movies, TV shows, and anime series</p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                data-testid="my-list-clear-btn"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear List</span>
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div ref={filtersRef} className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              {FILTER_META.map((entry) => {
                const active = filter === entry.id;
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-testid={`my-list-filter-${entry.id}`}
                    onClick={() => setFilter(entry.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-850'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-black' : 'text-zinc-400'}`} />
                    <span>{entry.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        active ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {counts[entry.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        {items.length === 0 ? (
          <div
            data-testid="my-list-empty-state"
            className="w-full min-h-[50vh] flex flex-col items-center justify-center text-center p-8 space-y-6 max-w-md mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-inner">
              <Bookmark className="w-8 h-8 opacity-40 text-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white tracking-tight">Your list is empty</h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Save movies, shows, and anime you want to watch later. Tap the bookmark icon on any title to add it
                here.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Link
                to="/movies"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Explore Movies</span>
              </Link>
              <Link
                to="/tv"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Explore TV</span>
              </Link>
              <Link
                to="/anime"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore Anime</span>
              </Link>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="w-full min-h-[40vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
            <p className="text-sm text-zinc-400">No saved titles matching this category.</p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <span>Show All Titles ({items.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            data-testid="my-list-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6 justify-items-center"
          >
            {visible.map((entry) => (
              <div key={`${entry.mediaType}:${entry.id}`} className="relative w-full flex justify-center">
                <MediaCard
                  id={entry.id}
                  type={entry.mediaType}
                  title={entry.title}
                  poster={entry.poster}
                  year={entry.year}
                  anilistId={entry.mediaType === 'anime' ? entry.id : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
          data-testid="clear-my-list-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="absolute inset-0 cursor-pointer" onClick={() => setConfirming(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-sm bg-zinc-950 border border-zinc-850 rounded-2xl p-6 shadow-2xl space-y-4 text-left animate-scale-up">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 id="clear-modal-title" className="text-base font-bold text-white">
                Clear My List?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will remove all {items.length} saved titles from your local list. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-clear-my-list-btn"
                onClick={() => {
                  clear();
                  setConfirming(false);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
