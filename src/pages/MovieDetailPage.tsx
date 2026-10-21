import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CastSection, DetailHero, DetailSkeleton, DetailsError, RecommendationsSection } from '@/components/DetailShared';
import { useDetails, useWarmStream } from '@/hooks/useApiQueries';
import { extractId, isUnavailable, mediaId } from '@/lib/id';
import { formatRemaining, formatTime, getLatestForTitle } from '@/lib/watchProgress';
import { useIsInMyList, toggleMyList } from '@/lib/watchlist';
import { SITE_NAME } from '@/lib/brand';
import NotFoundPage from './NotFoundPage';

/**
 * A film's detail page.
 *
 * Ported 1:1 from frameXTV.xyz's `MovieDetailPage`: an id-with-slug in the URL
 * is rewritten to the bare id, the document title follows the loaded title, an
 * unavailable or missing title falls through to the 404 page, and the play
 * button offers "Continue Watching" with a resume timestamp when there is
 * saved progress.
 */
export default function MovieDetailPage() {
  const { id, tmdbId } = useParams();
  const navigate = useNavigate();
  const raw = id || tmdbId;
  const clean = mediaId(raw);

  useEffect(() => {
    if (raw && raw.includes('-')) {
      const extracted = extractId(raw);
      if (extracted) navigate(`/movie/${extracted}`, { replace: true });
    }
  }, [raw, navigate]);

  const unavailable = Boolean(clean) && isUnavailable(clean, 'movie');
  const { data: detail, isLoading, isError, error, refetch } = useDetails(clean, 'movie', Boolean(clean) && !unavailable);

  useEffect(() => {
    if (detail?.title) {
      document.title = `${detail.title} ${detail.year ? `(${detail.year}) ` : ''}— ${SITE_NAME}`;
    }
  }, [detail?.title, detail?.year]);

  const isSaved = useIsInMyList('movie', clean);
  const warmStream = useWarmStream(clean, 'movie', undefined, undefined, {
    title: detail?.title,
    year: detail?.year,
  });

  if (unavailable) return <NotFoundPage />;
  if (isLoading) return <DetailSkeleton />;
  if (isError || !detail || !clean) {
    return (
      <DetailsError
        title="Movie Not Found"
        message={error instanceof Error ? error.message : 'The requested movie could not be loaded.'}
        onRetry={() => refetch()}
      />
    );
  }

  const progress = getLatestForTitle('movie', clean);
  const canResume = Boolean(progress && !progress.completed && progress.timestamp > 15);
  const playUrl = `/watch/${clean}`;
  const playLabel = canResume ? 'Continue Watching' : 'Watch Movie';
  const remaining = progress ? formatRemaining(progress) : '';
  const resumeSubtitle = canResume
    ? remaining
      ? `Resume at ${formatTime(progress!.timestamp)} • ${remaining}`
      : `Resume at ${formatTime(progress!.timestamp)}`
    : undefined;

  return (
    <div className="w-full min-h-screen page-bg text-zinc-100 flex flex-col pb-16">
      <DetailHero
        detail={detail}
        playUrl={playUrl}
        playLabel={playLabel}
        resumeSubtitle={resumeSubtitle}
        isSaved={isSaved}
        onWarmStream={warmStream}
        onToggleWatchlist={() =>
          toggleMyList({
            mediaType: 'movie',
            id: clean,
            title: detail.title,
            poster: detail.poster,
            backdrop: detail.backdrop,
            year: detail.year,
          })
        }
      />
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {detail.cast && detail.cast.length > 0 && <CastSection cast={detail.cast} />}
        {detail.recommendations && detail.recommendations.length > 0 && (
          <RecommendationsSection items={detail.recommendations} title="More Like This" />
        )}
      </div>
    </div>
  );
}
