import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { CastSection, DetailHero, DetailSkeleton, DetailsError, RecommendationsSection } from '@/components/DetailShared';
import SeasonSelector from '@/components/SeasonSelector';
import { useAnimeDetail } from '@/hooks/useApiQueries';
import { mediaId } from '@/lib/id';
import { formatRemaining, formatTime, getLatestForTitle } from '@/lib/watchProgress';
import { useIsInMyList, toggleMyList } from '@/lib/watchlist';
import { SITE_NAME } from '@/lib/brand';
import NotFoundPage from './NotFoundPage';

/**
 * An anime's detail page.
 *
 * Ported 1:1 from frameXTV.xyz's `AnimeDetailPage`: metadata comes from AniList
 * (the id is an AniList id, not a TMDB id), the episode list is a compact
 * numbered grid paged 25 at a time rather than a card list, and a season switch
 * navigates to the sibling season's own id. The reference also renders the
 * relations as two extra rows, SEQUEL/SIDE_STORY and PREQUEL.
 */

/** The numbered episode grid, paged 25 at a time (the reference's window). */
function EpisodeGrid({ anilistId, totalEpisodes }: { anilistId: string; totalEpisodes: number }) {
  const [page, setPage] = useState(0);

  if (!totalEpisodes || totalEpisodes <= 1) return null;

  const pageCount = Math.ceil(totalEpisodes / 25);
  const start = page * 25 + 1;
  const end = Math.min((page + 1) * 25, totalEpisodes);
  const numbers: number[] = [];
  for (let n = start; n <= end; n += 1) numbers.push(n);

  return (
    <div className="space-y-3 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Episodes</h3>
        <span className="text-[11px] font-mono text-zinc-400">{totalEpisodes} episodes total</span>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none scroll-touch">
          {Array.from({ length: pageCount }, (_, index) => {
            const from = index * 25 + 1;
            const to = Math.min((index + 1) * 25, totalEpisodes);
            const active = index === page;
            return (
              <button
                key={index}
                type="button"
                data-active={active ? 'true' : 'false'}
                onClick={() => setPage(index)}
                className={`flex-shrink-0 px-2.5 py-1 min-h-[32px] rounded-md text-[11px] font-mono transition-all active:scale-95 cursor-pointer ${
                  active
                    ? 'bg-rose-500 text-white font-bold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                }`}
              >
                {from}–{to}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 xs:gap-2">
        {numbers.map((number) => (
          <Link
            key={number}
            to={`/watch/anime/${anilistId}/${number}`}
            className="group flex flex-col items-center justify-center p-2 min-h-[44px] rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 transition-all cursor-pointer active:scale-95 text-center"
            title={`Watch Episode ${number}`}
          >
            <span className="text-[11px] font-mono font-semibold text-zinc-300 group-hover:text-white">EP {number}</span>
            <Play className="w-3 h-3 text-zinc-500 group-hover:text-rose-500 transition-colors mt-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AnimeDetailPage() {
  const { anilistId } = useParams();
  const navigate = useNavigate();
  const clean = mediaId(anilistId);

  const { data: detail, isLoading, isError, error, refetch } = useAnimeDetail(clean);
  const isSaved = useIsInMyList('anime', clean);

  useEffect(() => {
    if (detail?.title) {
      document.title = `${detail.title} ${detail.year ? `(${detail.year}) ` : ''}— ${SITE_NAME}`;
    }
  }, [detail?.title, detail?.year]);

  if (!clean) return <NotFoundPage />;
  if (isLoading) return <DetailSkeleton />;
  if (isError || !detail) {
    return (
      <DetailsError
        title="Anime Not Found"
        message={error instanceof Error ? error.message : 'The requested anime title could not be loaded from AniList.'}
        onRetry={() => refetch()}
      />
    );
  }

  const progress = getLatestForTitle('anime', clean);
  const canResume = Boolean(progress && !progress.completed && progress.timestamp > 15);
  const playUrl = canResume ? `/watch/anime/${clean}/${progress!.episode || 1}` : `/watch/anime/${clean}`;
  const playLabel = canResume ? `Continue Episode ${progress!.episode || 1}` : 'Watch Anime';
  const remaining = progress ? formatRemaining(progress) : '';
  const resumeSubtitle = canResume
    ? remaining
      ? `Resume at ${formatTime(progress!.timestamp)} • ${remaining}`
      : `Resume at ${formatTime(progress!.timestamp)}`
    : undefined;

  const seasons = detail.seasons || [];
  const related = detail.relatedAnime || [];
  const sequels = related.filter((item) => item.relationType === 'SEQUEL' || item.relationType === 'SIDE_STORY');
  const prequels = related.filter((item) => item.relationType === 'PREQUEL');

  return (
    <div className="w-full min-h-screen bg-black text-zinc-100 flex flex-col pb-16">
      <DetailHero
        detail={detail}
        playUrl={playUrl}
        playLabel={playLabel}
        resumeSubtitle={resumeSubtitle}
        isSaved={isSaved}
        onToggleWatchlist={() =>
          toggleMyList({
            mediaType: 'anime',
            id: clean,
            title: detail.title,
            poster: detail.poster,
            backdrop: detail.backdrop,
            year: detail.year,
          })
        }
      />

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        <section className="space-y-6">
          {seasons.length > 1 && (
            <SeasonSelector
              seasons={seasons}
              activeSeason={seasons.find((season) => String(season.id) === String(clean))?.number || 1}
              onSelectSeason={(number) => {
                const target = seasons.find((season) => season.number === number);
                if (target?.id && String(target.id) !== String(clean)) navigate(`/anime/${target.id}`);
              }}
            />
          )}

          {detail.episodes && detail.episodes > 1 ? (
            <EpisodeGrid anilistId={clean} totalEpisodes={detail.episodes} />
          ) : detail.status === 'NOT_YET_RELEASED' ? (
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/[0.05] text-xs font-mono text-zinc-400">
              This season is scheduled for release ({detail.year || 'Upcoming'}). Episodes will appear once aired.
            </div>
          ) : null}
        </section>

        {prequels.length > 0 && <RecommendationsSection items={prequels} title="Prequels" />}
        {sequels.length > 0 && <RecommendationsSection items={sequels} title="Sequels & Related" />}
        {detail.cast && detail.cast.length > 0 && <CastSection cast={detail.cast} title="Characters & Voice Cast" />}
        {detail.recommendations && detail.recommendations.length > 0 && (
          <RecommendationsSection items={detail.recommendations} title="More Like This" />
        )}
      </div>
    </div>
  );
}
