import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Search, Sparkles } from 'lucide-react';
import DiscoveryFilterBar, { type GenreOption } from '@/components/DiscoveryFilterBar';
import DiscoveryRail from '@/components/DiscoveryRail';
import MediaCard from '@/components/MediaCard';
import Hero from '@/components/Hero';
import { GridSkeleton } from '@/components/Skeleton';
import { useDiscoveryRail, useFilteredDiscovery } from '@/hooks/useApiQueries';
import { pageTitle } from '@/lib/brand';

/**
 * The anime browse page.
 *
 * Ported 1:1 from frameXTV.xyz's `AnimePage`. The genre list is NAMES (the
 * anime upstream does not take TMDB ids), the hero comes from the trending
 * rail, and filtering switches the page to a grid. The reference also offers an
 * "Embed Configurator" tab here; that lives on `/configurator` in this port.
 */

const GENRES: GenreOption[] = [
  { id: 'Action', label: 'Action' },
  { id: 'Adventure', label: 'Adventure' },
  { id: 'Comedy', label: 'Comedy' },
  { id: 'Drama', label: 'Drama' },
  { id: 'Fantasy', label: 'Fantasy' },
  { id: 'Horror', label: 'Horror' },
  { id: 'Mystery', label: 'Mystery' },
  { id: 'Romance', label: 'Romance' },
  { id: 'Sci-Fi', label: 'Sci-Fi' },
  { id: 'Slice of Life', label: 'Slice of Life' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Supernatural', label: 'Supernatural' },
  { id: 'Thriller', label: 'Thriller' },
];

const RAILS = [
  { title: 'Trending Anime', subtitle: 'Most watched Japanese animations and seasonal episodes', category: 'trending' },
  { title: 'Popular Anime', subtitle: 'All-time fan favorites with massive community followings', category: 'popular' },
  { title: 'Currently Airing', subtitle: 'Ongoing broadcast seasons with fresh weekly episodes', category: 'airing' },
  { title: 'Top Rated', subtitle: 'Highest AniList user score masterpieces', category: 'top_rated' },
  { title: 'Action', subtitle: 'Martial arts, shonen battles, and high-energy showdowns', genre: 'Action' },
  { title: 'Adventure', subtitle: 'Expansive world explorations, quests, and journeys', genre: 'Adventure' },
  { title: 'Comedy', subtitle: 'Slapstick humor, parodies, and slice of life laughs', genre: 'Comedy' },
  { title: 'Romance', subtitle: 'Heartwarming relationships, drama, and youth romances', genre: 'Romance' },
  { title: 'Sci-Fi', subtitle: 'Cybernetic futures, mecha suits, and time paradoxes', genre: 'Sci-Fi' },
  { title: 'Fantasy', subtitle: 'Magic academies, isekai realms, and legendary beasts', genre: 'Fantasy' },
];

export default function AnimePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const trending = useDiscoveryRail('anime', 'trending');
  const heroItem = trending.data?.results?.[0];

  const genre = params.get('genre') || undefined;
  const year = params.get('year') || undefined;
  const rating = params.get('rating') || undefined;
  const sort = params.get('sort') || undefined;
  const season = params.get('season') || undefined;
  const status = params.get('status') || undefined;
  const hasFilter = Boolean(genre || year || rating || sort || season || status);

  const { data, isLoading, isError, error } = useFilteredDiscovery(
    'anime',
    {
      genre,
      year,
      minRating: rating ? String(Number(rating) * 10) : undefined,
      sort,
      season,
      status,
    },
    hasFilter
  );
  const items = data?.items || [];

  useEffect(() => {
    document.title = pageTitle('Anime');
  }, []);

  return (
    <div className="min-h-full page-bg text-zinc-100 flex flex-col font-sans w-full">
      <div className="border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-sm sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Anime Network</span>
            </span>
          </div>
          <div className="flex items-center space-x-1 bg-black p-0.5 rounded-lg border border-white/[0.08] text-xs">
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-colors cursor-pointer bg-rose-500 text-white font-bold shadow-sm"
            >
              <span>Anime Discovery</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/configurator')}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-colors cursor-pointer text-zinc-400 hover:text-white"
            >
              <span>Embed Configurator</span>
            </button>
          </div>
        </div>
      </div>

      <div>
        {!hasFilter && <Hero item={heroItem} isLoading={trending.isLoading} />}

        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}&type=anime`);
            }}
            className="relative max-w-lg w-full bg-zinc-950/80 p-1.5 rounded-xl border border-white/[0.08] flex items-center transition-all"
          >
            <Search className="w-4 h-4 ml-2.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search anime by title or AniList ID..."
              className="w-full bg-transparent text-white placeholder-zinc-500 text-xs px-3 py-1.5 outline-none focus:outline-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-rose-500 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              Search
            </button>
          </form>

          <DiscoveryFilterBar type="anime" genres={GENRES} />

          {hasFilter ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Filtered Anime Discovery</span>
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
                  <p className="text-sm font-semibold text-white">Failed to load filtered anime</p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {error instanceof Error ? error.message : 'Upstream service unavailable'}
                  </p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-white/[0.06] space-y-2">
                  <p className="text-sm font-semibold text-zinc-300">No anime match your filter criteria</p>
                  <p className="text-xs text-zinc-500">Try adjusting your genre, season, or year thresholds.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
                  {items.map((item) => (
                    <MediaCard
                      key={`filtered-anime-${item.id}`}
                      id={item.id}
                      type="anime"
                      title={item.title}
                      poster={item.poster || item.image}
                      year={item.year}
                      rating={item.rating}
                      anilistId={item.anilistId || item.id}
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
                  type="anime"
                  category={rail.category}
                  extraParams={rail.genre ? { genre: rail.genre } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
