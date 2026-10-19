import { useEffect, useRef } from 'react';
import type { FxSeason } from '@/lib/api';

/**
 * The season pill row on a series / anime detail page.
 *
 * Ported 1:1 from frameXTV.xyz's `SeasonSelector` chunk: seasons numbered 0
 * (specials) are hidden when any numbered season exists, the active pill is
 * scrolled into view, and each pill shows its episode count.
 */
export default function SeasonSelector({
  seasons,
  activeSeason,
  onSelectSeason,
}: {
  seasons: FxSeason[];
  activeSeason: number;
  onSelectSeason: (season: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    const active = element.querySelector('[data-active="true"]');
    active?.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
  }, [activeSeason]);

  if (!seasons || seasons.length === 0) return null;

  const numbered = seasons.filter((season) => season.number > 0);
  const shown = numbered.length > 0 ? numbered : seasons;

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Seasons</h3>
        <span className="text-[11px] font-mono text-zinc-400">{shown.length} seasons available</span>
      </div>
      <div ref={trackRef} className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-touch">
        {shown.map((season) => {
          const active = season.number === activeSeason;
          const count = season.episodeCount ?? season.episode_count ?? 0;
          return (
            <button
              key={season.id ?? season.number}
              type="button"
              data-active={active ? 'true' : 'false'}
              onClick={() => onSelectSeason(season.number)}
              aria-pressed={active}
              className={`flex-shrink-0 px-3.5 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer select-none ${
                active
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <span>{season.name || `Season ${season.number}`}</span>
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] font-mono ${active ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
