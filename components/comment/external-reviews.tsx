'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getExternalReviews, type ExternalReview } from 'services/reviews-service';
import type Movie from 'types/movie';

/**
 * Reviews pulled from public sources, shown above the on-page comment box.
 *
 * These are the only reviews on the page that a first-time visitor can
 * actually read: the comment box below is per-browser `localStorage`, so it
 * starts empty for everyone. Sourcing them is `services/reviews-service`'s
 * job; this component only renders, and renders nothing at all when a title
 * has no coverage rather than an empty state that implies a failure.
 */
export default function ExternalReviews({ movie }: { movie: Movie }) {
  const t = useTranslations('reviews');
  const locale = useLocale();
  const [reviews, setReviews] = useState<ExternalReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReviews(null);

    getExternalReviews(movie, locale)
      .then((result) => {
        if (!cancelled) setReviews(result);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });

    return () => {
      cancelled = true;
    };
    // `movie` is stable for a rendered page; re-keying on the fields that
    // actually identify the title keeps the effect from re-firing on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie._id, locale]);

  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold lg:text-xl">{t('heading')}</h3>

      <div className="space-y-3">
        {reviews.map((review, index) => (
          <article
            key={`${review.source}-${index}`}
            className="rounded-xl border border-line bg-surface-chip p-4"
          >
            <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {review.author && <span className="font-semibold">{review.author}</span>}
              {review.scoreLabel && (
                <span className="rounded-md bg-surface-chip px-2 py-0.5 font-semibold tabular-nums">
                  {review.scoreLabel}
                </span>
              )}
              <span className="text-content-muted">{t('via', { source: review.source })}</span>
            </header>

            {review.title && <h4 className="mb-1 font-semibold">{review.title}</h4>}

            {review.body && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-content-soft">
                {review.body}
              </p>
            )}
          </article>
        ))}
      </div>

      <p className="text-xs text-content-muted">{t('attribution')}</p>
    </section>
  );
}
