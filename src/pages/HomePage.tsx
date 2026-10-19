import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2 } from 'lucide-react';
import Hero from '@/components/Hero';
import DiscoveryRail from '@/components/DiscoveryRail';
import { ContinueWatchingRail, MyListRail } from '@/components/HomeRails';
import { getHome } from '@/lib/api';
import { useContinueWatching } from '@/lib/watchProgress';
import { useMyList } from '@/lib/watchlist';
import { SITE_NAME } from '@/lib/brand';
import { STALE } from '@/hooks/useApiQueries';

/**
 * The home page.
 *
 * Ported 1:1 from frameXTV.xyz's `HomePage`: one hero, then Continue Watching,
 * My List, and the ten named rails, then the API/embed CTA. The rails are
 * ordered exactly as the reference orders them and each one is seeded from the
 * single `/api/home` payload so only one request is needed for first paint.
 */

const HOME_QUERY_KEY = ['home-aggregated'];

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: HOME_QUERY_KEY,
    queryFn: getHome,
    staleTime: STALE.rail,
    gcTime: 1_800_000,
    refetchOnWindowFocus: false,
    retry: 3,
  });

  const { items: continueWatching, refresh } = useContinueWatching();
  const { items: myList } = useMyList();

  useEffect(() => {
    document.title = SITE_NAME;
  }, []);

  const hero = data?.hero || data?.rails?.trending_movies?.results?.[0];
  const rails = data?.rails;

  return (
    <div className="min-h-full page-bg text-zinc-100 flex flex-col font-sans w-full">
      <Hero item={hero} isLoading={isLoading} />

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <ContinueWatchingRail items={continueWatching} refresh={refresh} />
        <MyListRail items={myList} />

        <DiscoveryRail
          title="Trending Now"
          subtitle="Top cinema and television streams today"
          type="movie"
          category="trending"
          viewAllLink="/movies"
          initialData={rails?.trending_movies}
        />
        <DiscoveryRail
          title="Popular Movies"
          subtitle="Global crowd favorites and blockbuster cinema"
          type="movie"
          category="popular"
          viewAllLink="/movies"
          initialData={rails?.popular_movies}
        />
        <DiscoveryRail
          title="Popular TV Series"
          subtitle="Binge-worthy drama, mysteries, and episodic television"
          type="tv"
          category="popular"
          viewAllLink="/tv"
          initialData={rails?.popular_tv}
        />
        <DiscoveryRail
          title="Popular Anime"
          subtitle="Acclaimed Japanese animation series and seasonal hits"
          type="anime"
          category="popular"
          viewAllLink="/anime"
          initialData={rails?.popular_anime}
        />
        <DiscoveryRail
          title="New Releases"
          subtitle="Recently released cinema and fresh digital arrivals"
          type="movie"
          category="new_releases"
          viewAllLink="/movies"
          initialData={rails?.new_releases}
        />
        <DiscoveryRail
          title="Action"
          subtitle="High-octane blockbusters, combat, and warfare"
          type="movie"
          extraParams={{ genre: '28' }}
          viewAllLink="/movies?genre=28"
          initialData={rails?.action_movies}
        />
        <DiscoveryRail
          title="Sci-Fi"
          subtitle="Interstellar journeys, cybernetic futures, and quantum paradoxes"
          type="movie"
          extraParams={{ genre: '878' }}
          viewAllLink="/movies?genre=878"
          initialData={rails?.scifi_movies}
        />
        <DiscoveryRail
          title="Thrillers"
          subtitle="High-stakes suspense, conspiracies, and cat-and-mouse games"
          type="movie"
          extraParams={{ genre: '53' }}
          viewAllLink="/movies?genre=53"
          initialData={rails?.thriller_movies}
        />
        <DiscoveryRail
          title="Comedy"
          subtitle="Witty banter, satiric laughs, and feel-good stories"
          type="movie"
          extraParams={{ genre: '35' }}
          viewAllLink="/movies?genre=35"
          initialData={rails?.comedy_movies}
        />
        <DiscoveryRail
          title="Currently Airing Anime"
          subtitle="Ongoing anime broadcasts with new weekly episodes"
          type="anime"
          category="airing"
          viewAllLink="/anime"
          initialData={rails?.airing_anime}
        />

        <div className="pt-4 pb-2 border-t border-zinc-900">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-white">Developer &amp; Stream Embed Engine</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Integrate {SITE_NAME} clean iframe players with multi-tier failover and Chromecast directly into
                  your platform.
                </p>
              </div>
            </div>
            <Link
              to="/api"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white text-xs font-medium transition-colors shrink-0"
            >
              <span>API Documentation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
