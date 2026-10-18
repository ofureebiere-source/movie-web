'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'i18n/routing';
import { useLocale } from 'next-intl';
import MoviePage from './index';
import { loadTitlePage, type TitlePageData } from 'lib/catalog-client';
import type { Locale } from 'i18n/routing';

/**
 * Client shell for a title's detail page.
 *
 * The fetch has to happen here rather than in the server page: the catalogue
 * host answers Vercel's IPs with a Cloudflare challenge, so a server-side
 * request would return an interstitial and the page would render nothing.
 * See `lib/catalog-client`.
 *
 * Two failure modes, kept distinct on purpose:
 *
 *  - **resolved to nothing** — the slug is genuinely unknown, so send the
 *    visitor home rather than showing an empty shell.
 *  - **threw** — the catalogue is unreachable. That is not a missing title,
 *    and pretending it is would hide an outage behind a redirect. The error
 *    state is shown instead, with a retry.
 */
export default function DetailPageClient({ slug }: { slug: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [data, setData] = useState<TitlePageData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    loadTitlePage(slug, locale)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          router.replace('/');
          return;
        }
        // A legacy slug resolved through its id: send the visitor — and any
        // link they copy — to the canonical URL.
        if (result.movie.movie.slug !== slug) {
          router.replace(`/movies/${result.movie.movie.slug}`);
          return;
        }
        setData(result);
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
        <p className="text-lg font-semibold">Không tải được thông tin phim</p>
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

  if (!data) {
    return (
      <div className="min-h-screen">
        <div className="h-[60vh] w-full animate-pulse bg-neutral-800/60" />
        <div className="container-wrapper space-y-4 px-4 py-8">
          <div className="h-8 w-1/3 animate-pulse rounded bg-neutral-800/60" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800/60" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-800/60" />
        </div>
      </div>
    );
  }

  const { movie, relatedMovies, extras } = data;

  // The catalogue writes every synopsis in Vietnamese, so on any other locale
  // this is machine translation and the reader deserves to be told.
  const aiTranslated = Boolean(movie.movie.content) && movie.movie.content_lang !== locale;

  return (
    <MoviePage
      movie={movie}
      credit={extras.credit}
      images={extras.images}
      logoUrl={null}
      relatedMovies={relatedMovies}
      seasons={[]}
      aiTranslated={aiTranslated}
    />
  );
}
