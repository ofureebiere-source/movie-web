/** Loading skeletons, matching frameXTV.xyz's `Skeleton` chunk. */

export function SkeletonBox({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-zinc-900/80 animate-pulse rounded-lg ${className}`} {...rest} />;
}

/** One poster-shaped card placeholder. */
export function CardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[140px] sm:w-[170px] md:w-[190px] space-y-2">
      <SkeletonBox className="w-full aspect-[2/3] rounded-lg border border-zinc-900" />
      <div className="space-y-1 pt-1">
        <SkeletonBox className="h-3.5 w-3/4 rounded" />
        <SkeletonBox className="h-2.5 w-1/2 rounded" />
      </div>
    </div>
  );
}

/** A rail heading plus six poster placeholders. */
export function RailSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-5 w-36 rounded" />
        <SkeletonBox className="h-3 w-16 rounded" />
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/** A responsive poster grid placeholder. */
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-full space-y-2">
          <SkeletonBox className="w-full aspect-[2/3] rounded-lg border border-zinc-900" />
          <div className="space-y-1 pt-1">
            <SkeletonBox className="h-3.5 w-3/4 rounded" />
            <SkeletonBox className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
