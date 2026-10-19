'use client';
import { MdMovie } from 'react-icons/md';
import { useTranslations } from 'next-intl';
import { MovieGridLoadMoreSkeleton } from './movie-grid-skeleton';

interface InfiniteScrollSentinelProps {
  /** Attach this ref to a `<div>` that becomes visible when user scrolls near the bottom. */
  sentinelRef: (node?: Element | null) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  onRetry: () => void;
  isEmpty: boolean;
}

/**
 * Visual sentinel + status messaging for infinite-scroll pagination.
 * Renders different UI for: loading more / end of list / error / empty.
 */
export default function InfiniteScrollSentinel({
  sentinelRef,
  isLoadingMore,
  hasMore,
  error,
  onRetry,
  isEmpty,
}: InfiniteScrollSentinelProps) {
  const t = useTranslations('lists');
  const tCommon = useTranslations('common');

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="text-red-400 text-sm">{t('errorLoading')}</div>
        <button
          onClick={onRetry}
          className="glass-btn glass-btn-sm"
        >
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!hasMore) {
    if (isEmpty) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-content-muted">
          <MdMovie className="text-4xl" />
          <div className="text-sm">{t('emptyCategory')}</div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-10 text-content-muted text-sm">
        {t('endOfList')}
      </div>
    );
  }

  return (
    <>
      {isLoadingMore && <MovieGridLoadMoreSkeleton count={5} />}
      {/* Sentinel — invisible div the IntersectionObserver watches */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
    </>
  );
}
