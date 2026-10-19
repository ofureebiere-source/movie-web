import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';
import { GridSkeleton, RailSkeleton } from './Skeleton';
import { useDiscoveryRail } from '@/hooks/useApiQueries';
import { scrollRailBy, useHorizontalScroll, useRailScrollState } from '@/hooks/useHorizontalScroll';
import type { FxList, MediaType } from '@/lib/api';

/**
 * A horizontal rail (or a grid) of posters under a heading.
 *
 * Ported 1:1 from frameXTV.xyz's `DiscoveryRail` chunk. It renders, in order:
 * a skeleton while loading, an inline error strip on failure, nothing when the
 * rail is genuinely empty, and otherwise the heading + count + "View all" with
 * a scroll track and hover-revealed arrow buttons.
 */

export interface DiscoveryRailProps {
  title: string;
  subtitle?: string;
  type: MediaType;
  category?: string;
  layout?: 'rail' | 'grid';
  extraParams?: { genre?: string; year?: string; sort?: string; minRating?: string };
  viewAllLink?: string;
  enabled?: boolean;
  className?: string;
  initialData?: FxList;
}

export default function DiscoveryRail({
  title,
  subtitle,
  type,
  category,
  layout = 'rail',
  extraParams,
  viewAllLink,
  enabled = true,
  className = '',
  initialData,
}: DiscoveryRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  useHorizontalScroll(trackRef, { disabled: layout !== 'rail' });

  const hasInitial = Boolean(
    initialData?.success && Array.isArray(initialData.results) && initialData.results.length > 0
  );

  const { data, isLoading, isError, error } = useDiscoveryRail(
    type,
    category,
    extraParams || {},
    enabled && !hasInitial,
    initialData
  );

  const resolved = hasInitial ? initialData : data;
  const showSkeleton = !hasInitial && isLoading;
  const showError = !hasInitial && isError;
  const errorValue = hasInitial ? null : error;
  const items = resolved?.results || [];

  const { canScrollLeft, canScrollRight } = useRailScrollState(trackRef, items.length);

  if (showSkeleton) {
    return layout === 'grid' ? <GridSkeleton count={12} /> : <RailSkeleton />;
  }

  if (showError) {
    return (
      <div
        className={`w-full py-4 px-3 rounded-xl bg-zinc-950/40 border border-white/[0.06] flex items-center justify-between text-xs text-zinc-500 font-mono ${className}`}
      >
        <div className="flex items-center gap-2 text-zinc-400">
          <AlertCircle className="w-4 h-4 text-zinc-500" />
          <span>
            {title}: Temporarily unable to load streams (
            {errorValue instanceof Error ? errorValue.message : 'Upstream unavailable'})
          </span>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section
      className={`relative w-full space-y-3 group/rail rail-containment ${className}`}
      data-testid="discovery-rail"
    >
      <div className="flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">{title}</h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 border border-white/[0.06] text-[10px] font-mono font-semibold text-zinc-400">
              {items.length}
            </span>
          </div>
          {subtitle && <p className="text-xs text-zinc-400 font-mono">{subtitle}</p>}
        </div>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            View all
          </Link>
        )}
      </div>

      {layout === 'grid' ? (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4 py-1">
          {items.map((item) => (
            <MediaCard
              key={`${type}-${item.id}`}
              id={item.id}
              type={item.type || type}
              title={item.title}
              poster={item.poster || item.image}
              year={item.year}
              rating={item.rating}
              anilistId={item.type === 'anime' || type === 'anime' ? item.anilistId || item.id : undefined}
              className="w-full"
            />
          ))}
        </div>
      ) : (
        <div className="relative">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollRailBy(trackRef, 'left')}
              aria-label={`Scroll ${title} left`}
              className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-white/[0.1] text-white flex items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 hover:border-white/[0.2] shadow-xl cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div
            ref={trackRef}
            className="flex items-start gap-2.5 xs:gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 scroll-touch"
          >
            {items.map((item) => (
              <MediaCard
                key={`${type}-${item.id}`}
                id={item.id}
                type={item.type || type}
                title={item.title}
                poster={item.poster || item.image}
                year={item.year}
                rating={item.rating}
                anilistId={item.type === 'anime' || type === 'anime' ? item.anilistId || item.id : undefined}
              />
            ))}
          </div>
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollRailBy(trackRef, 'right')}
              aria-label={`Scroll ${title} right`}
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950/90 border border-white/[0.1] text-white flex items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 hover:bg-zinc-850 hover:border-white/[0.2] shadow-xl cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
