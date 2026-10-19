'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'i18n/routing';
import { useLocale } from 'next-intl';
import MovieWatchPage from './index';
import { getMovieDetail } from 'lib/catalog-client';
import type DetailMovie from 'types/detail-movie';
import type { Locale } from 'i18n/routing';

/**
 * Client shell for the watch page.
 *
 * Same reason as the detail page: the catalogue is fetched from the browser
 * because the host blocks Vercel's IPs (see `lib/catalog-client`).
 *
 * A title with nothing playable — a trailer, or an episode not yet uploaded —
 * is sent to the detail page, which can still show its synopsis. That check
 * lives here rather than on the server because it depends on the same fetch.
 */
export default function WatchPageClient({ slug }: { slug: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [movie, setMovie] = useState<DetailMovie | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    getMovieDetail(slug, locale)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          router.replace('/');
          return;
        }
        if (result.movie.slug !== slug) {
          router.replace(`/movies/watch/${result.movie.slug}`);
          return;
        }
        const playable = result.episodes.some((server) =>
          server.server_data.some((ep) => Boolean(ep.link_m3u8 || ep.link_embed))
        );
        if (!playable) {
          router.replace(`/movies/${result.movie.slug}`);
          return;
        }
        setMovie(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, locale, router, attempt]);

  if (failed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold">Không tải được phim</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="glass-btn glass-btn-primary"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!movie) {
    return <div className="min-h-screen animate-pulse bg-surface-secondary" />;
  }

  return <MovieWatchPage movie={movie} />;
}
