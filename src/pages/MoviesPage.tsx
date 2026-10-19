import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Film, LayoutGrid, Rows3, Search } from 'lucide-react';
import DiscoveryFilterBar, { type GenreOption } from '@/components/DiscoveryFilterBar';
import DiscoveryRail from '@/components/DiscoveryRail';
import MediaCard from '@/components/MediaCard';
import { GridSkeleton } from '@/components/Skeleton';
import { useFilteredDiscovery } from '@/hooks/useApiQueries';
import { pageTitle } from '@/lib/brand';

/**
 * The movies browse page.
 *
 * Ported 1:1 from frameXTV.xyz's `MoviesPage`. With no filter in the URL it
 * shows ten curated rails (toggleable between rail and grid layout); with any
 * filter set it switches to a single "Filtered Discovery" grid.
 */

const GENRES: GenreOption[] = [
  { id: '28', label: 'Action' },
  { id: '12', label: 'Adventure' },
  { id: '16', label: 'Animation' },
  { id: '35', label: 'Comedy' },
  { id: '80', label: 'Crime' },
  { id: '18', label: 'Drama' },
  { id: '14', label: 'Fantasy' },
  { id: '27', label: 'Horror' },
  { id: '9648', label: 'Mystery' },
  { id: '10749', label: 'Romance' },
  { id: '878', label: 'Sci-Fi' },
  { id: '53', label: 'Thrillers' },
];

const RAILS = [
  { title: 'Trending Movies', subtitle: 'Most watched titles across the network today', category: 'trending' },
  { title: 'Popular Movies', subtitle: 'Global crowd favorites and blockbuster hits', category: 'popular' },
  { title: 'In Theaters / Now Playing', subtitle: 'Current theatrical releases and recent premieres', category: 'now_playing' },
  { title: 'Top Rated', subtitle: 'Critically acclaimed cinema masterpieces', category: 'top_rated' },
  { title: 'Action', subtitle: 'High-octane blockbusters, stunts, and warfare', genre: '28' },
  { title: 'Sci-Fi', subtitle: 'Futuristic odysseys and extraterrestrial mysteries', genre: '878' },
  { title: 'Comedy', subtitle: 'Witty banter, parodies, and lighthearted cinema', genre: '35' },
  { title: 'Horror', subtitle: 'Supernatural chills, slashers, and psychological dread', genre: '27' },
  { title: 'Thrillers', subtitle: 'High-tension conspiracies, heists, and suspense', genre: '53' },
  { title: 'Adventure', subtitle: 'Epic quests, expeditions, and uncharted journeys', genre: '12' },
];

export default function MoviesPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'rows' | 'grid'>('rows');

  const genre = params.get('genre') || undefined;
  const year = params.get('year') ? Number(params.get('year')) : undefined;
  const rating = params.get('rating') ? Number(params.get('rating')) : undefined;
  const sort = params.get('sort') || undefined;
  const hasFilter = Boolean(genre || year || rating || sort);

  const { data, isLoading, isError, error } = useFilteredDiscovery(
    'movie',
    { genre, year: year?.toString(), minRating: rating?.toString(), sort },
    hasFilter
  );
  const items = data?.items || [];

  useEffect(() => {
    document.title = pageTitle('Movies');
  }, []);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}&type=movie`);
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col gap-4 border-b border-white/[0.04] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Film className="w-4 h-4 text-white" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Movies</h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              Browse trending cinema, award-winning blockbusters, and curated genre collections.
            </p>
          </div>

          {!hasFilter && (
            <div className="flex items-center space-x-1 bg-zinc-950/80 p-1 rounded-lg border border-white/[0.08] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setLayout('rows')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${layout === 'rows' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                title="Categorized rails"
              >
                <Rows3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rails</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('grid')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${layout === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                title="Full poster grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movie catalog..."
            className="w-full bg-zinc-950/80 text-white placeholder-zinc-500 text-xs pl-9 pr-20 py-2 rounded-xl border border-white/[0.08] focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold font-mono transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Find
          </button>
        </form>
      </div>

      <DiscoveryFilterBar type="movie" genres={GENRES} />

      {hasFilter ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Filtered Discovery</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-xs font-mono font-semibold">
                {items.length} titles
              </span>
            </h2>
          </div>

          {isLoading ? (
            <GridSkeleton count={12} />
          ) : isError ? (
            <div className="p-8 rounded-2xl bg-zinc-950/60 border border-white/[0.06] text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-white">Failed to load filtered results</p>
              <p className="text-xs text-zinc-500 font-mono">
                {error instanceof Error ? error.message : 'Upstream service unavailable'}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-white/[0.06] space-y-2">
              <p className="text-sm font-semibold text-zinc-300">No movies match your filter criteria</p>
              <p className="text-xs text-zinc-500">Try adjusting your genre, year, or rating thresholds.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
              {items.map((item) => (
                <MediaCard
                  key={`filtered-${item.id}`}
                  id={item.id}
                  type="movie"
                  title={item.title}
                  poster={item.poster || item.image}
                  year={item.year}
                  rating={item.rating}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {RAILS.map((rail) => (
            <DiscoveryRail
              key={rail.title}
              title={rail.title}
              subtitle={rail.subtitle}
              type="movie"
              category={rail.category}
              extraParams={rail.genre ? { genre: rail.genre } : undefined}
              layout={layout === 'grid' ? 'grid' : 'rail'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
